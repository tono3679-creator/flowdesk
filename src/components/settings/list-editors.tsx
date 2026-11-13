"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TagChip } from "@/components/common/badges";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSources, saveStages, saveTags } from "@/lib/actions/settings";
import { safeAction } from "@/lib/client/safe-action";
import { STAGE_CATEGORIES, STAGE_CATEGORY_LABEL, TAG_COLORS, type StageCategory, type TagColor } from "@/lib/domain/labels";

type WithKey<T> = T & { key: string };
let seq = 0;
const newKey = () => `new-${++seq}`;

function useList<T>(initial: T[]) {
  const [items, setItems] = useState<WithKey<T>[]>(initial.map((x) => ({ ...x, key: newKey() })));
  const update = (key: string, patch: Partial<T>) => setItems((cur) => cur.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (index: number, dir: -1 | 1) => setItems((cur) => {
    const next = [...cur];
    const j = index + dir;
    if (j < 0 || j >= next.length) return cur;
    [next[index], next[j]] = [next[j], next[index]];
    return next;
  });
  const remove = (key: string) => setItems((cur) => cur.filter((x) => x.key !== key));
  const add = (item: T) => setItems((cur) => [...cur, { ...item, key: newKey() }]);
  return { items, update, move, remove, add };
}

function Shell({ children, onSave, busy, onAdd, addLabel }: { children: React.ReactNode; onSave: () => void; busy: boolean; onAdd: () => void; addLabel: string }) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="relative min-w-0 overflow-x-auto rounded-xl border bg-card">{children}</div>
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" onClick={onAdd}><Plus />{addLabel}</Button>
        <Button type="button" onClick={onSave} disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}保存する</Button>
      </div>
    </div>
  );
}

function RowTools({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (d: -1 | 1) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`${label}を上へ`}><ArrowUp /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`${label}を下へ`}><ArrowDown /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={onRemove} aria-label={`${label}を削除`}><Trash2 /></Button>
    </div>
  );
}

function useSave(fn: () => Promise<{ ok: boolean; error?: string }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    save: async () => {
      setBusy(true);
      const r = await safeAction(fn);
      setBusy(false);
      if (!r.ok) return void toast.error(r.error);
      toast.success("保存しました");
      router.refresh();
    },
  };
}

type StageItem = { id: string | null; name: string; category: StageCategory; default_probability: number | string; board_column: string; marks_quote_submitted: boolean; is_active: boolean };

/** 案件ステータスと既定の受注確度 */
export function StageEditor({ initial }: { initial: StageItem[] }) {
  const list = useList(initial);
  const { busy, save } = useSave(() => saveStages(list.items.map(({ key: _key, ...s }) => s)));
  return (
    <Shell onSave={save} busy={busy} addLabel="ステータスを追加"
      onAdd={() => list.add({ id: null, name: "", category: "open", default_probability: 50, board_column: "", marks_quote_submitted: false, is_active: true })}>
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr><th className="px-3 py-2 text-left">ステータス名</th><th className="px-3 py-2 text-left">分類</th><th className="px-3 py-2 text-left">既定の確度</th><th className="px-3 py-2 text-left">ボードの列</th><th className="px-3 py-2">見積提出</th><th className="px-3 py-2">有効</th><th className="px-3 py-2"><span className="sr-only">操作</span></th></tr>
        </thead>
        <tbody className="divide-y">
          {list.items.map((s, i) => {
            const fixed = s.category === "won" || s.category === "completed" ? 100 : s.category === "lost" ? 0 : null;
            return (
              <tr key={s.key}>
                <td className="px-3 py-2"><Input value={s.name} maxLength={30} onChange={(e) => list.update(s.key, { name: e.target.value })} aria-label="ステータス名" /></td>
                <td className="px-3 py-2 w-36">
                  <SelectField value={s.category} onChange={(v) => list.update(s.key, { category: v as StageCategory })} ariaLabel="分類"
                    options={STAGE_CATEGORIES.map((c) => ({ value: c, label: STAGE_CATEGORY_LABEL[c] }))} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={100} step={5} className="w-20 text-right tabular" aria-label="既定の確度"
                      value={fixed ?? String(s.default_probability)} readOnly={fixed !== null} onChange={(e) => list.update(s.key, { default_probability: e.target.value })} />%
                  </div>
                </td>
                <td className="px-3 py-2 w-36"><Input value={s.board_column} maxLength={20} placeholder="（表示しない）" onChange={(e) => list.update(s.key, { board_column: e.target.value })} aria-label="ボードの列" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={s.marks_quote_submitted} onChange={(e) => list.update(s.key, { marks_quote_submitted: e.target.checked })} aria-label="このステータスにしたら見積提出日を記録" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={s.is_active} onChange={(e) => list.update(s.key, { is_active: e.target.checked })} aria-label="有効" /></td>
                <td className="px-3 py-2"><RowTools index={i} count={list.items.length} onMove={(d) => list.move(i, d)} onRemove={() => list.remove(s.key)} label={s.name || "ステータス"} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">受注・完了は100%、失注は0%に固定です。「見積提出」にチェックしたステータスにすると、見積提出日を自動で記録し見積フォローの対象になります。ボードの列が同じステータスは、案件ボードで1列にまとまります。</p>
    </Shell>
  );
}

type SourceItem = { id: string | null; name: string; is_active: boolean };
export function SourceEditor({ initial }: { initial: SourceItem[] }) {
  const list = useList(initial);
  const { busy, save } = useSave(() => saveSources(list.items.map(({ key: _key, ...s }) => s)));
  return (
    <Shell onSave={save} busy={busy} addLabel="経路を追加" onAdd={() => list.add({ id: null, name: "", is_active: true })}>
      <ul className="divide-y">
        {list.items.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3 px-3 py-2">
            <Input value={s.name} maxLength={30} onChange={(e) => list.update(s.key, { name: e.target.value })} aria-label="経路名" className="max-w-sm" />
            <label className="flex items-center gap-1.5 text-sm whitespace-nowrap"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={s.is_active} onChange={(e) => list.update(s.key, { is_active: e.target.checked })} />有効</label>
            <div className="ml-auto"><RowTools index={i} count={list.items.length} onMove={(d) => list.move(i, d)} onRemove={() => list.remove(s.key)} label={s.name || "経路"} /></div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

type TagItem = { id: string | null; name: string; color: TagColor };
export function TagEditor({ initial }: { initial: TagItem[] }) {
  const list = useList(initial);
  const { busy, save } = useSave(() => saveTags(list.items.map(({ key: _key, ...s }) => s)));
  const COLOR_LABEL: Record<TagColor, string> = { slate: "グレー", blue: "青", green: "緑", amber: "黄", red: "赤", violet: "紫", teal: "青緑", pink: "ピンク" };
  return (
    <Shell onSave={save} busy={busy} addLabel="タグを追加" onAdd={() => list.add({ id: null, name: "", color: "blue" })}>
      <ul className="divide-y">
        {list.items.map((s, i) => (
          <li key={s.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <Input value={s.name} maxLength={20} onChange={(e) => list.update(s.key, { name: e.target.value })} aria-label="タグ名" className="max-w-56" />
            <SelectField value={s.color} onChange={(v) => list.update(s.key, { color: v as TagColor })} ariaLabel="色" className="w-28"
              options={TAG_COLORS.map((c) => ({ value: c, label: COLOR_LABEL[c] }))} />
            {s.name && <TagChip name={s.name} color={s.color} />}
            <div className="ml-auto"><RowTools index={i} count={list.items.length} onMove={(d) => list.move(i, d)} onRemove={() => list.remove(s.key)} label={s.name || "タグ"} /></div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
