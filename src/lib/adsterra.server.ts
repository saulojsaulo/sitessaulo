import type {
  AdsterraCountryRow,
  AdsterraDailyPoint,
  AdsterraDashboard,
  AdsterraDomain,
  AdsterraMetrics,
  AdsterraPlacementRow,
  AdsterraRange,
} from "./adsterra-types";

/**
 * API de Publisher da Adsterra (somente leitura).
 * Autenticação: header `X-API-Key`. A chave vem SOMENTE da variável de ambiente
 * ADSTERRA_API_KEY — nunca do código nem do navegador.
 *
 * Limites documentados: 1200 req/min, no máximo 5 requisições de estatística simultâneas,
 * cada resposta fica em cache por 60 s no lado da Adsterra.
 */
const BASE = "https://api3.adsterratools.com/publisher";
const CACHE_TTL_MS = 55_000;
const MAX_CONCURRENT_STATS = 3;

type Row = Record<string, unknown>;
type Params = Record<string, string | undefined>;

/* ----------------------------- HTTP ----------------------------- */

let activeStats = 0;
const waiters: Array<() => void> = [];
async function withStatsSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeStats >= MAX_CONCURRENT_STATS) await new Promise<void>((r) => waiters.push(r));
  activeStats++;
  try {
    return await fn();
  } finally {
    activeStats--;
    waiters.shift()?.();
  }
}

const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function explain(status: number, body: string): string {
  switch (status) {
    case 401:
      return "Token da Adsterra inválido (401). Gere um token no painel da Adsterra e atualize ADSTERRA_API_KEY.";
    case 403:
      return "Token da Adsterra expirado ou sem permissão (403). Gere um novo token e atualize ADSTERRA_API_KEY.";
    case 404:
      return "Recurso não encontrado na Adsterra (404).";
    case 429:
      return "Muitas requisições simultâneas à Adsterra (429). Tente novamente em instantes.";
    default: {
      let detail = "";
      try {
        const j = JSON.parse(body) as Row;
        detail = String(j["message"] ?? j["error"] ?? "").slice(0, 160);
      } catch {
        /* corpo não-JSON */
      }
      return `Erro da Adsterra (HTTP ${status})${detail ? `: ${detail}` : "."}`;
    }
  }
}

async function request(path: string, params: Params, isStats: boolean): Promise<unknown> {
  const key = process.env["ADSTERRA_API_KEY"]?.trim();
  if (!key) {
    throw new Error(
      "ADSTERRA_API_KEY não configurada no servidor. Defina a variável de ambiente e recarregue.",
    );
  }

  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const cacheKey = url.toString(); // não contém a chave (ela vai no header)

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const run = async (): Promise<unknown> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Accept: "application/json", "X-API-Key": key },
          signal: AbortSignal.timeout(20_000),
        });
      } catch (e) {
        const timeout = e instanceof Error && e.name === "TimeoutError";
        throw new Error(
          timeout
            ? "A Adsterra demorou demais para responder. Tente novamente."
            : "Não foi possível conectar à API da Adsterra.",
        );
      }
      const text = await res.text();
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      if (!res.ok) throw new Error(explain(res.status, text));
      try {
        const json: unknown = JSON.parse(text);
        cache.set(cacheKey, { at: Date.now(), value: json });
        return json;
      } catch {
        throw new Error("Resposta inválida da Adsterra (não é JSON).");
      }
    }
    throw new Error(explain(429, ""));
  };

  const p = (isStats ? withStatsSlot(run) : run()).finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, p);
  return p;
}

/* --------------------------- Parsing tolerante --------------------------- */

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const pick = (r: Row, keys: string[]): unknown => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
  return undefined;
};

/** Aceita `{items:[…]}`, `{data:[…]}` ou um array direto. */
function rowsOf(json: unknown): Row[] {
  if (Array.isArray(json)) return json.filter((x): x is Row => !!x && typeof x === "object");
  if (json && typeof json === "object") {
    const o = json as Row;
    for (const k of ["items", "data", "rows", "stats", "result"]) {
      const v = o[k];
      if (Array.isArray(v)) return v.filter((x): x is Row => !!x && typeof x === "object");
    }
  }
  return [];
}

const readBase = (r: Row) => ({
  impressions: num(pick(r, ["impression", "impressions"])),
  clicks: num(pick(r, ["clicks", "click"])),
  revenue: num(pick(r, ["revenue", "earnings", "profit"])),
});

/** Razões são sempre RECALCULADAS dos totais (somar CPM/CTR da API estaria errado). */
function withRatios(b: { impressions: number; clicks: number; revenue: number }): AdsterraMetrics {
  return {
    ...b,
    ctr: b.impressions > 0 ? b.clicks / b.impressions : 0,
    cpm: b.impressions > 0 ? (b.revenue / b.impressions) * 1000 : 0,
  };
}

function sumRows(
  rows: { impressions: number; clicks: number; revenue: number }[],
): AdsterraMetrics {
  return withRatios(
    rows.reduce(
      (a, r) => ({
        impressions: a.impressions + r.impressions,
        clicks: a.clicks + r.clicks,
        revenue: a.revenue + r.revenue,
      }),
      { impressions: 0, clicks: 0, revenue: 0 },
    ),
  );
}

const stringify = (r: Row | undefined): Record<string, string> | null =>
  r
    ? Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          typeof v === "object" ? JSON.stringify(v) : String(v),
        ]),
      )
    : null;

