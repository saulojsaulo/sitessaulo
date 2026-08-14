import { useRef } from "react";
import { Download, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  value?: string | undefined;
  onChange: (dataUrl: string | undefined) => void;
  label?: string;
  aspect?: "wide" | "square";
  fileName?: string;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "imagem";

const toWebp = (src: string, quality = 0.92) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0);
      const out = canvas.toDataURL("image/webp", quality);
      resolve(out.startsWith("data:image/webp") ? out : src);
    };
    img.onerror = () => reject(new Error("load"));
    img.src = src;
  });

export function ImagePicker({
  value,
  onChange,
  label = "Imagem",
  aspect = "wide",
  fileName,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result);
      try {
        onChange(await toWebp(src));
      } catch {
        onChange(src);
      }
    };
    reader.readAsDataURL(file);
  };

  const download = async () => {
    if (!value) return;
    let href = value;
    try {
      href = await toWebp(value);
    } catch {
      /* mantém original */
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = `${slug(fileName ?? label)}.webp`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {value ? (
        <div className="group relative overflow-hidden rounded-xl border">
          <img
            src={value}
            alt={`Pré-visualização de ${label.toLowerCase()}`}
            className={
              aspect === "wide" ? "h-40 w-full object-cover" : "size-24 rounded-xl object-cover"
            }
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
              Trocar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={download}>
              <Download className="size-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange(undefined)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-foreground"
        >
          <ImagePlus className="size-6" />
          Clique para enviar {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}