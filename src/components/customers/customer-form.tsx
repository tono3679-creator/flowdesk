"use client";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { TagChip } from "@/components/common/badges";
import { Field } from "@/components/common/form-field";
import { applyFieldErrors, FormActions, FormSection } from "@/components/common/form-kit";
import { SelectField } from "@/components/common/select-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCustomer } from "@/lib/actions/customers";
import { safeAction } from "@/lib/client/safe-action";
import { CUSTOMER_RANKS, CUSTOMER_TYPES, CUSTOMER_TYPE_LABEL, type TagColor } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";
import { customerSchema, type CustomerInput } from "@/lib/validation";

type Options = { members: { id: string; name: string; isActive: boolean }[]; tags: { id: string; name: string; color: TagColor }[] };

const RANK_HINT: Record<string, string> = { S: "最重要", A: "重要", B: "通常", C: "低" };

/** 顧客の登録・編集フォーム */
export function CustomerForm({ id, initial, options }: { id: string | null; initial: CustomerInput; options: Options }) {
  const router = useRouter();
  const form = useForm<z.input<typeof customerSchema>, unknown, z.output<typeof customerSchema>>({ resolver: zodResolver(customerSchema), defaultValues: initial });
  const { register, control, formState: { errors, isSubmitting }, setError } = form;
  const type = useWatch({ control: form.control, name: "type" });

  const onSubmit = form.handleSubmit(async () => {
    const result = await safeAction(() => saveCustomer(id, form.getValues()));
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(id ? "顧客を更新しました" : "顧客を登録しました");
    router.push(`/customers/${result.data?.id ?? id}`);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormSection title="基本情報">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">法人／個人<span className="ml-1 text-xs text-destructive">必須</span></legend>
          <div className="flex gap-2">
            {CUSTOMER_TYPES.map((t) => (
              <label key={t} className={cn("flex h-9 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm", type === t && "border-primary bg-primary/10 font-semibold")}>
                <input type="radio" value={t} {...register("type")} className="accent-[var(--primary)]" />
                {CUSTOMER_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="会社名" htmlFor="company_name" required={type === "corporate"} error={errors.company_name?.message}>
            <Input id="company_name" {...register("company_name")} autoComplete="organization" placeholder="例：株式会社サンプル" />
          </Field>
          <Field label="氏名（担当者名）" htmlFor="name" required={type === "individual"} error={errors.name?.message}>
            <Input id="name" {...register("name")} autoComplete="name" placeholder="例：山田 太郎" />
          </Field>
          <Field label="部署" htmlFor="department" error={errors.department?.message}><Input id="department" {...register("department")} /></Field>
          <Field label="役職" htmlFor="position" error={errors.position?.message}><Input id="position" {...register("position")} /></Field>
        </div>
      </FormSection>

      <FormSection title="連絡先">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="電話番号" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" inputMode="tel" {...register("phone")} autoComplete="tel" placeholder="例：03-1234-5678" />
          </Field>
          <Field label="メールアドレス" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" inputMode="email" {...register("email")} autoComplete="email" />
          </Field>
        </div>
        <Field label="住所" htmlFor="address" error={errors.address?.message}><Input id="address" {...register("address")} autoComplete="street-address" /></Field>
      </FormSection>

      <FormSection title="管理">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="担当者" htmlFor="owner_id" error={errors.owner_id?.message}>
            <Controller control={control} name="owner_id" render={({ field }) => (
              <SelectField id="owner_id" value={field.value ?? ""} onChange={field.onChange} noneLabel="未割当"
                options={options.members.filter((m) => m.isActive || m.id === initial.owner_id).map((m) => ({ value: m.id, label: m.name }))} />
            )} />
          </Field>
          <Field label="顧客ランク" htmlFor="rank" error={errors.rank?.message}>
            <Controller control={control} name="rank" render={({ field }) => (
              <SelectField id="rank" value={field.value ?? ""} onChange={field.onChange} noneLabel="未設定"
                options={CUSTOMER_RANKS.map((r) => ({ value: r, label: `${r}（${RANK_HINT[r]}）` }))} />
            )} />
          </Field>
        </div>
        <Controller control={control} name="tag_ids" render={({ field }) => (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">タグ</legend>
            {options.tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">タグは設定画面で作成できます</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {options.tags.map((t) => {
                  const on = field.value.includes(t.id);
                  return (
                    <button key={t.id} type="button" aria-pressed={on}
                      onClick={() => field.onChange(on ? field.value.filter((v) => v !== t.id) : [...field.value, t.id])}
                      className={cn("rounded-md ring-offset-2 transition-opacity", on ? "ring-2 ring-primary" : "opacity-55 hover:opacity-100")}>
                      <TagChip name={t.name} color={t.color} className="px-2 py-1 text-xs" />
                    </button>
                  );
                })}
              </div>
            )}
            {errors.tag_ids?.message && <p className="mt-1 text-xs text-destructive">{errors.tag_ids.message}</p>}
          </fieldset>
        )} />
        <Field label="メモ" htmlFor="memo" error={errors.memo?.message}><Textarea id="memo" rows={4} {...register("memo")} /></Field>
      </FormSection>

      <FormActions busy={isSubmitting} submitLabel={id ? "更新する" : "登録する"} onCancel={() => router.back()} />
    </form>
  );
}
