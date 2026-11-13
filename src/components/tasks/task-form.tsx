"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { EntityPicker } from "@/components/common/entity-picker";
import { Field } from "@/components/common/form-field";
import { applyFieldErrors, FormActions, FormSection } from "@/components/common/form-kit";
import { SelectField } from "@/components/common/select-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveTask } from "@/lib/actions/tasks";
import { safeAction } from "@/lib/client/safe-action";
import { PRIORITIES, TASK_STATUSES, TASK_STATUS_LABEL, type PriorityLabels } from "@/lib/domain/labels";
import { taskSchema, type TaskInput } from "@/lib/validation";

type Labels = { customer: string | null; deal: string | null; inquiry: string | null };

/** タスクの登録・編集フォーム */
export function TaskForm({ id, initial, labels: initialLabels, members, priorityLabels }: {
  id: string | null; initial: TaskInput; labels: Labels; members: { id: string; name: string; isActive: boolean }[]; priorityLabels: PriorityLabels;
}) {
  const router = useRouter();
  const [labels, setLabels] = useState(initialLabels);
  const form = useForm<z.input<typeof taskSchema>, unknown, z.output<typeof taskSchema>>({ resolver: zodResolver(taskSchema), defaultValues: initial });
  const { register, control, formState: { errors, isSubmitting }, setError } = form;

  const onSubmit = form.handleSubmit(async () => {
    const result = await safeAction(() => saveTask(id, form.getValues()));
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(id ? "タスクを更新しました" : "タスクを追加しました");
    router.back();
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormSection title="タスク">
        <Field label="タイトル" htmlFor="title" required error={errors.title?.message}>
          <Input id="title" {...register("title")} placeholder="例：見積書を送る" />
        </Field>
        <Field label="内容" htmlFor="description" error={errors.description?.message}><Textarea id="description" rows={3} {...register("description")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="担当者" htmlFor="assignee_id" error={errors.assignee_id?.message}>
            <Controller control={control} name="assignee_id" render={({ field }) => (
              <SelectField id="assignee_id" value={field.value ?? ""} onChange={field.onChange} noneLabel="未割当"
                options={members.filter((m) => m.isActive || m.id === initial.assignee_id).map((m) => ({ value: m.id, label: m.name }))} />
            )} />
          </Field>
          <Field label="優先度" htmlFor="priority" required error={errors.priority?.message}>
            <Controller control={control} name="priority" render={({ field }) => (
              <SelectField id="priority" value={field.value} onChange={field.onChange} options={PRIORITIES.map((p) => ({ value: p, label: priorityLabels[p] }))} />
            )} />
          </Field>
          <Field label="ステータス" htmlFor="status" required error={errors.status?.message}>
            <Controller control={control} name="status" render={({ field }) => (
              <SelectField id="status" value={field.value} onChange={field.onChange} options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))} />
            )} />
          </Field>
          <Field label="開始日" htmlFor="start_on" error={errors.start_on?.message}><Input id="start_on" type="date" {...register("start_on")} /></Field>
          <Field label="期限" htmlFor="due_on" error={errors.due_on?.message}><Input id="due_on" type="date" {...register("due_on")} /></Field>
        </div>
      </FormSection>
      <FormSection title="関連" description="顧客・案件・問い合わせに紐づけると、それぞれの詳細画面にも表示されます">
        <div className="grid gap-4 lg:grid-cols-3">
          {(["customer", "deal", "inquiry"] as const).map((kind) => {
            const name = `${kind}_id` as const;
            const label = { customer: "顧客", deal: "案件", inquiry: "問い合わせ" }[kind];
            return (
              <Field key={kind} label={label} htmlFor={name} error={errors[name]?.message}>
                <Controller control={control} name={name} render={({ field }) => (
                  <EntityPicker id={name} kind={kind} value={field.value ?? ""} selectedLabel={labels[kind]} placeholder={`${label}を検索（任意）`}
                    onChange={(v, l) => { field.onChange(v); setLabels((cur) => ({ ...cur, [kind]: l })); }} />
                )} />
              </Field>
            );
          })}
        </div>
        <Field label="メモ" htmlFor="memo" error={errors.memo?.message}><Textarea id="memo" rows={2} {...register("memo")} /></Field>
      </FormSection>
      <FormActions busy={isSubmitting} submitLabel={id ? "更新する" : "追加する"} onCancel={() => router.back()} />
    </form>
  );
}
