const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl4 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const usd2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" });

export const brl = (v: number) => brl2.format(v);
/** Cotações costumam ter 4 casas. */
export const brlRate = (v: number) => brl4.format(v);
export const usdMoney = (v: number) => usd2.format(v);
export const signedPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")}%`;

/**
 * Lê um valor digitado em formato brasileiro ou internacional:
 *  "1.234,56" → 1234.56 · "1234.56" → 1234.56 · "1.234" → 1234 · "10,5" → 10.5
 * Retorna null para vazio/ inválido/ negativo.
 */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/[^\d.,]/g, "");
  if (!s) return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  // Só pontos: "1.234" ou "1.234.567" são milhares; "12.5" / "4.02" são decimais.
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  else normalized = s;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
