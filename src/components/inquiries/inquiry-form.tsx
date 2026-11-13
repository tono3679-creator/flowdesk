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
import { saveInquiry } from "@/lib/actions/inquiries";
import { safeAction } from "@/lib/client/safe-action";
import { EDITABLE_INQUIRY_STATUSES, INQUIRY_STATUS_LABEL, PRIORITIES, type OrgRole, type PriorityLabels } from "@/lib/domain/labels";
import { inquirySchema, type InquiryInput } from "@/lib/validation";

type Options = {
  members: { id: string; name: string; isActive: boolean }[];
  sources: { id: string; name: string; isActive: boolean }[];
  categories: string[];
  priorityLabels: PriorityLabels;
  currentUserId: string;
  role: OrgRole;
};

/** 問い合わせの登録・編集フォーム */
export function InquiryForm({
  id, initial, initialCustomerLabel, options, converted,
}: { id: string | null; initial: InquiryInput; initialCustomerLabel: string | null; options: Options; converted?: boolean }) {
  const router = useRouter();
  const [customerLabel, setCustomerLabel] = useState(initialCustomerLabel);
  const form = useForm<z.input<typeof inquirySchema>, unknown, z.output<typeof inquirySchema>>({
    resolver: zodResolver(inquirySchema),
    defaultValues: initial,
  });
  const { register, control, formState: { errors, isSubmitting }, setError } = form;
  const customerId = useWatch({ control: form.control, name: "customer_id" });
  const isManager = options.role !== "member";
  // 一般担当者は「自分」か「未割当」だけ選べる（担当者の変更はマネージャー以上）
  const ownerOptions = options.members
    .filter((m) => m.isActive || m.id === initial.owner_id)
    .map((m) => ({ value: m.id, label: m.name, disabled: !isManager && m.id !== options.currentUserId && m.id !== initial.owner_id }));

  const onSubmit = form.handleSubmit(async () => {
    const result = await safeAction(() => saveInquiry(id, form.getValues()));
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(id ? "問い合わせを更新しました" : "問い合わせを登録しました");
    router.push(`/inquiries/${result.data?.id ?? id}`);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormSection title="受付" description="いつ・どこから・どんな問い合わせが来たか">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="受付日時" htmlFor="received_at" required error={errors.received_at?.message}>
            <Input id="received_at" type="datetime-local" {...register("received_at")} aria-invalid={!!errors.received_at} />
          </Field>
          <Field label="問い合わせ経路" htmlFor="source_id" error={errors.source_id?.message}>
            <Controller control={control} name="source_id" render={({ field }) => (
              <SelectField id="source_id" value={field.value ?? ""} onChange={field.onChange} noneLabel="未設定"
                options={options.sources.filter((s) => s.isActive || s.id === initial.source_id).map((s) => ({ value: s.id, label: s.name }))} />
            )} />
          </Field>
          <Field label="問い合わせ種別" htmlFor="category" error={errors.category?.message}>
            <Controller control={control} name="category" render={({ field }) => (
              <SelectField id="category" value={field.value ?? ""} onChange={field.onChange} noneLabel="未設定"
                options={[...new Set([...options.categories, ...(initial.category ? [initial.category] : [])])].map((c) => ({ value: c, label: c }))} />
            )} />
          </Field>
        </div>
        <Field label="件名" htmlFor="title" required error={errors.title?.message}>
          <Input id="title" {...register("title")} placeholder="例：コーポレートサイトのリニューアル" aria-invalid={!!errors.title} />
        </Field>
        <Field label="問い合わせ内容" htmlFor="content" error={errors.content?.message}>
          <Textarea id="content" rows={5} {...register("content")} placeholder="お客様からの問い合わせ内容・電話のメモなど" />
        </Field>
      </FormSection>

      <FormSection title="顧客" description="既存の顧客を選ぶか、連絡先を入力します。案件化するときに顧客として登録されます">
        <Field label="既存の顧客" htmlFor="customer_id" error={errors.customer_id?.message}>
          <Controller control={control} name="customer_id" render={({ field }) => (
            <EntityPicker id="customer_id" kind="customer" value={field.value ?? ""} selectedLabel={customerLabel}
              onChange={(v, label) => { field.onChange(v); setCustomerLabel(label); }} placeholder="顧客を検索して選ぶ（任意）" />
          )} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="会社名" htmlFor="company_name" error={errors.company_name?.message}>
            <Input id="company_name" {...register("company_name")} autoComplete="organization" />
          </Field>
          <Field label="氏名" htmlFor="contact_name" error={errors.contact_name?.message}>
            <Input id="contact_name" {...register("contact_name")} autoComplete="name" />
          </Field>
          <Field label="電話番号" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" inputMode="tel" {...register("phone")} autoComplete="tel" />
          </Field>
          <Field label="メールアドレス" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" inputMode="email" {...register("email")} autoComplete="email" />
          </Field>
        </div>
        {!customerId && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register("create_customer")} />
            この連絡先を顧客としても登録する
          </label>
        )}
      </FormSection>

      <FormSection title="対応" description="誰が・いつまでに対応するか">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="担当者" htmlFor="owner_id" error={errors.owner_id?.message} hint={isManager ? undefined : "他のメンバーへの割り当てはマネージャーが行います"}>
            <Controller control={control} name="owner_id" render={({ field }) => (
              <SelectField id="owner_id" value={field.value ?? ""} onChange={field.onChange} noneLabel="未割当" options={ownerOptions} />
            )} />
          </Field>
          <Field label="優先度" htmlFor="priority" required error={errors.priority?.message}>
            <Controller control={control} name="priority" render={({ field }) => (
              <SelectField id="priority" value={field.value} onChange={field.onChange} options={PRIORITIES.map((p) => ({ value: p, label: options.priorityLabels[p] }))} />
            )} />
          </Field>
          <Field label="ステータス" htmlFor="status" required error={errors.status?.message} hint={converted ? "案件化済みのため変更できません" : undefined}>
            <Controller control={control} name="status" render={({ field }) => (
              <SelectField id="status" value={field.value} onChange={field.onChange} disabled={converted}
                options={EDITABLE_INQUIRY_STATUSES.map((s) => ({ value: s, label: INQUIRY_STATUS_LABEL[s] }))} />
            )} />
          </Field>
          <Field label="次回対応予定日" htmlFor="next_action_on" error={errors.next_action_on?.message}>
            <Input id="next_action_on" type="date" {...register("next_action_on")} />
          </Field>
        </div>
        <Field label="メモ" htmlFor="memo" error={errors.memo?.message}>
          <Textarea id="memo" rows={3} {...register("memo")} />
        </Field>
      </FormSection>

      <FormActions busy={isSubmitting} submitLabel={id ? "更新する" : "登録する"} onCancel={() => router.back()} />
    </form>
  );
}
