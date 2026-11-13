"use client";
import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ListTodo, Plus } from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { setTaskDone } from "@/lib/actions/tasks";
import { safeAction } from "@/lib/client/safe-action";
import type { Priority, PriorityLabels, TaskStatus } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TaskItem = { id: string; title: string; status: TaskStatus; priority: Priority; dueOn: string | null; assignee: string; isAuto: boolean };

/** 問い合わせ・顧客・案件に紐づくタスク（チェックで完了にできる） */
export function RelatedTasks({ tasks, today, newHref, priorityLabels }: { tasks: TaskItem[]; today: string; newHref: string; priorityLabels: PriorityLabels }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setDone] = useOptimistic(tasks, (cur, { id, done }: { id: string; done: boolean }) =>
    cur.map((t) => (t.id === id ? { ...t, status: done ? "done" : "todo" } as TaskItem : t)));

  const toggle = (t: TaskItem, done: boolean) => startTransition(async () => {
    setDone({ id: t.id, done });
    const r = await safeAction(() => setTaskDone(t.id, done));
    if (!r.ok) toast.error(r.error);
    else if (done) toast.success(`「${t.title}」を完了にしました`);
    router.refresh();
  });

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState icon={ListTodo} title="タスクはありません" className="py-6" />
      ) : (
        <ul className="divide-y">
          {items.map((t) => {
            const done = t.status === "done";
            const overdue = !done && t.dueOn !== null && t.dueOn < today;
            return (
              <li key={t.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                <input
                  type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--primary)]" checked={done} onChange={(e) => toggle(t, e.target.checked)}
                  aria-label={`「${t.title}」を${done ? "未完了に戻す" : "完了にする"}`}
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/tasks/${t.id}/edit`} className={cn("block truncate text-sm font-medium hover:underline", done && "text-muted-foreground line-through")}>
                    {t.isAuto && <Bot className="mr-1 inline size-3.5 text-muted-foreground" aria-label="自動作成" />}
                    {t.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className={cn("tabular", overdue && "font-semibold text-danger-strong")}>
                      期限 {formatDate(t.dueOn)}{overdue && "（期限超過）"}
                    </span>
                    <span>{t.assignee}</span>
                  </div>
                </div>
                {!done && <PriorityBadge priority={t.priority} labels={priorityLabels} />}
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t px-4 py-2 sm:px-5">
        <Button variant="ghost" size="sm" asChild><Link href={newHref}><Plus />タスクを追加</Link></Button>
      </div>
    </div>
  );
}
