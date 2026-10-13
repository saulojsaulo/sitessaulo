import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/image-picker";
import { buildMlCardBlock, type MlProduct } from "@/lib/ml";

/** Campos do plugin "Bloco Gutenberg - Card Mercado Livre" + características. */
export function MlProductForm({
  value,
  onChange,
  fileName,
}: {
  value: MlProduct;
  onChange: (v: MlProduct) => void;
  fileName: string;
}) {
  const set = (patch: Partial<MlProduct>) => onChange({ ...value, ...patch });
  const isData = value.image.startsWith("data:");
  // HTML gerado localmente com todos os campos escapados.
  const preview = buildMlCardBlock(value, value.image)
    .replace(/<!--[\s\S]*?-->/g, "");

  return (
    <div className="surface space-y-4 rounded-lg p-4">
      <h3 className="font-semibold">Card Mercado Livre</h3>
      <div className="space-y-2">
        <Label htmlFor="ml-title">Título do produto</Label>
        <Textarea
          id="ml-title"
          rows={2}
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Nome completo do produto"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ml-price">Preço atual (R$)</Label>
          <Input id="ml-price" inputMode="decimal" value={value.price} onChange={(e) => set({ price: e.target.value })} placeholder="94,05" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ml-old">Preço antigo (R$)</Label>
          <Input id="ml-old" inputMode="decimal" value={value.oldPrice} onChange={(e) => set({ oldPrice: e.target.value })} placeholder="99,00" />
          <p className="text-xs text-muted-foreground">Opcional; usado para calcular o desconto.</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ml-link">Link de afiliado</Label>
        <Input id="ml-link" type="url" value={value.affiliateUrl} onChange={(e) => set({ affiliateUrl: e.target.value.trim() })} placeholder="https://meli.la/..." />
      </div>
      <div className="space-y-2">
        <Label>Imagem do produto</Label>
        <Input
          value={isData ? "" : value.image}
          onChange={(e) => set({ image: e.target.value.trim() })}
          placeholder={isData ? "Imagem enviada do computador" : "Cole a URL da imagem ou envie um arquivo abaixo"}
          aria-label="URL da imagem do produto"
        />
        <ImagePicker
          value={value.image || undefined}
          label="produto"
          fileName={`${fileName || "produto"}-produto`}
          onChange={(image) => set({ image: image ?? "" })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={value.freeShipping} onCheckedChange={(v) => set({ freeShipping: v })} />
        Exibir etiqueta “Frete grátis”
      </label>
      <div className="space-y-2">
        <Label htmlFor="ml-features">Descrição e características do produto</Label>
        <Textarea
          id="ml-features"
          rows={6}
          value={value.features}
          onChange={(e) => set({ features: e.target.value })}
          placeholder={"Material: ...\nTamanhos: ...\nIndicado para: ...\nDiferenciais: ..."}
        />
        <p className="text-xs text-muted-foreground">
          Usado pela IA para escrever o artigo. Informe só dados reais do anúncio.
        </p>
      </div>
      <div className="rounded-lg border border-dashed bg-muted/40 p-4">
        <p className="mb-2 text-center text-xs text-muted-foreground">PRÉVIA DO PRODUTO</p>
        <div dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
    </div>
  );
}
