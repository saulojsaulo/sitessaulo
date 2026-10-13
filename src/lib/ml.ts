/**
 * Postagens ML (afiliados Mercado Livre): dados do produto e geração do bloco
 * "meu-plugin/card-mercado-livre" do plugin "Bloco Gutenberg - Card Mercado Livre".
 */
export interface MlProduct {
  title: string;
  price: string;
  oldPrice: string;
  affiliateUrl: string;
  /** URL pública ou data URL (enviada para a biblioteca de mídia ao publicar). */
  image: string;
  freeShipping: boolean;
  /** Descrição e características do produto, usadas na geração do artigo. */
  features: string;
}

export const emptyMl = (): MlProduct => ({
  title: "",
  price: "",
  oldPrice: "",
  affiliateUrl: "",
  image: "",
  freeShipping: true,
  features: "",
});

export const ML_CARD_MARKER = "<!-- CARD_MERCADO_LIVRE -->";
export const ML_BLOCK_NAME = "meu-plugin/card-mercado-livre";

function numericPrice(value: string) {
  if (!value) return 0;
  let cleaned = String(value).replace(/[^\d,.-]/g, "");
  if (cleaned.includes(",")) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export const money = (v: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numericPrice(v));

export function mlDiscount(oldPrice: string, price: string) {
  const o = numericPrice(oldPrice);
  const c = numericPrice(price);
  return o > c && c > 0 ? Math.round((1 - c / o) * 100) : 0;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const css = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(";");

const S = {
  wrapper: { boxSizing: "border-box", width: "100%", maxWidth: "760px", margin: "28px auto", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: "#333333", position: "relative", padding: "2px", borderRadius: "13px", background: "linear-gradient(115deg, #ffb347 0%, #ff7043 28%, #ef4444 52%, #f59e0b 76%, #ffd166 100%)", boxShadow: "0 3px 12px rgba(239, 68, 68, 0.10)" },
  card: { boxSizing: "border-box", display: "flex", flexDirection: "row", alignItems: "center", gap: "20px", width: "100%", padding: "22px 24px 18px", backgroundColor: "#ffffff", borderRadius: "11px", overflowWrap: "anywhere" },
  image: { display: "block", boxSizing: "border-box", flex: "0 0 150px", width: "150px", height: "150px", objectFit: "contain", margin: "0", backgroundColor: "#ffffff" },
  content: { minWidth: "0", flex: "1 1 auto" },
  trending: { position: "absolute", top: "-12px", left: "22px", zIndex: "1", display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 11px", borderRadius: "5px", background: "linear-gradient(90deg, #e84a3c, #f08a24)", color: "#ffffff", fontSize: "10px", lineHeight: "1.3", fontWeight: "800", letterSpacing: "0.45px", boxShadow: "0 2px 5px rgba(190, 55, 35, 0.18)" },
  title: { margin: "0 0 10px", color: "#292929", fontSize: "17px", fontWeight: "600", lineHeight: "1.45", overflowWrap: "anywhere" },
  badges: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "7px", marginBottom: "10px" },
  shipping: { display: "inline-block", padding: "4px 8px", borderRadius: "4px", backgroundColor: "#eaf7ee", color: "#168044", fontSize: "11px", fontWeight: "600" },
  discount: { display: "inline-block", padding: "4px 8px", borderRadius: "4px", backgroundColor: "#fff0f0", color: "#c62828", fontSize: "11px", fontWeight: "700" },
  oldPrice: { margin: "0 0 2px", color: "#929292", fontSize: "13px", textDecoration: "line-through" },
  price: { margin: "0", color: "#222222", fontSize: "27px", fontWeight: "750", lineHeight: "1.3" },
  button: { display: "inline-block", boxSizing: "border-box", maxWidth: "100%", marginTop: "12px", padding: "11px 16px", border: "none", borderRadius: "7px", backgroundColor: "#ffe600", color: "#222222", textAlign: "center", textDecoration: "none", fontSize: "14px", fontWeight: "700", lineHeight: "1.4", cursor: "pointer" },
  disclaimer: { margin: "10px 0 0", color: "#777777", fontSize: "10px", lineHeight: "1.4" },
};

const MEDIA_CSS =
  "@media (max-width: 520px) {.ml-affiliate-card-wrap .ml-affiliate-card { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; padding: 22px 16px 16px !important; }.ml-affiliate-card-wrap .ml-affiliate-card img, .ml-affiliate-card-wrap .ml-affiliate-card > div:first-child { flex: 0 0 auto !important; width: 100% !important; height: 155px !important; }.ml-affiliate-card-wrap .ml-affiliate-card-trending { left: 12px !important; font-size: 9px !important; }}";

/** Markup Gutenberg do bloco (comentário com atributos + HTML salvo pelo plugin). */
export function buildMlCardBlock(p: MlProduct, imageUrl: string, imageId = 0): string {
  const attrs = {
    title: p.title,
    price: p.price,
    oldPrice: p.oldPrice,
    affiliateUrl: p.affiliateUrl,
    imageUrl,
    imageId,
    freeShipping: p.freeShipping,
  };
  const json = JSON.stringify(attrs)
    .replace(/--/g, "\\u002d\\u002d")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  const discount = mlDiscount(p.oldPrice, p.price);
  let url = "";
  try {
    const u = new URL(p.affiliateUrl);
    if (u.protocol === "https:" || u.protocol === "http:") url = u.href;
  } catch {
    url = "";
  }
  const img = imageUrl
    ? `<img src="${esc(imageUrl)}" alt="${esc(p.title || "Imagem do produto")}" loading="lazy" style="${css(S.image)}"/>`
    : "";
  const badges =
    (p.freeShipping ? `<span style="${css(S.shipping)}">✓ Frete grátis</span>` : "") +
    (discount > 0 ? `<span style="${css(S.discount)}">${discount}% OFF</span>` : "");
  const old = numericPrice(p.oldPrice) > 0 ? `<p style="${css(S.oldPrice)}">${money(p.oldPrice)}</p>` : "";
  const btn = url
    ? `<a href="${esc(url)}" target="_blank" rel="nofollow sponsored noopener noreferrer" style="${css(S.button)}">Ver oferta no Mercado Livre →</a>`
    : "";
  const html =
    `<style>${MEDIA_CSS}</style>` +
    `<div style="${css(S.wrapper)}" class="ml-affiliate-card-wrap">` +
    `<div style="${css(S.trending)}" class="ml-affiliate-card-trending"><span aria-hidden="true">↗</span>O MAIS VENDIDO AGORA</div>` +
    `<div class="ml-affiliate-card" style="${css(S.card)}">${img}` +
    `<div style="${css(S.content)}"><h3 style="${css(S.title)}">${esc(p.title || "Nome do produto")}</h3>` +
    `<div style="${css(S.badges)}">${badges}</div>${old}` +
    `<p style="${css(S.price)}">${money(p.price)}</p>${btn}` +
    `<p style="${css(S.disclaimer)}">Preço e disponibilidade podem mudar no site do vendedor.</p></div></div></div>`;
  return `<!-- wp:${ML_BLOCK_NAME} ${json} -->\n${html}\n<!-- /wp:${ML_BLOCK_NAME} -->`;
}

/** Coloca o card no marcador ou, se não houver, no meio do artigo (entre blocos). */
export function insertMlCard(html: string, block: string): string {
  if (html.includes(ML_CARD_MARKER)) return html.replace(ML_CARD_MARKER, block);
  const re = /<\/(p|ul|ol|table)>/gi;
  const ends: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) ends.push(m.index + m[0].length);
  if (ends.length < 2) return `${html}\n${block}`;
  const mid = html.length / 2;
  let best = ends[0]!;
  for (const e of ends) if (Math.abs(e - mid) < Math.abs(best - mid)) best = e;
  // Evita ficar entre um título e seu parágrafo.
  return `${html.slice(0, best)}\n${block}\n${html.slice(best)}`;
}
