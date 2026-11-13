import "server-only";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";
import { addDays, startOfWeek } from "@/lib/domain/dates";
import { PRIORITIES, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/domain/labels";

export const TASK_VIEWS = ["today", "week", "overdue", "mine", "team", "done"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];
export const TASK_VIEW_LABEL: Record<TaskView, string> = {
  today: "今日", week: "今週", overdue: "期限超過", mine: "自分のタスク", team: "チーム全体", done: "完了済み",
};

const filterSchema = z.object({
  view: z.enum(TASK_VIEWS).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  assignee: z.union([z.uuid(), z.literal("none")]).optional().catch(undefined),
  status: z.enum(TASK_STATUSES).optional().catch(undefined),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
});
export type TaskFilters = z.infer<typeof filterSchema>;
export function parseTaskFilters(params: Record<string, string | string[] | undefined>): TaskFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  return filterSchema.parse(flat);
}

export type TaskRow = {
  id: string; title: string; description: string | null; assigneeId: string | null; status: TaskStatus; priority: Priority; startOn: string | null;
  dueOn: string | null; completedAt: Date | null; isAuto: boolean; customerId: string | null; customerName: string | null; dealId: string | null;
  dealTitle: string | null; inquiryId: string | null; inquiryTitle: string | null;
};

const LIMIT = 300;

/** タスクの一覧（ビュー：今日・今週・期限超過・自分・チーム・完了済み）。並び順は期限 → 優先度 */
export async function listTasks(f: TaskFilters, userId: string, today: string): Promise<{ rows: TaskRow[]; counts: Record<TaskView, number> }> {
  const view = f.view ?? "mine";
  const weekEnd = addDays(startOfWeek(today), 6);
  return asCurrentUser(async (tx) => {
    const viewCond = (v: TaskView) => {
      switch (v) {
        case "today": return tx`t.status <> 'done' and t.due_on <= ${today}::date and (t.assignee_id = ${userId} or t.assignee_id is null)`;
        case "week": return tx`t.status <> 'done' and t.due_on <= ${weekEnd}::date and (t.assignee_id = ${userId} or t.assignee_id is null)`;
        case "overdue": return tx`t.status <> 'done' and t.due_on < ${today}::date`;
        case "mine": return tx`t.status <> 'done' and t.assignee_id = ${userId}`;
        case "team": return tx`t.status <> 'done'`;
        case "done": return tx`t.status = 'done'`;
      }
    };
    const like = f.q ? `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const extra = tx`
      ${like ? tx`and (t.title || ' ' || coalesce(t.description, '') || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.name, '')) ilike ${like}` : tx``}
      ${f.assignee === "none" ? tx`and t.assignee_id is null` : f.assignee ? tx`and t.assignee_id = ${f.assignee}` : tx``}
      ${f.status ? tx`and t.status = ${f.status}` : tx``}
      ${f.priority ? tx`and t.priority = ${f.priority}` : tx``}`;
    const [rows, [counts]] = await Promise.all([
      tx<TaskRow[]>`
        select t.id, t.title, t.description, t.assignee_id "assigneeId", t.status, t.priority, t.start_on "startOn", t.due_on "dueOn",
               t.completed_at "completedAt", t.is_auto "isAuto", t.customer_id "customerId", coalesce(c.company_name, c.name) "customerName",
               t.deal_id "dealId", d.title "dealTitle", t.inquiry_id "inquiryId", i.title "inquiryTitle"
          from tasks t left join customers c on c.id = t.customer_id left join deals d on d.id = t.deal_id left join inquiries i on i.id = t.inquiry_id
         where ${viewCond(view)} ${extra}
         order by ${view === "done" ? tx`t.completed_at desc` : tx`t.due_on asc nulls last, case t.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, t.created_at`}
         limit ${LIMIT}`,
      tx<Record<TaskView, number>[]>`
        select count(*) filter (where ${viewCond("today")})::int today, count(*) filter (where ${viewCond("week")})::int week,
               count(*) filter (where ${viewCond("overdue")})::int overdue, count(*) filter (where ${viewCond("mine")})::int mine,
               count(*) filter (where ${viewCond("team")})::int team, count(*) filter (where ${viewCond("done")})::int done
          from tasks t`,
    ]);
    return { rows: [...rows], counts };
  });
}

export type TaskDetail = TaskRow & { memo: string | null; createdBy: string | null; updatedAt: Date };

export async function getTask(id: string): Promise<TaskDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  return asCurrentUser(async (tx) => {
    const [row] = await tx<TaskDetail[]>`
      select t.id, t.title, t.description, t.assignee_id "assigneeId", t.status, t.priority, t.start_on "startOn", t.due_on "dueOn",
             t.completed_at "completedAt", t.is_auto "isAuto", t.customer_id "customerId", coalesce(c.company_name, c.name) "customerName",
             t.deal_id "dealId", d.title "dealTitle", t.inquiry_id "inquiryId", i.title "inquiryTitle", t.memo, t.created_by "createdBy", t.updated_at "updatedAt"
        from tasks t left join customers c on c.id = t.customer_id left join deals d on d.id = t.deal_id left join inquiries i on i.id = t.inquiry_id
       where t.id = ${id}`;
    return row ?? null;
  });
}
