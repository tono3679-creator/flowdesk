"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/common/confirm-button";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteDeal, moveDealStage } from "@/lib/actions/deals";
import { safeAction } from "@/lib/client/safe-action";
import { LOST_REASONS, type StageCategory } from "@/lib/domain/labels";

/** 案件詳細のステータス変更（失注は理由を聞く） */
export function DealStageMenu({ dealId, stageId, stages }: { dealId: string; stageId: string; stages: { id: string; name: string; category: StageCategory }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lostStage, setLostStage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const current = stages.find((s) => s.id === stageId);
  const move = (id: string, lostReason?: string) => startTransition(async () => {
    const r = await safeAction(() => moveDealStage(dealId, id, lostReason ?? null));
    if (!r.ok) return void toast.error(r.error);
    toast.success(`ステータスを「${stages.find((s) => s.id === id)?.name}」にしました（確度 ${r.data?.probability}%）`);
    router.refresh();
  });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            ステータス：{current?.name ?? "—"}<ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>ステータスを変更</DropdownMenuLabel>
          {stages.filter((s) => s.id !== stageId).map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => (s.category === "lost" ? (setReason(""), setLostStage(s.id)) : move(s.id))}>{s.name}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={lostStage !== null} onOpenChange={(v) => !v && setLostStage(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>失注理由を選んでください</DialogTitle>
            <DialogDescription>失注理由は分析画面で集計されます</DialogDescription>
          </DialogHeader>
          <SelectField value={reason} onChange={setReason} options={LOST_REASONS.map((r) => ({ value: r, label: r }))} ariaLabel="失注理由" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostStage(null)}>キャンセル</Button>
            <Button variant="destructive" disabled={!reason} onClick={() => { const s = lostStage; setLostStage(null); if (s) move(s, reason); }}>失注にする</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DealDeleteButton({ id, fromInquiry }: { id: string; fromInquiry: boolean }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="削除" icon={<Trash2 aria-hidden />} title="この案件を削除しますか？" destructive confirmLabel="削除する"
      description={fromInquiry ? "元の問い合わせは「対応中」に戻ります（案件化の取り消し）。売上も削除されます。元に戻せません。" : "売上・ステータス履歴も削除されます。元に戻せません。"}
      onConfirm={async () => {
        const r = await safeAction(() => deleteDeal(id));
        if (!r.ok) { toast.error(r.error); return false; }
        toast.success("案件を削除しました");
        router.push("/deals");
        return true;
      }}
    />
  );
}
