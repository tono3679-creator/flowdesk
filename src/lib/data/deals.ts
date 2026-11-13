import "server-only";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";
import { isDateString } from "@/lib/domain/dates";
import { STAGE_CATEGORIES, type StageCategory } from "@/lib/domain/labels";

export const DEAL_PAGE_SIZE = 30;

const filterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  stage: z.uuid().optional().catch(undefined),
  category: z.enum([...STAGE_CATEGORIES, "closed_won"]).optional().catch(undefined),
  owner: z.union([z.uuid(), z.literal("none")]).optional().catch(undefined),
  type: z.string().max(30).optional().catch(undefined),
  from: z.string().refine(isDateString).optional().catch(undefined),
  to: z.string().refine(isDateString).optional().catch(undefined),
  sort: z.enum(["recent", "amount", "expected", "close"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type DealFilters = z.infer<typeof filterSchema>;
export function parseDealFilters(params: Record<string, string | string[] | undefined>): DealFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  return filterSchema.parse(flat);
}

export type DealRow = {
  id: string; number: number; title: string; customerId: string; customerName: string; ownerId: string | null; dealType: string | null;
  stageId: string; stageName: string; category: StageCategory; probability: number; estimatedAmount: number; actualAmount: number | null;
  expectedRevenue: number; expectedCloseOn: string | null; closedOn: string | null; quoteSubmittedOn: string | null; lastContactAt: Date | null;
  nextFollowUpOn: string | null; createdAt: Date; updatedAt: Date;
};

const SELECT = (tx: Parameters<Parameters<typeof asCurrentUser>[0]>[0]) => tx`
  select d.id, d.number, d.title, d.customer_id "customerId", coalesce(c.company_name, c.name) "customerName", d.owner_id "ownerId",
         d.deal_type "dealType", d.stage_id "stageId", s.name "stageName", s.category, d.probability, d.estimated_amount "estimatedAmount",
         d.actual_amount "actualAmount", d.expected_revenue "expectedRevenue", d.expected_close_on "expectedCloseOn", d.closed_on "closedOn",
         d.quote_submitted_on "quoteSubmittedOn", d.last_contact_at "lastContactAt", d.next_follow_up_on "nextFollowUpOn",
         d.created_at "createdAt", d.updated_at "updatedAt"
    from deals d join customers c on c.id = d.customer_id join pipeline_stages s on s.id = d.stage_id`;

export async function listDeals(f: DealFilters): Promise<{ rows: DealRow[]; total: number; totals: { estimated: number; expected: number; won: number } }> {
  const page = f.page ?? 1;
  return asCurrentUser(async (tx) => {
    const like = f.q ? `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const where = tx`
      where true
      ${like ? tx`and (d.title || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(d.memo, '')) ilike ${like}` : tx``}
      ${f.stage ? tx`and d.stage_id = ${f.stage}` : tx``}
      ${f.category === "closed_won" ? tx`and s.category in ('won', 'completed')` : f.category ? tx`and s.category = ${f.category}` : tx``}
      ${f.owner === "none" ? tx`and d.owner_id is null` : f.owner ? tx`and d.owner_id = ${f.owner}` : tx``}
      ${f.type ? tx`and d.deal_type = ${f.type}` : tx``}
      ${f.from ? tx`and coalesce(d.closed_on, d.expected_close_on) >= ${f.from}::date` : tx``}
      ${f.to ? tx`and coalesce(d.closed_on, d.expected_close_on) <= ${f.to}::date` : tx``}`;
    const order = f.sort === "amount" ? tx`order by d.estimated_amount desc`
      : f.sort === "expected" ? tx`order by d.expected_revenue desc`
      : f.sort === "close" ? tx`order by d.expected_close_on asc nulls last`
      : tx`order by d.updated_at desc`;
    const [rows, [agg]] = await Promise.all([
      tx<DealRow[]>`${SELECT(tx)} ${where} ${order} limit ${DEAL_PAGE_SIZE} offset ${(page - 1) * DEAL_PAGE_SIZE}`,
      tx<{ n: number; estimated: number; expected: number; won: number }[]>`
        select count(*)::int n, coalesce(sum(d.estimated_amount) filter (where s.category in ('open', 'hold')), 0) estimated,
               coalesce(sum(d.expected_revenue) filter (where s.category = 'open'), 0) expected,
               coalesce(sum(coalesce(d.actual_amount, d.estimated_amount)) filter (where s.category in ('won', 'completed')), 0) won
          from deals d join customers c on c.id = d.customer_id join pipeline_stages s on s.id = d.stage_id ${where}`,
    ]);
    return { rows: [...rows], total: agg.n, totals: { estimated: Number(agg.estimated), expected: Number(agg.expected), won: Number(agg.won) } };
  });
}

/** Kanban 用：進行中・保留の案件と、直近 closedDays 日に受注・完了・失注した案件 */
export async function boardDeals(closedSince: string, ownerId?: string): Promise<DealRow[]> {
  return asCurrentUser(async (tx) => [...await tx<DealRow[]>`
    ${SELECT(tx)}
     where (s.category in ('open', 'hold') or d.closed_on >= ${closedSince}::date or d.completed_on >= ${closedSince}::date)
     ${ownerId ? tx`and d.owner_id = ${ownerId}` : tx``}
     order by d.expected_close_on asc nulls last, d.updated_at desc`]);
}

export type DealDetail = DealRow & {
  inquiryId: string | null; inquiryTitle: string | null; probabilityManual: boolean; startedOn: string | null; expectedCompleteOn: string | null;
  completedOn: string | null; revenueOn: string | null; lostReason: string | null; memo: string | null; createdBy: string | null; sourceName: string | null;
};

export async function getDeal(id: string): Promise<DealDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  return asCurrentUser(async (tx) => {
    const [row] = await tx<DealDetail[]>`
      select x.*, d.inquiry_id "inquiryId", i.title "inquiryTitle", d.probability_manual "probabilityManual", d.started_on "startedOn",
             d.expected_complete_on "expectedCompleteOn", d.completed_on "completedOn", d.revenue_on "revenueOn", d.lost_reason "lostReason",
             d.memo, d.created_by "createdBy", src.name "sourceName"
        from (${SELECT(tx)} where d.id = ${id}) x
        join deals d on d.id = x.id
        left join inquiries i on i.id = d.inquiry_id
        left join inquiry_sources src on src.id = i.source_id`;
    return row ?? null;
  });
}
