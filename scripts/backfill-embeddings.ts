// Backfill embeddings for `insights` and `document_chunks` rows where embedding IS NULL.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... \
//     deno run --allow-net --allow-env scripts/backfill-embeddings.ts
//
//   # Limit to a single table:
//   SUPABASE_SERVICE_ROLE_KEY=... \
//     deno run --allow-net --allow-env scripts/backfill-embeddings.ts --table=insights
//   SUPABASE_SERVICE_ROLE_KEY=... \
//     deno run --allow-net --allow-env scripts/backfill-embeddings.ts --table=document_chunks
//
// Optional env / flags:
//   SUPABASE_URL          (default: https://gntgcxdbcbywfboejimz.supabase.co)
//   --delay-ms=<number>   (default: 1000) delay between requests
//   --batch-size=<number> (default: 500)  rows fetched per page
//
// Obtain SUPABASE_SERVICE_ROLE_KEY:
//   supabase projects api-keys --project-ref gntgcxdbcbywfboejimz
//   (or Supabase Dashboard -> Project Settings -> API -> service_role secret)

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

type TableName = "insights" | "document_chunks";

interface InsightRow {
  id: string;
  content: string | null;
  content_normalized: string | null;
}

interface DocumentChunkRow {
  id: string;
  body: string;
}

interface RowJob {
  table: TableName;
  id: string;
  text: string;
}

interface TableSummary {
  total: number;
  succeeded: number;
  failedIds: string[];
}

const DEFAULT_SUPABASE_URL = "https://gntgcxdbcbywfboejimz.supabase.co";
const DEFAULT_DELAY_MS = 1000;
const DEFAULT_BATCH_SIZE = 500;
const INSIGHTS_TEXT_LIMIT = 6000;

function parseFlags(args: string[]): {
  table: TableName | "all";
  delayMs: number;
  batchSize: number;
} {
  let table: TableName | "all" = "all";
  let delayMs = DEFAULT_DELAY_MS;
  let batchSize = DEFAULT_BATCH_SIZE;

  for (const arg of args) {
    if (arg.startsWith("--table=")) {
      const value = arg.slice("--table=".length);
      if (value !== "insights" && value !== "document_chunks") {
        throw new Error(
          `Invalid --table value: ${value}. Expected "insights" or "document_chunks".`,
        );
      }
      table = value;
    } else if (arg.startsWith("--delay-ms=")) {
      const value = Number(arg.slice("--delay-ms=".length));
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid --delay-ms value: ${arg}`);
      }
      delayMs = value;
    } else if (arg.startsWith("--batch-size=")) {
      const value = Number(arg.slice("--batch-size=".length));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --batch-size value: ${arg}`);
      }
      batchSize = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { table, delayMs, batchSize };
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.length === 0) {
    console.error(`[fatal] Missing required env var: ${name}`);
    Deno.exit(1);
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickInsightText(row: InsightRow): string | null {
  const raw = row.content_normalized ?? row.content;
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > INSIGHTS_TEXT_LIMIT) {
    console.warn(
      `[warn] insights ${row.id}: text length ${trimmed.length} > ${INSIGHTS_TEXT_LIMIT}, truncating`,
    );
    return trimmed.slice(0, INSIGHTS_TEXT_LIMIT);
  }
  return trimmed;
}

async function fetchInsightJobs(
  client: SupabaseClient,
  batchSize: number,
): Promise<RowJob[]> {
  const jobs: RowJob[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from("insights")
      .select("id, content, content_normalized")
      .is("embedding", null)
      .order("id", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) {
      throw new Error(`Failed to query insights: ${error.message}`);
    }
    const rows = (data ?? []) as InsightRow[];
    for (const row of rows) {
      const text = pickInsightText(row);
      if (text === null) {
        console.warn(`[warn] insights ${row.id}: empty text, skipping`);
        continue;
      }
      jobs.push({ table: "insights", id: row.id, text });
    }
    if (rows.length < batchSize) break;
    from += batchSize;
  }
  return jobs;
}

