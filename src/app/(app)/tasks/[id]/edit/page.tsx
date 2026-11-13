import { notFound } from "next/navigation";
import { Bot } from "lucide-react";
import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { TaskDeleteButton } from "@/components/tasks/task-delete";
import { TaskForm } from "@/components/tasks/task-form";
import { requireUser } from "@/lib/auth";
import { getLookups } from "@/lib/data/lookups";
import { getTask } from "@/lib/data/tasks";
import { formatDateTimeFull } from "@/lib/format";
import type { TaskInput } from "@/lib/validation";

export const metadata = { title: "タスクを編集" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [t, lookups] = await Promise.all([getTask(id), getLookups()]);
  if (!t) notFound();
  const initial: TaskInput = {
    title: t.title, description: t.description ?? "", assignee_id: t.assigneeId ?? "", customer_id: t.customerId ?? "", deal_id: t.dealId ?? "",
    inquiry_id: t.inquiryId ?? "", priority: t.priority, status: t.status, start_on: t.startOn ?? "", due_on: t.dueOn ?? "", memo: t.memo ?? "",
  };
  const canDelete = user.isManager || t.createdBy === user.userId;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink href="/tasks" label="タスク一覧" />
      <PageHeader
        title="タスクを編集"
        description={t.completedAt ? `${formatDateTimeFull(t.completedAt)} に完了` : undefined}
        actions={canDelete ? <TaskDeleteButton id={t.id} /> : undefined}
      />
      {t.isAuto && (
        <p className="flex items-center gap-2 rounded-lg bg-info-soft px-4 py-2 text-sm text-info-strong">
          <Bot className="size-4" aria-hidden />案件化・見積提出のときにシステムが自動で作ったタスクです
        </p>
      )}
      <TaskForm id={t.id} initial={initial} labels={{ customer: t.customerName, deal: t.dealTitle, inquiry: t.inquiryTitle }} members={lookups.members}
        priorityLabels={user.settings.priorityLabels} />
    </div>
  );
}
