/** Cotação USD → BRL (compartilhado entre servidor e cliente). */
export interface UsdBrlRate {
  /** Fonte usada como taxa principal. */
  source: "awesomeapi" | "ptax";
  /** Cotação de COMPRA: quanto o mercado paga por 1 US$ (usada na conversão). */
  bid: number;
  /** Cotação de venda, quando disponível. */
  ask: number | null;
  high: number | null;
  low: number | null;
  /** Variação percentual no dia (ex.: 0.45 = +0,45%). */
  pctChange: number | null;
  /** Momento da cotação (ISO, UTC). */
  quotedAt: string;
  /** Referência oficial do Banco Central (último fechamento PTAX). */
  ptax: { buy: number; sell: number; date: string } | null;
  fetchedAt: string;
  /** Aviso (ex.: fonte principal indisponível, usando PTAX). */
  note: string | null;
}
