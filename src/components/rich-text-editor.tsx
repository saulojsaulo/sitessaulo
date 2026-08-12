import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Link2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

function stats(html: string) {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    chars: text.length,
    words: text ? text.split(" ").length : 0,
    minutes: Math.max(1, Math.round((text ? text.split(" ").length : 0) / 200)),
  };
}

export function RichTextEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  };

  const tools = [
    { icon: Bold, label: "Negrito", run: () => exec("bold") },
    { icon: Italic, label: "Itálico", run: () => exec("italic") },
    { icon: Underline, label: "Sublinhado", run: () => exec("underline") },
    { icon: Heading2, label: "Título", run: () => exec("formatBlock", "<h2>") },
    { icon: Quote, label: "Citação", run: () => exec("formatBlock", "<blockquote>") },
    { icon: List, label: "Lista", run: () => exec("insertUnorderedList") },
    { icon: ListOrdered, label: "Lista numerada", run: () => exec("insertOrderedList") },
    {
      icon: Link2,
      label: "Link",
      run: () => {
        const url = window.prompt("URL do link");
        if (url) exec("createLink", url);
      },
    },
    { icon: Undo2, label: "Desfazer", run: () => exec("undo") },
  ];

  const s = stats(value);

  return (
    <div
      className="overflow-hidden rounded-xl border bg-background transition-shadow"
      style={focused ? { boxShadow: "0 0 0 2px var(--color-ring)" } : undefined}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
        {tools.map((t) => (
          <Button
            key={t.label}
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            title={t.label}
            aria-label={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
          >
            <t.icon className="size-4" />
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Conteúdo da postagem"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="rich-content min-h-56 px-4 py-3 text-sm outline-none"
      />
      <div className="flex items-center justify-end gap-4 border-t bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
        <span>{s.words} palavras</span>
        <span>{s.chars} caracteres</span>
        <span>~{s.minutes} min de leitura</span>
      </div>
    </div>
  );
}