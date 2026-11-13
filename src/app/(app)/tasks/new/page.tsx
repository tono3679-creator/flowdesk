import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { getLookups } from "@/lib/data/lookups";
import { addDays, toLocalDate } from "@/lib/domain/dates";
import type { TaskInput } from "@/lib/validation";
import { z } from "zod";

export const metadata = { title: "タスクを追加" };

const uuid = z.uuid().optional().catch(undefined);

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ customer?: string; deal?: string; inquiry?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const ids = { customer: uuid.parse(sp.customer), deal: uuid.parse(sp.deal), inquiry: uuid.parse(sp.inquiry) };
  const [lookups, labels] = await Promise.all([
    getLookups(),
    asCurrentUser(async (tx) => {
      const [c] = ids.customer ? await tx<{ l: string }[]>`select coalesce(company_name, name) l from customers where id = ${ids.customer}` : [];
      const [d] = ids.deal ? await tx<{ l: string }[]>`select title l from deals where id = ${ids.deal}` : [];
      const [i] = ids.inquiry ? await tx<{ l: string }[]>`select title l from inquiries where id = ${ids.inquiry}` : [];
      return { customer: c?.l ?? null, deal: d?.l ?? null, inquiry: i?.l ?? null };
    }),
  ]);
  const initial: TaskInput = {
    title: "", description: "", assignee_id: user.userId, customer_id: labels.customer ? ids.customer! : "", deal_id: labels.deal ? ids.deal! : "",
    inquiry_id: labels.inquiry ? ids.inquiry! : "", priority: "medium", status: "todo", start_on: "", due_on: addDays(toLocalDate(new Date()), 3), memo: "",
  };
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink href="/tasks" label="タスク一覧" />
      <PageHeader title="タスクを追加" />
      <TaskForm id={null} initial={initial} labels={labels} members={lookups.members} priorityLabels={user.settings.priorityLabels} />
    </div>
  );
}
