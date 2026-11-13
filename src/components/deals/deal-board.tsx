"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock, GripVertical, Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SelectField } from "@/components/common/select-field";
import { moveDealStage } from "@/lib/actions/deals";
import { safeAction } from "@/lib/client/safe-action";
import { LOST_REASONS, type StageCategory } from "@/lib/domain/labels";
import { formatDate, formatYen, formatYenCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BoardStage = { id: string; name: string; category: StageCategory; defaultProbability: number };
export type BoardColumn = { key: string; stages: BoardStage[] };
export type BoardCard = {
  id: string; title: string; customerName: string; ownerName: string; stageId: string; probability: number; estimatedAmount: number;
  actualAmount: number | null; expectedCloseOn: string | null; nextFollowUpOn: string | null; quoteSubmittedOn: string | null; alert: string | null;
};

const COLUMN_TONE: Record<StageCategory, string> = {
  open: "border-t-brand", won: "border-t-success", completed: "border-t-success", lost: "border-t-destructive", hold: "border-t-warning",
};

/**
 * 案件の Kanban ボード。カードを別の列へドラッグするとステータスを DB に保存する。
 * キーボード（スペースで持ち上げ → 矢印 → スペース）や、カードのメニューからも移動できる。
 */
export function DealBoard({ columns, cards: initial, today }: { columns: BoardColumn[]; cards: BoardCard[]; today: string }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lostTarget, setLostTarget] = useState<{ cardId: string; stageId: string } | null>(null);
  // サーバーから新しい一覧が届いたら置き換える（描画中に前回の値と比べる。effect で setState しない）
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setCards(initial);
  }

  const stageById = useMemo(() => new Map(columns.flatMap((c) => c.stages.map((s) => [s.id, { ...s, column: c.key }] as const))), [columns]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const move = async (cardId: string, stageId: string, lostReason?: string) => {
    const card = cards.find((c) => c.id === cardId);
    const stage = stageById.get(stageId);
    if (!card || !stage || card.stageId === stageId) return;
    if (stage.category === "lost" && !lostReason) {
      setLostTarget({ cardId, stageId });
      return;
    }
    const before = cards;
    setCards((cur) => cur.map((c) => (c.id === cardId ? { ...c, stageId } : c)));
    setSavingId(cardId);
    const r = await safeAction(() => moveDealStage(cardId, stageId, lostReason ?? null));
    setSavingId(null);
    if (!r.ok) {
      setCards(before);
      toast.error(r.error);
      return;
    }
    setCards((cur) => cur.map((c) => (c.id === cardId ? { ...c, probability: r.data?.probability ?? c.probability } : c)));
    toast.success(`「${card.title}」を「${stage.name}」にしました（確度 ${r.data?.probability ?? "—"}%）`);
    router.refresh();
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const column = columns.find((c) => c.key === e.over?.id);
    const card = cards.find((c) => c.id === e.active.id);
    if (!column || !card) return;
    if (column.stages.some((s) => s.id === card.stageId)) return;
    void move(card.id, column.stages[0].id);
  };

  const active = cards.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <DndContext
        id="deal-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}
        accessibility={{
          screenReaderInstructions: { draggable: "スペースキーでカードを持ち上げ、左右の矢印キーで列を選び、もう一度スペースキーで置きます。Esc で取り消します。" },
          announcements: {
            onDragStart: ({ active: a }) => `${cards.find((c) => c.id === a.id)?.title ?? "案件"}を持ち上げました`,
            onDragOver: ({ over }) => (over ? `${over.id}の列の上です` : "列の外です"),
            onDragEnd: ({ over }) => (over ? `${over.id}の列に置きました` : "移動を取り消しました"),
            onDragCancel: () => "移動を取り消しました",
          },
        }}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-3">
            {columns.map((col) => {
              const list = cards.filter((c) => col.stages.some((s) => s.id === c.stageId));
              const category = col.stages[0].category;
              const won = category === "won" || category === "completed";
              const total = list.reduce((sum, c) => sum + (won ? (c.actualAmount ?? c.estimatedAmount) : category === "lost" ? c.estimatedAmount : Math.round((c.estimatedAmount * c.probability) / 100)), 0);
              return (
                <Column key={col.key} id={col.key} tone={COLUMN_TONE[category]}
                  header={
                    <>
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold">{col.key}</h2>
                        <span className="rounded-full bg-muted px-2 text-xs font-medium tabular">{list.length}</span>
                      </div>
                      <div className="text-xs text-muted-foreground tabular">
                        {won ? "受注金額" : category === "lost" ? "見積金額" : "受注見込"} {formatYenCompact(total)}
                      </div>
                    </>
                  }
                >
                  {list.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">ここにドラッグ</p>
                  ) : list.map((c) => (
                    <Card key={c.id} card={c} today={today} saving={savingId === c.id} stageName={stageById.get(c.stageId)?.name ?? ""}
                      stages={columns.flatMap((x) => x.stages)} onMove={(stageId) => void move(c.id, stageId)} />
                  ))}
                </Column>
              );
            })}
          </div>
        </div>
        <DragOverlay>{active && <CardBody card={active} today={today} stageName={stageById.get(active.stageId)?.name ?? ""} dragging />}</DragOverlay>
      </DndContext>
      <LostReasonDialog
        open={lostTarget !== null} onCancel={() => setLostTarget(null)}
        onSubmit={(reason) => { const t = lostTarget; setLostTarget(null); if (t) void move(t.cardId, t.stageId, reason); }}
      />
    </>
  );
}

