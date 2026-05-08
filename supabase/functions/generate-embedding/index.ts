import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAccessToken, parseServiceAccount } from "./auth.ts";

type TableName = "insights" | "document_chunks";
type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
type Mode = "document" | "query";

interface RequestBody {
  mode: Mode;
  table?: TableName;
  id?: number;
  text: string;
  task_type: TaskType;
}

interface VertexPredictResponse {
  predictions: Array<{
    embeddings: {
      values: number[];
      statistics?: { token_count?: number; truncated?: boolean };
    };
  }>;
}

const ALLOWED_TABLES: ReadonlySet<TableName> = new Set(["insights", "document_chunks"]);
const ALLOWED_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  "RETRIEVAL_DOCUMENT",
  "RETRIEVAL_QUERY",
]);
const EMBEDDING_MODEL = "text-embedding-005";
const EMBEDDING_DIMENSIONS = 768;
const VERTEX_LOCATION = "us-central1";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

function errorResponse(status: number, error: string): Response {
  return jsonResponse(status, { success: false, error });
}

function validateBody(raw: unknown): RequestBody {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("validate: body must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  const text = obj.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("validate: text must be a non-empty string");
  }

  const rawMode = obj.mode;
  const tablePresent = obj.table !== undefined;
  const idPresent = obj.id !== undefined;

  let mode: Mode;
  if (rawMode !== undefined) {
    if (rawMode !== "query" && rawMode !== "document") {
      throw new Error("validate: mode must be 'query' or 'document'");
    }
    mode = rawMode;
  } else {
    mode = tablePresent || idPresent ? "document" : "query";
  }

  const rawTaskType = obj.task_type;
  let task_type: TaskType = mode === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
  if (rawTaskType !== undefined) {
    if (typeof rawTaskType !== "string" || !ALLOWED_TASK_TYPES.has(rawTaskType as TaskType)) {
      throw new Error("validate: task_type must be RETRIEVAL_DOCUMENT or RETRIEVAL_QUERY");
    }
    task_type = rawTaskType as TaskType;
  }

  if (mode === "query") {
    if (tablePresent || idPresent) {
      throw new Error("validate: query mode must not include table or id");
    }
    return { mode, text, task_type };
  }

  const table = obj.table;
  if (typeof table !== "string" || !ALLOWED_TABLES.has(table as TableName)) {
    throw new Error("validate: table must be 'insights' or 'document_chunks'");
  }

  const id = obj.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new Error("validate: id must be a positive integer");
  }

  return { mode, table: table as TableName, id, text, task_type };
}

async function predictEmbedding(
  accessToken: string,
  projectId: string,
  text: string,
  taskType: TaskType,
): Promise<number[]> {
  const url =
    `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${VERTEX_LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ content: text, task_type: taskType }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`vertex-predict: ${res.status} ${errText}`);
  }

  const json = (await res.json()) as VertexPredictResponse;
  const values = json.predictions?.[0]?.embeddings?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `vertex-predict: expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${values?.length ?? "none"}`,
    );
  }
  return values;
}

async function updateRow(
  table: TableName,
  id: number,
  embedding: number[],
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("supabase-update: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await client
    .from(table)
    .update({ embedding, embedding_model: EMBEDDING_MODEL })
    .eq("id", id);

  if (error) {
    throw new Error(`supabase-update: ${error.message}`);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method-not-allowed");
  }

  let body: RequestBody;
  try {
    const raw = await req.json();
    body = validateBody(raw);
  } catch (err) {
    return errorResponse(400, (err as Error).message);
  }

  const saRaw = Deno.env.get("GCP_SA_KEY");
  const projectId = Deno.env.get("GCP_PROJECT_ID");
  if (!saRaw || !projectId) {
    return errorResponse(500, "config: missing GCP_SA_KEY or GCP_PROJECT_ID");
  }

  try {
    const sa = parseServiceAccount(saRaw);
    const accessToken = await getAccessToken(sa);
    const embedding = await predictEmbedding(accessToken, projectId, body.text, body.task_type);

    if (body.mode === "query") {
      console.log(
        JSON.stringify({
          step: "done",
          mode: "query",
          dimensions: embedding.length,
        }),
      );
      return jsonResponse(200, {
        success: true,
        embedding_dimensions: embedding.length,
        embedding,
      });
    }

    await updateRow(body.table!, body.id!, embedding);

    console.log(
      JSON.stringify({
        step: "done",
        table: body.table,
        id: body.id,
        dimensions: embedding.length,
      }),
    );

    return jsonResponse(200, {
      success: true,
      embedding_dimensions: embedding.length,
    });
  } catch (err) {
    const message = (err as Error).message;
    console.error(JSON.stringify({ step: "error", message }));
    return errorResponse(500, message);
  }
});
