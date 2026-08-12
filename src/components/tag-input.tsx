import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ui-bits";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

export function TagInput({ value, onChange, suggestions }: Props) {
  const [draft, setDraft] = useState("");

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !value.includes(s))
      .slice(0, 6);
  }, [draft, suggestions, value]);

  const add = (tag: string) => {
    const clean = tag.trim().replace(/^#/, "");
    if (!clean || value.includes(clean)) return;
    onChange([...value, clean]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={draft}
          placeholder="Digite uma palavra-chave e pressione Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
        {matches.length > 0 && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lift">
            {matches.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => add(m)}
                className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                #{m}
              </button>
            ))}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <TagChip key={t} label={t} onRemove={() => onChange(value.filter((x) => x !== t))} />
          ))}
        </div>
      )}
    </div>
  );
}