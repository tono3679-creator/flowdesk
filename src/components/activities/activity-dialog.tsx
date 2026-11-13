"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/form-field";
import { applyFieldErrors } from "@/components/common/form-kit";
import { ACTIVITY_ICON } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createActivity } from "@/lib/actions/activities";
import { safeAction } from "@/lib/client/safe-action";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABEL } from "@/lib/domain/labels";
import { toDateTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { activitySchema, type ActivityInput } from "@/lib/validation";

/**
 * 対応履歴の登録（問い合わせ・顧客・案件の詳細画面から）。
 * 登録すると、未対応 → 対応中、最終接触日、次回対応日などは DB 側で自動更新される。
 */
export function ActivityDialog({
  scope, label = "対応を記録", variant = "default", size,
}: {
  scope: { customer_id?: string | null; inquiry_id?: string | null; deal_id?: string | null };
  label?: string; variant?: React.ComponentProps<typeof Button>["variant"]; size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const blank = (): ActivityInput => ({
    activity_type: "call", occurred_at: toDateTimeLocal(new Date()), customer_id: scope.customer_id ?? "", inquiry_id: scope.inquiry_id ?? "",
    deal_id: scope.deal_id ?? "", content: "", result: "", next_action_on: "", memo: "",
  });
  const form = useForm<z.input<typeof activitySchema>, unknown, z.output<typeof activitySchema>>({ resolver: zodResolver(activitySchema), defaultValues: blank() });
  const { register, formState: { errors, isSubmitting }, setError, setValue, reset } = form;
  const type = useWatch({ control: form.control, name: "activity_type" });

  const onSubmit = form.handleSubmit(async () => {
    const result = await safeAction(() => createActivity(form.getValues()));
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success("対応履歴を記録しました");
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      <Button variant={variant} size={size} onClick={() => { reset(blank()); setOpen(true); }}>
        <MessageSquarePlus aria-hidden />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(v) => !isSubmitting && setOpen(v)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>対応履歴を記録</DialogTitle>
            <DialogDescription>電話・メール・商談など、お客様とのやり取りを残します</DialogDescription>
          </DialogHeader>
          <form id="activity-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">対応種別</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {ACTIVITY_TYPES.map((t) => {
                  const Icon = ACTIVITY_ICON[t];
                  return (
                    <button
                      key={t} type="button" aria-pressed={type === t} onClick={() => setValue("activity_type", t)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs transition-colors",
                        type === t ? "border-primary bg-primary/10 font-semibold text-foreground" : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {ACTIVITY_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="対応日時" htmlFor="occurred_at" required error={errors.occurred_at?.message}>
              <Input id="occurred_at" type="datetime-local" {...register("occurred_at")} />
            </Field>
            <Field label="対応内容" htmlFor="activity_content" required error={errors.content?.message}>
              <Textarea id="activity_content" rows={4} {...register("content")} placeholder="例：電話でヒアリング。予算は300万円前後、来月中に決めたい" />
            </Field>
            <Field label="結果" htmlFor="activity_result" error={errors.result?.message}>
              <Input id="activity_result" {...register("result")} placeholder="例：見積書を送ることになった" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="次回対応日" htmlFor="activity_next" error={errors.next_action_on?.message} hint="入れると次回対応予定に反映されます">
                <Input id="activity_next" type="date" {...register("next_action_on")} />
              </Field>
              <Field label="メモ" htmlFor="activity_memo" error={errors.memo?.message}>
                <Input id="activity_memo" {...register("memo")} />
              </Field>
            </div>
            {errors.customer_id?.message && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>キャンセル</Button>
            <Button type="submit" form="activity-form" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              記録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
