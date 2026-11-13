"use client";
import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlarmClock, Bot, Briefcase, Building2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge, TaskStatusBadge } from "@/components/common/badges";
import { setTaskDone } from "@/lib/actions/tasks";
import { safeAction } from "@/lib/client/safe-action";
import { diffDays } from "@/lib/domain/dates";
import type { Priority, PriorityLabels, TaskStatus } from "@/lib/domain/labels";
import { formatDate, formatDaysLeft } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TaskListItem = {
  id: string; title: string; status: TaskStatus; priority: Priority; dueOn: string | null; isAuto: boolean; assignee: string;
  customerId: string | null; customerName: string | null; dealId: string | null; dealTitle: string | null; inquiryId: string | null; inquiryTitle: string | null;
};

/** タスク一覧（チェックで完了。期限超過は赤で警告） */
export function TaskList({ tasks, today, priorityLabels }: { tasks: TaskListItem[]; today: string; priorityLabels: PriorityLabels }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setDone] = useOptimistic(tasks, (cur, { id, done }: { id: string; done: boolean }) =>
    cur.map((t) => (t.id === id ? { ...t, status: (done ? "done" : "todo") as TaskStatus } : t)));
  const toggle = (t: TaskListItem, done: boolean) => startTransition(async () => {
    setDone({ id: t.id, done });
    const r = await safeAction(() => setTaskDone(t.id, done));
    if (!r.ok) toast.error(r.error);
    else toast.success(done ? `「${t.title}」を完了にしました` : `「${t.title}」を未完了に戻しました`);
    router.refresh();
  });

  return (
    <ul className="divide-y">
      {items.map((t) => {
        const done = t.status === "done";
        const days = t.dueOn ? diffDays(today, t.dueOn) : null;
        const overdue = !done && days !== null && days < 0;
        return (
          <li key={t.id} className={cn("flex items-start gap-3 px-4 py-3 sm:px-5", overdue && "bg-danger-soft/40")}>
            <input type="checkbox" checked={done} onChange={(e) => toggle(t, e.target.checked)} className="mt-1 size-4.5 shrink-0 accent-[var(--primary)]"
              aria-label={`「${t.title}」を${done ? "未完了に戻す" : "完了にする"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/tasks/${t.id}/edit`} className={cn("font-medium hover:underline", done && "text-muted-foreground line-through")}>
                  {t.isAuto && <Bot className="mr-1 inline size-4 text-muted-foreground" aria-label="自動作成" />}
                  {t.title}
                </Link>
                {!done && t.status !== "todo" && <TaskStatusBadge status={t.status} />}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {t.customerId && <Link href={`/customers/${t.customerId}`} className="inline-flex items-center gap-1 hover:text-foreground"><Building2 className="size-3" aria-hidden />{t.customerName}</Link>}
                {t.dealId && <Link href={`/deals/${t.dealId}`} className="inline-flex items-center gap-1 hover:text-foreground"><Briefcase className="size-3" aria-hidden />{t.dealTitle}</Link>}
                {!t.dealId && t.inquiryId && <Link href={`/inquiries/${t.inquiryId}`} className="inline-flex items-center gap-1 hover:text-foreground"><Inbox className="size-3" aria-hidden />{t.inquiryTitle}</Link>}
                <span>担当 {t.assignee}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {!done && <PriorityBadge priority={t.priority} labels={priorityLabels} />}
              <span className={cn("text-xs tabular whitespace-nowrap", overdue ? "font-semibold text-danger-strong" : days === 0 && !done ? "font-semibold text-warning-strong" : "text-muted-foreground")}>
                {overdue && <AlarmClock className="mr-0.5 inline size-3.5" aria-hidden />}
                {t.dueOn ? `${formatDate(t.dueOn)}${done || days === null ? "" : `（${formatDaysLeft(days)}）`}` : "期限なし"}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
