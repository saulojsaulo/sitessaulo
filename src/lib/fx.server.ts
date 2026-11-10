import type { UsdBrlRate } from "./fx-types";

/**
 * Cotação do dólar em reais.
 *  - Principal: AwesomeAPI (dólar comercial). Funciona sem chave (cache de 1 min no lado
 *    deles); com AWESOMEAPI_KEY opcional vem em tempo real, sem cache.
 *  - Reserva/referência: PTAX do Banco Central (API aberta, sem chave).
 */
const AWESOME_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const BCB_BASE = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata";

const RATE_TTL_MS = 30_000;
const PTAX_TTL_MS = 10 * 60_000;

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};
/** Barreira contra dado corrompido: o dólar em reais jamais estará fora desta faixa. */
const sane = (v: number | null): v is number => v !== null && v > 0.5 && v < 100;

const memo = new Map<string, { at: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;
  const p = fn()
    .then((v) => {
      memo.set(key, { at: Date.now(), value: v });
      return v;
    })
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ------------------------------ AwesomeAPI ------------------------------ */

interface AwesomeQuote {
  bid: number;
  ask: number | null;
  high: number | null;
  low: number | null;
  pctChange: number | null;
  quotedAt: string;
}

async function fetchAwesome(): Promise<AwesomeQuote> {
  const key = process.env["AWESOMEAPI_KEY"]?.trim();
  const json = (await getJson(AWESOME_URL, key ? { "x-api-key": key } : {})) as Row;
  const q = (json["USDBRL"] ?? null) as Row | null;
  const bid = num(q?.["bid"]);
  if (!q || !sane(bid)) throw new Error("resposta sem cotação válida");

  // `timestamp` (segundos Unix) é inequívoco; `create_date` vem no horário de Brasília.
  const ts = num(q["timestamp"]);
  let quotedAt = new Date().toISOString();
  if (ts && ts > 1_000_000_000) quotedAt = new Date(ts * 1000).toISOString();
  else if (typeof q["create_date"] === "string") {
    const d = new Date(`${q["create_date"].replace(" ", "T")}-03:00`);
    if (!Number.isNaN(d.getTime())) quotedAt = d.toISOString();
  }
  const ask = num(q["ask"]);
  return {
    bid,
    ask: sane(ask) ? ask : null,
    high: sane(num(q["high"])) ? num(q["high"]) : null,
    low: sane(num(q["low"])) ? num(q["low"]) : null,
    pctChange: num(q["pctChange"]),
    quotedAt,
  };
}

/* ------------------------------ PTAX (BCB) ------------------------------ */

interface Ptax {
  buy: number;
  sell: number;
  /** AAAA-MM-DD do boletim */
  date: string;
  /** Variação % sobre o fechamento anterior, quando houver. */
  pctChange: number | null;
  quotedAt: string;
}

const mdY = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}-${d.getUTCFullYear()}`;

async function fetchPtax(): Promise<Ptax> {
  const end = new Date();
  const start = new Date(end.getTime() - 10 * 86_400_000); // cobre fins de semana e feriados
  // Sintaxe OData do BCB: aspas simples (%27) e datas no formato MM-DD-AAAA.
  const url =
    `${BCB_BASE}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial=%27${mdY(start)}%27&@dataFinalCotacao=%27${mdY(end)}%27` +
    `&$orderby=dataHoraCotacao%20desc&$top=2&$format=json` +
    `&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;
  const json = (await getJson(url)) as Row;
  const rows = (Array.isArray(json["value"]) ? json["value"] : []) as Row[];
  const last = rows[0];
  const buy = num(last?.["cotacaoCompra"]);
  const sell = num(last?.["cotacaoVenda"]);
  if (!last || !sane(buy) || !sane(sell)) throw new Error("resposta sem PTAX válida");

  const stamp = String(last["dataHoraCotacao"] ?? ""); // "2024-01-02 13:05:50.319" (horário de Brasília)
  const date = stamp.slice(0, 10);
  const parsed = new Date(`${stamp.slice(0, 19).replace(" ", "T")}-03:00`);
  const prevSell = num(rows[1]?.["cotacaoVenda"]);
  return {
    buy,
    sell,
    date,
    pctChange: sane(prevSell) ? ((sell - prevSell) / prevSell) * 100 : null,
    quotedAt: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
  };
}

/* -------------------------------- Público -------------------------------- */

export async function loadUsdBrl(): Promise<UsdBrlRate> {
  const [awesome, ptax] = await Promise.allSettled([
    cached("awesome", RATE_TTL_MS, fetchAwesome),
    cached("ptax", PTAX_TTL_MS, fetchPtax),
  ]);

  const ptaxInfo =
    ptax.status === "fulfilled"
      ? { buy: ptax.value.buy, sell: ptax.value.sell, date: ptax.value.date }
      : null;
  const fetchedAt = new Date().toISOString();

  if (awesome.status === "fulfilled") {
    const a = awesome.value;
    return { source: "awesomeapi", ...a, ptax: ptaxInfo, fetchedAt, note: null };
  }
  if (ptax.status === "fulfilled") {
    const p = ptax.value;
    return {
      source: "ptax",
      bid: p.buy,
      ask: p.sell,
      high: null,
      low: null,
      pctChange: p.pctChange,
      quotedAt: p.quotedAt,
      ptax: ptaxInfo,
      fetchedAt,
      note: "Cotação em tempo real indisponível agora; usando a PTAX oficial do Banco Central (fechamento).",
    };
  }
  throw new Error("Não foi possível obter a cotação do dólar agora. Tente novamente em instantes.");
}