async function fetchDocumentChunkJobs(
  client: SupabaseClient,
  batchSize: number,
): Promise<RowJob[]> {
  const jobs: RowJob[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from("document_chunks")
      .select("id, body")
      .is("embedding", null)
      .order("id", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) {
      throw new Error(`Failed to query document_chunks: ${error.message}`);
    }
    const rows = (data ?? []) as DocumentChunkRow[];
    for (const row of rows) {
      const text = row.body?.trim() ?? "";
      if (text.length === 0) {
        console.warn(`[warn] document_chunks ${row.id}: empty body, skipping`);
        continue;
      }
      jobs.push({ table: "document_chunks", id: row.id, text });
    }
    if (rows.length < batchSize) break;
    from += batchSize;
  }
  return jobs;
}

async function invokeEdgeFunction(
  supabaseUrl: string,
  serviceRoleKey: string,
  job: RowJob,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-embedding`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        table: job.table,
        id: job.id,
        text: job.text,
        task_type: "RETRIEVAL_DOCUMENT",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `HTTP ${res.status}: ${body.slice(0, 500)}`,
      };
    }
    // Drain body so the connection can be reused.
    await res.text().catch(() => "");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function processJobs(
  jobs: RowJob[],
  supabaseUrl: string,
  serviceRoleKey: string,
  delayMs: number,
): Promise<Map<TableName, TableSummary>> {
  const summaries = new Map<TableName, TableSummary>([
    ["insights", { total: 0, succeeded: 0, failedIds: [] }],
    ["document_chunks", { total: 0, succeeded: 0, failedIds: [] }],
  ]);

  for (const job of jobs) {
    const summary = summaries.get(job.table);
    if (!summary) continue;
    summary.total += 1;
    const result = await invokeEdgeFunction(supabaseUrl, serviceRoleKey, job);
    if (result.ok) {
      summary.succeeded += 1;
      console.log(`[ok] ${job.table} ${job.id}`);
    } else {
      summary.failedIds.push(job.id);
      console.error(`[err] ${job.table} ${job.id}: ${result.error}`);
    }
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return summaries;
}

function printSummary(summaries: Map<TableName, TableSummary>): void {
  for (const table of ["insights", "document_chunks"] as const) {
    const s = summaries.get(table);
    if (!s) continue;
    const failed = s.total - s.succeeded;
    const idsSuffix = failed > 0
      ? ` (ids: [${s.failedIds.join(", ")}])`
      : " (ids: [])";
    console.log(
      `${table}: ${s.total} total, ${s.succeeded} succeeded, ${failed} failed${idsSuffix}`,
    );
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(Deno.args);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? DEFAULT_SUPABASE_URL;
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jobs: RowJob[] = [];
  if (flags.table === "all" || flags.table === "insights") {
    console.log("[info] fetching insights with embedding IS NULL ...");
    const insightJobs = await fetchInsightJobs(client, flags.batchSize);
    console.log(`[info] insights to process: ${insightJobs.length}`);
    jobs.push(...insightJobs);
  }
  if (flags.table === "all" || flags.table === "document_chunks") {
    console.log("[info] fetching document_chunks with embedding IS NULL ...");
    const chunkJobs = await fetchDocumentChunkJobs(client, flags.batchSize);
    console.log(`[info] document_chunks to process: ${chunkJobs.length}`);
    jobs.push(...chunkJobs);
  }

  if (jobs.length === 0) {
    console.log("[info] nothing to do");
    printSummary(
      new Map<TableName, TableSummary>([
        ["insights", { total: 0, succeeded: 0, failedIds: [] }],
        ["document_chunks", { total: 0, succeeded: 0, failedIds: [] }],
      ]),
    );
    Deno.exit(0);
  }

  const summaries = await processJobs(
    jobs,
    supabaseUrl,
    serviceRoleKey,
    flags.delayMs,
  );

  console.log("");
  console.log("=== Summary ===");
  printSummary(summaries);

  const anyFailed = Array.from(summaries.values()).some(
    (s) => s.total - s.succeeded > 0,
  );
  Deno.exit(anyFailed ? 1 : 0);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error(`[fatal] ${msg}`);
    Deno.exit(1);
  });
}
