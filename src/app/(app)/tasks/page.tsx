import Link from "next/link";
import { Download, ListTodo, PartyPopper, Plus } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getLookups, memberName } from "@/lib/data/lookups";
import { listTasks, parseTaskFilters, TASK_VIEW_LABEL, TASK_VIEWS } from "@/lib/data/tasks";
import { toLocalDate } from "@/lib/domain/dates";
import { PRIORITIES, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "タスク" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseTaskFilters(params);
  const view = filters.view ?? "mine";
  const today = toLocalDate(new Date());
  const [{ rows, counts }, lookups] = await Promise.all([listTasks(filters, user.userId, today), getLookups()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="タスク"
        description="期限を過ぎたタスクは赤で表示し、ダッシュボードとアラートでもお知らせします"
        actions={
          <>
            {user.isManager && <Button variant="outline" asChild><a href="/api/export/tasks" download><Download />CSV出力</a></Button>}
            <Button asChild><Link href="/tasks/new"><Plus />タスクを追加</Link></Button>
          </>
        }
      />
      <nav aria-label="タスクの表示" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 rounded-lg bg-muted p-1">
          {TASK_VIEWS.map((v) => (
            <li key={v}>
              <Link href={`/tasks?view=${v}`} aria-current={v === view ? "page" : undefined}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap", v === view ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {TASK_VIEW_LABEL[v]}
                <span className={cn("rounded-full px-1.5 text-xs tabular", v === "overdue" && counts.overdue > 0 ? "bg-destructive text-white" : "bg-background")}>{counts[v]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Card className="gap-0 py-0">
        <ListFilters
          placeholder="タスク名・内容・顧客名で検索"
          selects={[
            { key: "assignee", label: "担当者", allLabel: "すべての担当者", options: [{ value: "none", label: "未割当" }, ...lookups.members.filter((m) => m.isActive).map((m) => ({ value: m.id, label: m.name }))] },
            { key: "status", label: "ステータス", allLabel: "すべてのステータス", options: TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] })) },
            { key: "priority", label: "優先度", allLabel: "すべての優先度", options: PRIORITIES.map((p) => ({ value: p, label: user.settings.priorityLabels[p] })) },
          ]}
        />
        {rows.length === 0 ? (
          view === "today" || view === "overdue" || view === "mine"
            ? <EmptyState icon={PartyPopper} title={view === "overdue" ? "期限を過ぎたタスクはありません" : "対応が必要なタスクはありません"} />
            : <EmptyState icon={ListTodo} title="タスクはありません" action={<Button asChild size="sm"><Link href="/tasks/new"><Plus />タスクを追加</Link></Button>} />
        ) : (
          <TaskList today={today} priorityLabels={user.settings.priorityLabels}
            tasks={rows.map((t) => ({ ...t, assignee: memberName(lookups, t.assigneeId) }))} />
        )}
      </Card>
    </div>
  );
}
