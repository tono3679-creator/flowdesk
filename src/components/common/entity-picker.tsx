"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPicker, type PickerItem, type PickerKind } from "@/lib/actions/search";
import { cn } from "@/lib/utils";

/**
 * 顧客・案件・問い合わせを、名前で検索して選ぶ入力欄（件数が多くても使えるように、候補はサーバーで探す）。
 * value は ID、selectedLabel は選択済みの表示名。
 */
export function EntityPicker({
  id, kind, value, selectedLabel, onChange, placeholder, invalid, allowClear = true,
}: {
  id?: string; kind: PickerKind; value: string; selectedLabel: string | null; onChange: (id: string, label: string | null) => void;
  placeholder: string; invalid?: boolean; allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchPicker(kind, q);
        if (active) setItems(result);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, open, kind]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex gap-1">
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((v) => !v)}
          className={cn("h-9 flex-1 justify-between px-3 font-normal", !value && "text-muted-foreground", invalid && "border-destructive")}
        >
          <span className="truncate">{value ? (selectedLabel ?? "選択済み") : placeholder}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
        {allowClear && value && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange("", null)} aria-label="選択を外す"><X /></Button>
        )}
      </div>
      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-64 rounded-md border bg-popover p-1 shadow-lg">
          <div className="relative p-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・会社名で検索" className="h-8 pl-8" aria-label="候補を検索" />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {loading && items.length === 0 && (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />検索中…</li>
            )}
            {!loading && items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">見つかりません</li>}
            {items.map((item) => (
              <li key={item.id} role="option" aria-selected={item.id === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(item.id, item.label);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 rounded-sm px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <Check className={cn("mt-0.5 size-4 shrink-0", item.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    {item.sub && <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
