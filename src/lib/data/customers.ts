import "server-only";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";
import { CUSTOMER_RANKS, CUSTOMER_TYPES, type CustomerType, type StageCategory } from "@/lib/domain/labels";

export const CUSTOMER_PAGE_SIZE = 30;

const filterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  owner: z.union([z.uuid(), z.literal("none")]).optional().catch(undefined),
  tag: z.uuid().optional().catch(undefined),
  rank: z.enum(CUSTOMER_RANKS).optional().catch(undefined),
  type: z.enum(CUSTOMER_TYPES).optional().catch(undefined),
  sort: z.enum(["recent", "sales", "contact"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type CustomerFilters = z.infer<typeof filterSchema>;
export function parseCustomerFilters(params: Record<string, string | string[] | undefined>): CustomerFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  return filterSchema.parse(flat);
}

export type CustomerListRow = {
  id: string; number: number; type: CustomerType; companyName: string | null; name: string | null; department: string | null; phone: string | null;
  email: string | null; ownerId: string | null; rank: string | null; lastContactAt: Date | null; tagIds: string[]; openDeals: number;
  wonAmount: number; totalSales: number; nextActionOn: string | null;
};

/** 次回予定：進行中の案件のフォロー日・未完了の問い合わせの次回対応日・未完了タスクの期限のうち、いちばん早いもの */
const NEXT_ACTION = (tx: Parameters<Parameters<typeof asCurrentUser>[0]>[0]) => tx`
  (select min(x) from (
     select d.next_follow_up_on x from deals d join pipeline_stages s on s.id = d.stage_id where d.customer_id = c.id and s.category = 'open'
     union all select i.next_action_on from inquiries i where i.customer_id = c.id and i.status in ('new', 'in_progress', 'on_hold')
     union all select t.due_on from tasks t where t.customer_id = c.id and t.status <> 'done') n)`;

export async function listCustomers(f: CustomerFilters): Promise<{ rows: CustomerListRow[]; total: number }> {
  const page = f.page ?? 1;
  return asCurrentUser(async (tx) => {
    const like = f.q ? `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const where = tx`
      where true
      ${like ? tx`and (coalesce(c.company_name, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(c.email, '') || ' ' || coalesce(c.phone, '')
                       || ' ' || coalesce(c.department, '') || ' ' || coalesce(c.address, '')) ilike ${like}` : tx``}
      ${f.owner === "none" ? tx`and c.owner_id is null` : f.owner ? tx`and c.owner_id = ${f.owner}` : tx``}
      ${f.tag ? tx`and exists (select 1 from customer_tag_relations r where r.customer_id = c.id and r.tag_id = ${f.tag})` : tx``}
      ${f.rank ? tx`and c.rank = ${f.rank}` : tx``}
      ${f.type ? tx`and c.type = ${f.type}` : tx``}`;
    const order = f.sort === "sales" ? tx`order by "totalSales" desc, c.number desc`
      : f.sort === "contact" ? tx`order by c.last_contact_at asc nulls first, c.number desc`
      : tx`order by c.updated_at desc`;
    const [rows, [count]] = await Promise.all([
      tx<CustomerListRow[]>`
        select c.id, c.number, c.type, c.company_name "companyName", c.name, c.department, c.phone, c.email, c.owner_id "ownerId", c.rank,
               c.last_contact_at "lastContactAt",
               coalesce((select array_agg(r.tag_id) from customer_tag_relations r where r.customer_id = c.id), '{}') "tagIds",
               (select count(*)::int from deals d join pipeline_stages s on s.id = d.stage_id where d.customer_id = c.id and s.category in ('open', 'hold')) "openDeals",
               (select coalesce(sum(coalesce(d.actual_amount, d.estimated_amount)), 0)::float8 from deals d join pipeline_stages s on s.id = d.stage_id
                 where d.customer_id = c.id and s.category in ('won', 'completed')) "wonAmount",
               (select coalesce(sum(amount), 0)::float8 from sales where customer_id = c.id) "totalSales",
               ${NEXT_ACTION(tx)} "nextActionOn"
          from customers c ${where} ${order}
         limit ${CUSTOMER_PAGE_SIZE} offset ${(page - 1) * CUSTOMER_PAGE_SIZE}`,
      tx<{ n: number }[]>`select count(*)::int n from customers c ${where}`,
    ]);
    return { rows: [...rows], total: count.n };
  });
}

export type CustomerDetail = CustomerListRow & {
  position: string | null; address: string | null; memo: string | null; createdBy: string | null; createdAt: Date; updatedAt: Date;
  inquiryCount: number; dealCount: number; wonCount: number; salesThisYear: number;
};

export type CustomerDeal = {
  id: string; number: number; title: string; stageName: string; category: StageCategory; estimatedAmount: number; actualAmount: number | null;
  expectedRevenue: number; probability: number; ownerId: string | null; expectedCloseOn: string | null; closedOn: string | null;
};
export type CustomerInquiry = { id: string; number: number; title: string; receivedAt: Date; status: string; ownerId: string | null; priority: string };

export async function getCustomer(id: string, yearStart: string): Promise<{ customer: CustomerDetail; deals: CustomerDeal[]; inquiries: CustomerInquiry[] } | null> {
  if (!z.uuid().safeParse(id).success) return null;
  return asCurrentUser(async (tx) => {
    const [customer] = await tx<CustomerDetail[]>`
      select c.id, c.number, c.type, c.company_name "companyName", c.name, c.department, c.position, c.phone, c.email, c.address, c.owner_id "ownerId",
             c.rank, c.memo, c.last_contact_at "lastContactAt", c.created_by "createdBy", c.created_at "createdAt", c.updated_at "updatedAt",
             coalesce((select array_agg(r.tag_id) from customer_tag_relations r where r.customer_id = c.id), '{}') "tagIds",
             (select count(*)::int from deals d join pipeline_stages s on s.id = d.stage_id where d.customer_id = c.id and s.category in ('open', 'hold')) "openDeals",
             (select coalesce(sum(coalesce(d.actual_amount, d.estimated_amount)), 0)::float8 from deals d join pipeline_stages s on s.id = d.stage_id
               where d.customer_id = c.id and s.category in ('won', 'completed')) "wonAmount",
             (select count(*)::int from deals d join pipeline_stages s on s.id = d.stage_id where d.customer_id = c.id and s.category in ('won', 'completed')) "wonCount",
             (select coalesce(sum(amount), 0)::float8 from sales where customer_id = c.id) "totalSales",
             (select coalesce(sum(amount), 0)::float8 from sales where customer_id = c.id and recognized_on >= ${yearStart}::date) "salesThisYear",
             (select count(*)::int from inquiries where customer_id = c.id) "inquiryCount",
             (select count(*)::int from deals where customer_id = c.id) "dealCount",
             ${NEXT_ACTION(tx)} "nextActionOn"
        from customers c where c.id = ${id}`;
    if (!customer) return null;
    const [deals, inquiries] = await Promise.all([
      tx<CustomerDeal[]>`
        select d.id, d.number, d.title, s.name "stageName", s.category, d.estimated_amount::float8 "estimatedAmount", d.actual_amount::float8 "actualAmount",
               d.expected_revenue::float8 "expectedRevenue", d.probability, d.owner_id "ownerId", d.expected_close_on "expectedCloseOn", d.closed_on "closedOn"
          from deals d join pipeline_stages s on s.id = d.stage_id where d.customer_id = ${id} order by d.created_at desc`,
      tx<CustomerInquiry[]>`
        select id, number, title, received_at "receivedAt", status, owner_id "ownerId", priority from inquiries where customer_id = ${id} order by received_at desc`,
    ]);
    return { customer, deals: [...deals], inquiries: [...inquiries] };
  });
}
