"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, GitMerge, Hand, Link2, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/common/confirm-button";
import { Field } from "@/components/common/form-field";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { convertInquiry, deleteInquiry, linkInquiryCustomer, setInquiryStatus, takeInquiry } from "@/lib/actions/inquiries";
import { safeAction } from "@/lib/client/safe-action";
import { EDITABLE_INQUIRY_STATUSES, INQUIRY_STATUS_LABEL, type InquiryStatus } from "@/lib/domain/labels";

type Props = {
  id: string; title: string; status: InquiryStatus; ownerId: string | null; canEdit: boolean; canDelete: boolean; dealTypes: string[];
  category: string | null; hasContact: boolean;
};

/** 問い合わせ詳細の操作（担当になる・ステータス変更・案件化・編集・削除） */
export function InquiryActions(p: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const converted = p.status === "converted";
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => startTransition(async () => {
    const r = await safeAction(fn);
    if (!r.ok) toast.error(r.error);
    else { toast.success(ok); router.refresh(); }
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!p.ownerId && !converted && (
        <Button variant="outline" disabled={pending} onClick={() => act(() => takeInquiry(p.id), "担当者になりました")}><Hand />担当になる</Button>
      )}
      {!converted && p.canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              ステータス：{INQUIRY_STATUS_LABEL[p.status]}<ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>ステータスを変更</DropdownMenuLabel>
            {EDITABLE_INQUIRY_STATUSES.filter((s) => s !== p.status).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => act(() => setInquiryStatus(p.id, s), `ステータスを「${INQUIRY_STATUS_LABEL[s]}」にしました`)}>
                {INQUIRY_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {p.canEdit && <Button variant="outline" asChild><Link href={`/inquiries/${p.id}/edit`}><Pencil />編集</Link></Button>}
      {p.canDelete && (
        <ConfirmButton
          label="削除" icon={<Trash2 aria-hidden />} title="この問い合わせを削除しますか？" destructive confirmLabel="削除する"
          description={converted ? "案件化済みのため削除できません。先に案件を削除してください。" : "対応履歴は残りますが、問い合わせとの紐づけは外れます。元に戻せません。"}
          disabled={converted}
          onConfirm={async () => {
            const r = await safeAction(() => deleteInquiry(p.id));
            if (!r.ok) { toast.error(r.error); return false; }
            toast.success("問い合わせを削除しました");
            router.push("/inquiries");
            return true;
          }}
        />
      )}
      {!converted && p.canEdit && <ConvertDialog {...p} />}
    </div>
  );
}

function ConvertDialog({ id, title, dealTypes, category, hasContact }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({ title, estimated_amount: "", deal_type: dealTypes.includes(category ?? "") ? (category ?? "") : "", create_task: true });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    setBusy(true);
    const r = await safeAction(() => convertInquiry(id, values));
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      toast.error(r.error);
      return;
    }
    toast.success("案件化しました。顧客・内容・担当者・対応履歴を引き継いでいます");
    setOpen(false);
    router.push(`/deals/${r.data?.dealId}`);
  };

  return (
    <>
      <Button onClick={() => { setErrors({}); setOpen(true); }}><GitMerge />案件化する</Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>問い合わせを案件化</DialogTitle>
            <DialogDescription>
              顧客・問い合わせ内容・担当者・対応履歴は自動で引き継がれます。{hasContact ? "顧客が未登録なら、連絡先から顧客を作成します。" : ""}
            </DialogDescription>
          </DialogHeader>
          <form id="convert-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
            <Field label="案件名" htmlFor="convert_title" required error={errors.title}>
              <Input id="convert_title" value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="見積金額（税抜・円）" htmlFor="convert_amount" required error={errors.estimated_amount} hint="未定なら 0 で登録し、あとで変更できます">
                <Input id="convert_amount" inputMode="numeric" placeholder="例：1,200,000" value={values.estimated_amount}
                  onChange={(e) => setValues({ ...values, estimated_amount: e.target.value })} />
              </Field>
              <Field label="案件種別" htmlFor="convert_type" error={errors.deal_type}>
                <SelectField id="convert_type" value={values.deal_type} onChange={(v) => setValues({ ...values, deal_type: v })} noneLabel="未設定"
                  options={dealTypes.map((t) => ({ value: t, label: t }))} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={values.create_task}
                onChange={(e) => setValues({ ...values, create_task: e.target.checked })} />
              <Link2 className="size-4 text-muted-foreground" aria-hidden />
              「ヒアリングの日程調整」タスクを作る（期限：2日後）
            </label>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>キャンセル</Button>
            <Button type="submit" form="convert-form" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              案件化する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 連絡先が同じ既存顧客に紐づける */
export function LinkCustomerButton({ inquiryId, customerId, label }: { inquiryId: string; customerId: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
      const r = await safeAction(() => linkInquiryCustomer(inquiryId, customerId));
      if (!r.ok) toast.error(r.error);
      else { toast.success(`「${label}」に紐づけました`); router.refresh(); }
    })}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
      この顧客に紐づける
    </Button>
  );
}