function Column({ id, tone, header, children }: { id: string; tone: string; header: React.ReactNode; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={`${id}の列`}
      className={cn("flex w-[272px] shrink-0 flex-col rounded-xl border border-t-4 bg-muted/40 transition-colors", tone, isOver && "bg-accent ring-2 ring-primary/40")}>
      <div className="grid gap-0.5 px-3 pt-2.5 pb-2">{header}</div>
      <div className="grid content-start gap-2 px-2 pb-2" style={{ minHeight: 120 }}>{children}</div>
    </section>
  );
}

function Card({ card, today, saving, stageName, stages, onMove }: {
  card: BoardCard; today: string; saving: boolean; stageName: string; stages: BoardStage[]; onMove: (stageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} className={cn("relative", isDragging && "opacity-30")}>
      <CardBody card={card} today={today} stageName={stageName} handle={{ ...attributes, ...listeners }} saving={saving}
        menu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`「${card.title}」のステータスを変更`}>
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>ステータスを変更</DropdownMenuLabel>
              {stages.filter((s) => s.id !== card.stageId).map((s) => <DropdownMenuItem key={s.id} onSelect={() => onMove(s.id)}>{s.name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </div>
  );
}

function CardBody({ card, today, stageName, handle, menu, saving, dragging }: {
  card: BoardCard; today: string; stageName: string; handle?: Record<string, unknown>; menu?: React.ReactNode; saving?: boolean; dragging?: boolean;
}) {
  const late = card.expectedCloseOn !== null && card.expectedCloseOn < today && card.probability > 0 && card.probability < 100;
  return (
    <article className={cn("rounded-lg border bg-card p-2.5 shadow-xs", dragging && "rotate-2 shadow-lg ring-2 ring-primary/50")}>
      <div className="flex items-start gap-1">
        <button type="button" {...handle} className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          aria-label={`「${card.title}」をドラッグして移動`} aria-roledescription="ドラッグできるカード">
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/deals/${card.id}`} className="line-clamp-2 text-sm font-medium hover:underline">{card.title}</Link>
          <div className="truncate text-xs text-muted-foreground">{card.customerName}</div>
        </div>
        {saving ? <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" aria-label="保存中" /> : menu}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2 pl-6">
        <div>
          <div className="text-sm font-semibold tabular">{formatYen(card.actualAmount ?? card.estimatedAmount)}</div>
          <div className="text-[11px] text-muted-foreground tabular">{stageName}・確度 {card.probability}%</div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">{card.ownerName}</div>
      </div>
      {(card.expectedCloseOn || card.alert) && (
        <div className="mt-1.5 flex flex-wrap gap-x-2 pl-6 text-[11px]">
          {card.expectedCloseOn && card.probability > 0 && card.probability < 100 && (
            <span className={cn("inline-flex items-center gap-0.5 tabular", late ? "font-semibold text-danger-strong" : "text-muted-foreground")}>
              <CalendarClock className="size-3" aria-hidden />受注予定 {formatDate(card.expectedCloseOn)}
            </span>
          )}
          {card.alert && <span className="font-semibold text-warning-strong">{card.alert}</span>}
        </div>
      )}
    </article>
  );
}

function LostReasonDialog({ open, onCancel, onSubmit }: { open: boolean; onCancel: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  // 閉じるときに選択を空に戻す（次に開いたときは未選択から）
  const cancel = () => { setReason(""); onCancel(); };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && cancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>失注理由を選んでください</DialogTitle>
          <DialogDescription>失注理由は分析画面の「失注理由」グラフに使われます</DialogDescription>
        </DialogHeader>
        <SelectField value={reason} onChange={setReason} options={LOST_REASONS.map((r) => ({ value: r, label: r }))} ariaLabel="失注理由" />
        <DialogFooter>
          <Button variant="outline" onClick={cancel}>キャンセル</Button>
          <Button variant="destructive" disabled={!reason} onClick={() => { onSubmit(reason); setReason(""); }}>失注にする</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
