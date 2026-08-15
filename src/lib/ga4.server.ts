/** Helpers server-only para a Google Analytics Data API v1 (GA4). */

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

function b64url(bytes: Uint8Array | string) {
  const str =
    typeof bytes === "string"
      ? bytes
      : Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) buf[i] = raw.charCodeAt(i);
  return buf;
}

function readServiceAccount(): ServiceAccount {
  const raw = process.env["GOOGLE_SERVICE_ACCOUNT_KEY"];
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não é um JSON válido");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service Account sem client_email/private_key");
  }
  return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > now) return tokenCache.token;

  const sa = readServiceAccount();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(`${header}.${claims}`),
    ),
  );
  const assertion = `${header}.${claims}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !body.access_token) {
    throw new Error(`Falha ao autenticar no Google (${res.status}): ${JSON.stringify(body)}`);
  }
  tokenCache = { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) };
  return body.access_token;
}

interface GaRow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}
interface GaReport {
  rows?: GaRow[];
}

export async function batchRunReports(
  propertyId: string,
  requests: unknown[],
): Promise<GaReport[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(
      propertyId,
    )}:batchRunReports`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ requests }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(`GA4 batchRunReports falhou [${res.status}]: ${text}`);
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      /* mantém o texto bruto */
    }
    if (res.status === 403 && /has not been used in project|is disabled/i.test(detail)) {
      detail =
        "A Google Analytics Data API está desativada no projeto do Google Cloud da sua Service Account. Ative em console.cloud.google.com > APIs e Serviços > Google Analytics Data API e aguarde alguns minutos.";
    } else if (res.status === 403) {
      detail = `Sem permissão nesta propriedade GA4. Adicione o e-mail da Service Account como Leitor na propriedade. (${detail})`;
    } else if (res.status === 404) {
      detail = `Property ID ${propertyId} não encontrado no GA4.`;
    }
    throw new Error(detail);
  }
  return (JSON.parse(text) as { reports?: GaReport[] }).reports ?? [];
}

export const num = (v?: string) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const dim = (row: GaRow, i = 0) => row.dimensionValues?.[i]?.value ?? "";
export const met = (row: GaRow, i = 0) => num(row.metricValues?.[i]?.value);
export type { GaReport, GaRow };