/* ------------------------------ Datas (UTC) ------------------------------ */

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
};
const diffDays = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function resolveRange(range: AdsterraRange, now = new Date()) {
  const today = isoDay(now);
  let start = today;
  let finish = today;
  switch (range) {
    case "today":
      break;
    case "yesterday":
      start = finish = addDays(today, -1);
      break;
    case "7d":
      start = addDays(today, -6);
      break;
    case "14d":
      start = addDays(today, -13);
      break;
    case "30d":
      start = addDays(today, -29);
      break;
    case "month":
      start = `${today.slice(0, 7)}-01`;
      break;
  }
  const days = diffDays(start, finish) + 1;
  const prevFinish = addDays(start, -1);
  const prevStart = addDays(prevFinish, -(days - 1));
  return { id: range, start, finish, prevStart, prevFinish, days };
}

/* -------------------------------- Consultas -------------------------------- */

function dailyOf(json: unknown, start: string, finish: string): AdsterraDailyPoint[] {
  const byDate = new Map<string, { impressions: number; clicks: number; revenue: number }>();
  for (const r of rowsOf(json)) {
    const date = String(pick(r, ["date", "day"]) ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const b = readBase(r);
    const cur = byDate.get(date) ?? { impressions: 0, clicks: 0, revenue: 0 };
    byDate.set(date, {
      impressions: cur.impressions + b.impressions,
      clicks: cur.clicks + b.clicks,
      revenue: cur.revenue + b.revenue,
    });
  }
  // Preenche dias sem dados com zero para o gráfico não "pular" datas.
  const out: AdsterraDailyPoint[] = [];
  for (let d = start; d <= finish; d = addDays(d, 1)) {
    out.push({
      date: d,
      ...withRatios(byDate.get(d) ?? { impressions: 0, clicks: 0, revenue: 0 }),
    });
  }
  return out;
}

const lookupName = (row: Row): string =>
  String(pick(row, ["title", "name", "alias", "url", "domain"]) ?? "");

export async function loadAdsterraDashboard(
  rangeId: AdsterraRange,
  domainId?: string,
): Promise<AdsterraDashboard> {
  const range = resolveRange(rangeId);
  const base = (start: string, finish: string, groupBy: string): Params => ({
    start_date: start,
    finish_date: finish,
    group_by: groupBy,
    ...(domainId ? { domain: domainId } : {}),
  });

  const warnings: string[] = [];
  const soft = async <T>(label: string, p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (e) {
      warnings.push(`${label}: ${e instanceof Error ? e.message : "falhou"}`);
      return null;
    }
  };

  // Obrigatórias (se falharem, o painel mostra o erro).
  const [dailyJson, prevJson] = await Promise.all([
    request("stats.json", base(range.start, range.finish, "date"), true),
    request("stats.json", base(range.prevStart, range.prevFinish, "date"), true),
  ]);

  // Opcionais (se falharem, o painel segue com um aviso).
  const [placementsJson, countriesJson, domainsJson, placementListJson] = await Promise.all([
    soft("Placements", request("stats.json", base(range.start, range.finish, "placement"), true)),
    soft("Países", request("stats.json", base(range.start, range.finish, "country"), true)),
    soft("Sites", request("domains.json", {}, false)),
    soft("Lista de placements", request("placements.json", {}, false)),
  ]);

  const daily = dailyOf(dailyJson, range.start, range.finish);
  const prevDaily = dailyOf(prevJson, range.prevStart, range.prevFinish);

  const domains: AdsterraDomain[] = rowsOf(domainsJson)
    .map((r) => ({ id: String(pick(r, ["id", "domain_id"]) ?? ""), title: lookupName(r) }))
    .filter((d) => d.id !== "")
    .map((d) => ({ ...d, title: d.title || `Site ${d.id}` }));
  const domainTitle = new Map(domains.map((d) => [d.id, d.title]));

  const placementInfo = new Map<string, { name: string; domain: string }>();
  for (const r of rowsOf(placementListJson)) {
    const id = String(pick(r, ["id", "placement_id"]) ?? "");
    if (!id) continue;
    const dId = String(pick(r, ["domain_id", "domain"]) ?? "");
    placementInfo.set(id, { name: lookupName(r), domain: domainTitle.get(dId) ?? "" });
  }

  const placements: AdsterraPlacementRow[] = rowsOf(placementsJson)
    .map((r) => {
      const raw = String(pick(r, ["placement", "placement_id", "placement_name", "title"]) ?? "");
      const info = placementInfo.get(raw);
      const isId = /^\d+$/.test(raw);
      return {
        id: raw,
        name: info?.name || (isId ? `Placement ${raw}` : raw || "Sem nome"),
        domain: info?.domain ?? "",
        ...withRatios(readBase(r)),
      };
    })
    .filter((p) => p.impressions > 0 || p.clicks > 0 || p.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const countries: AdsterraCountryRow[] = rowsOf(countriesJson)
    .map((r) => ({
      code: String(pick(r, ["country", "geo", "country_code"]) ?? "—").trim(),
      ...withRatios(readBase(r)),
    }))
    .filter((c) => c.impressions > 0 || c.clicks > 0 || c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    fetchedAt: new Date().toISOString(),
    range,
    totals: sumRows(daily),
    prevTotals: sumRows(prevDaily),
    daily,
    placements,
    countries,
    domains,
    warnings,
    diagnostic: {
      daily: stringify(rowsOf(dailyJson)[0]),
      placements: stringify(rowsOf(placementsJson)[0]),
      countries: stringify(rowsOf(countriesJson)[0]),
    },
  };
}
