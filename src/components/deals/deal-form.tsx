"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { EntityPicker } from "@/components/common/entity-picker";
import { Field } from "@/components/common/form-field";
import { applyFieldErrors, FormActions, FormSection } from "@/components/common/form-kit";
import { SelectField } from "@/components/common/select-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveDeal } from "@/lib/actions/deals";
import { safeAction } from "@/lib/client/safe-action";
import { LOST_REASONS, type StageCategory } from "@/lib/domain/labels";
import { expectedRevenue } from "@/lib/domain/money";
import { formatYen } from "@/lib/format";
import { dealSchema, type DealInput } from "@/lib/validation";

type Options = {
  members: { id: string; name: string; isActive: boolean }[];
  stages: { id: string; name: string; category: StageCategory; defaultProbability: number; isActive: boolean }[];
  dealTypes: string[];
};

const toNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[,，円\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** 案件の登録・編集フォーム（ステータスを選ぶと確度が既定値になる。手動で決めた確度は保つ） */
export function DealForm({ id, initial, initialCustomerLabel, options, updatedAt }: {
  id: string | null; initial: DealInput; initialCustomerLabel: string | null; options: Options; updatedAt?: string;
}) {
  const router = useRouter();
  const [customerLabel, setCustomerLabel] = useState(initialCustomerLabel);
  const form = useForm<z.input<typeof dealSchema>, unknown, z.output<typeof dealSchema>>({ resolver: zodResolver(dealSchema), defaultValues: initial });
  const { register, control, formState: { errors, isSubmitting }, setValue, setError } = form;
  const stageId = useWatch({ control: form.control, name: "stage_id" });
  const stage = options.stages.find((s) => s.id === stageId);
  const manual = useWatch({ control: form.control, name: "probability_manual" });
  const probability = toNumber(useWatch({ control: form.control, name: "probability" }));
  const estimated = toNumber(useWatch({ control: form.control, name: "estimated_amount" }));
  const fixed = stage?.category === "won" || stage?.category === "completed" || stage?.category === "lost";

  const onSubmit = form.handleSubmit(async () => {
    const result = await safeAction(() => saveDeal(id, form.getValues(), updatedAt));
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(id ? "案件を更新しました" : "案件を作成しました");
    router.push(`/deals/${result.data?.id ?? id}`);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormSection title="案件">
        <Field label="案件名" htmlFor="title" required error={errors.title?.message}>
          <Input id="title" {...register("title")} placeholder="例：コーポレートサイトのリニューアル" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="顧客" htmlFor="customer_id" required error={errors.customer_id?.message} className="sm:col-span-1">
            <Controller control={control} name="customer_id" render={({ field }) => (
              <EntityPicker id="customer_id" kind="customer" value={field.value} selectedLabel={customerLabel} allowClear={false} invalid={!!errors.customer_id}
                onChange={(v, label) => { field.onChange(v); setCustomerLabel(label); }} placeholder="顧客を検索して選ぶ" />
            )} />
          </Field>
          <Field label="担当者" htmlFor="owner_id" error={errors.owner_id?.message}>
            <Controller control={control} name="owner_id" render={({ field }) => (
              <SelectField id="owner_id" value={field.value ?? ""} onChange={field.onChange} noneLabel="未割当"
                options={options.members.filter((m) => m.isActive || m.id === initial.owner_id).map((m) => ({ value: m.id, label: m.name }))} />
            )} />
          </Field>
          <Field label="案件種別" htmlFor="deal_type" error={errors.deal_type?.message}>
            <Controller control={control} name="deal_type" render={({ field }) => (
              <SelectField id="deal_type" value={field.value ?? ""} onChange={field.onChange} noneLabel="未設定"
                options={[...new Set([...options.dealTypes, ...(initial.deal_type ? [initial.deal_type] : [])])].map((t) => ({ value: t, label: t }))} />
            )} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="ステータスと金額" description="受注見込金額 = 見積金額 × 受注確度。受注は100%、失注は0%に自動でなります">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="ステータス" htmlFor="stage_id" required error={errors.stage_id?.message}>
            <Controller control={control} name="stage_id" render={({ field }) => (
              <SelectField id="stage_id" value={field.value} invalid={!!errors.stage_id}
                onChange={(v) => {
                  field.onChange(v);
                  const s = options.stages.find((x) => x.id === v);
                  if (s && (!manual || s.category !== "open")) setValue("probability", s.defaultProbability);
                }}
                options={options.stages.filter((s) => s.isActive || s.id === initial.stage_id).map((s) => ({ value: s.id, label: `${s.name}（${s.defaultProbability}%）` }))} />
            )} />
          </Field>
          <Field label="見積金額（税抜・円）" htmlFor="estimated_amount" required error={errors.estimated_amount?.message}>
            <Input id="estimated_amount" inputMode="numeric" {...register("estimated_amount")} className="text-right tabular" />
          </Field>
          <Field label="受注確度（%）" htmlFor="probability" required error={errors.probability?.message}>
            <div className="flex items-center gap-2">
              <Input id="probability" type="number" min={0} max={100} step={5} {...register("probability")} readOnly={!manual || fixed} aria-readonly={!manual || fixed} className="w-24 text-right tabular read-only:bg-muted read-only:text-muted-foreground" />
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" disabled={fixed} {...register("probability_manual", {
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => { if (!e.target.checked && stage) setValue("probability", stage.defaultProbability); },
                })} />
                手動で決める
              </label>
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg bg-muted/60 px-4 py-3">
          <span className="text-sm text-muted-foreground">受注見込金額</span>
          <span className="text-xl font-bold tabular">{formatYen(expectedRevenue(estimated, fixed ? (stage?.category === "lost" ? 0 : 100) : probability))}</span>
          <span className="text-xs text-muted-foreground tabular">{formatYen(estimated)} × {fixed ? (stage?.category === "lost" ? 0 : 100) : probability}%</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="受注金額（税抜・円）" htmlFor="actual_amount" error={errors.actual_amount?.message} hint="空なら受注時に見積金額を使います">
            <Input id="actual_amount" inputMode="numeric" {...register("actual_amount")} className="text-right tabular" />
          </Field>
          {stage?.category === "lost" && (
            <Field label="失注理由" htmlFor="lost_reason" required error={errors.lost_reason?.message}>
              <Controller control={control} name="lost_reason" render={({ field }) => (
                <SelectField id="lost_reason" value={field.value ?? ""} onChange={field.onChange} options={LOST_REASONS.map((r) => ({ value: r, label: r }))} />
              )} />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection title="日程">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="開始日" htmlFor="started_on" error={errors.started_on?.message}><Input id="started_on" type="date" {...register("started_on")} /></Field>
          <Field label="見積提出日" htmlFor="quote_submitted_on" error={errors.quote_submitted_on?.message}><Input id="quote_submitted_on" type="date" {...register("quote_submitted_on")} /></Field>
          <Field label="受注予定日" htmlFor="expected_close_on" error={errors.expected_close_on?.message}><Input id="expected_close_on" type="date" {...register("expected_close_on")} /></Field>
          <Field label="完了予定日" htmlFor="expected_complete_on" error={errors.expected_complete_on?.message}><Input id="expected_complete_on" type="date" {...register("expected_complete_on")} /></Field>
          <Field label="受注日・失注日" htmlFor="closed_on" error={errors.closed_on?.message} hint="空ならステータス変更日"><Input id="closed_on" type="date" {...register("closed_on")} /></Field>
          <Field label="売上計上日" htmlFor="revenue_on" error={errors.revenue_on?.message} hint="空なら完了日・受注日"><Input id="revenue_on" type="date" {...register("revenue_on")} /></Field>
          <Field label="次回フォロー日" htmlFor="next_follow_up_on" error={errors.next_follow_up_on?.message}><Input id="next_follow_up_on" type="date" {...register("next_follow_up_on")} /></Field>
        </div>
        <Field label="メモ" htmlFor="memo" error={errors.memo?.message}><Textarea id="memo" rows={4} {...register("memo")} /></Field>
      </FormSection>

      <FormActions busy={isSubmitting} submitLabel={id ? "更新する" : "作成する"} onCancel={() => router.back()} />
    </form>
  );
}
