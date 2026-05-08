interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buf;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signJwt(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: sa.token_uri ?? TOKEN_URI,
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export function parseServiceAccount(raw: string): ServiceAccountKey {
  const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("service-account-invalid: missing client_email or private_key");
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    token_uri: parsed.token_uri,
  };
}

export async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  let assertion: string;
  try {
    assertion = await signJwt(sa);
  } catch (err) {
    throw new Error(`jwt-sign: ${(err as Error).message}`);
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(sa.token_uri ?? TOKEN_URI, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`token-exchange: ${res.status} ${errText}`);
  }

  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) {
    throw new Error("token-exchange: missing access_token in response");
  }
  return json.access_token;
}
