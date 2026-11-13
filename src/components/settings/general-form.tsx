"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/form-field";
import { FormSection } from "@/components/common/form-kit";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveSettings } from "@/lib/actions/settings";
import { safeAction } from "@/lib/client/safe-action";
import { INDUSTRIES, PRIORITIES, type Priority } from "@/lib/domain/labels";
import type { SettingsInput } from "@/lib/validation";

type State = Omit<SettingsInput, "inquiry_categories" | "deal_types"> & { inquiry_categories: string; deal_types: string };

/** 会社情報・業種・アラート条件・種別・優先度の表示名（1つのフォーム。section で表示を分ける） */
export function GeneralForm({ initial, section }: { initial: SettingsInput; section: "company" | "alerts" }) {
  const router = useRouter();
  const [v, setV] = useState<State>({ ...initial, inquiry_categories: initial.inquiry_categories.join("\n"), deal_types: initial.deal_types.join("\n") });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof State>(k: K, value: State[K]) => setV((cur) => ({ ...cur, [k]: value }));
  const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await safeAction(() => saveSettings({ ...v, inquiry_categories: lines(v.inquiry_categories), deal_types: lines(v.deal_types) }));
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      return void toast.error(r.error);
    }
    setErrors({});
    toast.success("設定を保存しました");
    router.refresh();
  };

  const num = (k: "unanswered_hours" | "quote_follow_days" | "no_contact_days" | "first_response_target_hours", label: string, unit: string, hint: string) => (
    <Field label={label} htmlFor={k} required error={errors[k]} hint={hint}>
      <div className="flex items-center gap-2">
        <Input id={k} type="number" min={1} className="w-28 text-right tabular" value={String(v[k])} onChange={(e) => set(k, e.target.value)} />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
    </Field>
  );

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      {section === "company" ? (
        <>
          <FormSection title="会社情報">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="会社名" htmlFor="company_name" required error={errors.company_name}>
                <Input id="company_name" value={v.company_name} onChange={(e) => set("company_name", e.target.value)} />
              </Field>
              <Field label="業種" htmlFor="industry" required error={errors.industry}>
                <SelectField id="industry" value={v.industry} onChange={(x) => set("industry", x)}
                  options={[...new Set([...INDUSTRIES, v.industry])].map((x) => ({ value: x, label: x }))} />
              </Field>
              <Field label="タイムゾーン" htmlFor="timezone" hint="日付の区切り（今日・今月）はこのタイムゾーンで判定します">
                <Input id="timezone" value="日本時間（Asia/Tokyo）" readOnly className="bg-muted" />
              </Field>
              <Field label="通貨" htmlFor="currency" hint="金額は円単位の整数で管理します">
                <Input id="currency" value="日本円（JPY）" readOnly className="bg-muted" />
              </Field>
            </div>
          </FormSection>
          <FormSection title="種別" description="1行に1つずつ入力します。上から順に選択肢に表示されます">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="問い合わせ種別" htmlFor="inquiry_categories" error={errors.inquiry_categories}>
                <Textarea id="inquiry_categories" rows={7} value={v.inquiry_categories} onChange={(e) => set("inquiry_categories", e.target.value)} />
              </Field>
              <Field label="案件種別" htmlFor="deal_types" error={errors.deal_types}>
                <Textarea id="deal_types" rows={7} value={v.deal_types} onChange={(e) => set("deal_types", e.target.value)} />
              </Field>
            </div>
          </FormSection>
          <FormSection title="優先度の表示名" description="社内で使っている呼び方に変えられます（並び順は 低 → 緊急 のまま）">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {PRIORITIES.map((p: Priority) => (
                <Field key={p} label={{ low: "低", medium: "中", high: "高", urgent: "緊急" }[p]} htmlFor={`pl_${p}`} error={errors.priority_labels}>
                  <Input id={`pl_${p}`} value={v.priority_labels[p]} maxLength={10} onChange={(e) => set("priority_labels", { ...v.priority_labels, [p]: e.target.value })} />
                </Field>
              ))}
            </div>
          </FormSection>
        </>
      ) : (
        <>
          <FormSection title="対応漏れアラートの条件" description="条件を変えると、ダッシュボード・アラート・案件ボードの表示がすぐに変わります">
            <div className="grid gap-4 sm:grid-cols-2">
              {num("unanswered_hours", "未対応アラート", "時間", "受付からこの時間、対応履歴がない問い合わせ")}
              {num("quote_follow_days", "見積フォロー", "日", "見積提出からこの日数、結論が出ていない案件")}
              {num("no_contact_days", "長期未接触", "日", "最後の接触からこの日数がたった進行中の案件")}
              {num("first_response_target_hours", "初回対応の目標", "時間", "初回対応率（目標時間内に対応できた割合）の基準")}
            </div>
          </FormSection>
          <FormSection title="自動で作るタスク">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={v.auto_tasks} onChange={(e) => set("auto_tasks", e.target.checked)} />
              <span>案件化したときに「ヒアリングの日程調整」、見積を提出したときに「見積フォロー」のタスクを自動で作る</span>
            </label>
          </FormSection>
        </>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}保存する</Button>
      </div>
    </form>
  );
}
