import "server-only";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";
import { isDateString } from "@/lib/domain/dates";
import { INQUIRY_STATUSES, PRIORITIES, type InquiryStatus, type Priority } from "@/lib/domain/labels";

export const PAGE_SIZE = 30;

const filterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum([...INQUIRY_STATUSES, "open"]).optional().catch(undefined),
  owner: z.union([z.uuid(), z.literal("none")]).optional().catch(undefined),
  source: z.uuid().optional().catch(undefined),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
  from: z.string().refine(isDateString).optional().catch(undefined),
  to: z.string().refine(isDateString).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type InquiryFilters = z.infer<typeof filterSchema>;
export function parseInquiryFilters(params: Record<string, string | string[] | undefined>): InquiryFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  return filterSchema.parse(flat);
}

export type InquiryListRow = {
  id: string; number: number; receivedAt: Date; title: string; content: string | null; contactName: string | null; companyName: string | null;
  customerId: string | null; ownerId: string | null; priority: Priority; status: InquiryStatus; sourceName: string | null; category: string | null;
  lastActivityAt: Date | null; nextActionOn: string | null; firstResponseAt: Date | null; convertedDealId: string | null;
};

export async function listInquiries(f: InquiryFilters): Promise<{ rows: InquiryListRow[]; total: number }> {
  const page = f.page ?? 1;
  return asCurrentUser(async (tx) => {
    const like = f.q ? `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const where = tx`
      where true
      ${like ? tx`and (i.title || ' ' || coalesce(i.content, '') || ' ' || coalesce(i.contact_name, '') || ' ' || coalesce(i.company_name, '')
                       || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(i.email, '') || ' ' || coalesce(i.phone, '')) ilike ${like}` : tx``}
      ${f.status === "open" ? tx`and i.status in ('new', 'in_progress', 'on_hold')` : f.status ? tx`and i.status = ${f.status}` : tx``}
      ${f.owner === "none" ? tx`and i.owner_id is null` : f.owner ? tx`and i.owner_id = ${f.owner}` : tx``}
      ${f.source ? tx`and i.source_id = ${f.source}` : tx``}
      ${f.priority ? tx`and i.priority = ${f.priority}` : tx``}
      ${f.from ? tx`and i.received_at >= (${f.from}::date)::timestamp at time zone 'Asia/Tokyo'` : tx``}
      ${f.to ? tx`and i.received_at < ((${f.to}::date + 1)::timestamp at time zone 'Asia/Tokyo')` : tx``}`;
    const [rows, [count]] = await Promise.all([
      tx<InquiryListRow[]>`
        select i.id, i.number, i.received_at "receivedAt", i.title, i.content, coalesce(c.name, i.contact_name) "contactName",
               coalesce(c.company_name, i.company_name) "companyName", i.customer_id "customerId", i.owner_id "ownerId", i.priority, i.status,
               s.name "sourceName", i.category, i.last_activity_at "lastActivityAt", i.next_action_on "nextActionOn",
               i.first_response_at "firstResponseAt", i.converted_deal_id "convertedDealId"
          from inquiries i left join customers c on c.id = i.customer_id left join inquiry_sources s on s.id = i.source_id
          ${where}
         order by case when i.status = 'new' then 0 else 1 end, i.received_at desc
         limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
      tx<{ n: number }[]>`select count(*)::int n from inquiries i left join customers c on c.id = i.customer_id ${where}`,
    ]);
    return { rows: [...rows], total: count.n };
  });
}

export type InquiryDetail = InquiryListRow & {
  sourceId: string | null; phone: string | null; email: string | null; memo: string | null; createdBy: string | null; createdAt: Date;
  updatedAt: Date; convertedAt: Date | null; customerLabel: string | null; dealTitle: string | null;
};

export async function getInquiry(id: string): Promise<InquiryDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  return asCurrentUser(async (tx) => {
    const [row] = await tx<InquiryDetail[]>`
      select i.id, i.number, i.received_at "receivedAt", i.title, i.content, i.contact_name "contactName", i.company_name "companyName",
             i.customer_id "customerId", i.owner_id "ownerId", i.priority, i.status, s.name "sourceName", i.source_id "sourceId", i.category,
             i.last_activity_at "lastActivityAt", i.next_action_on "nextActionOn", i.first_response_at "firstResponseAt",
             i.converted_deal_id "convertedDealId", i.converted_at "convertedAt", i.phone, i.email, i.memo, i.created_by "createdBy",
             i.created_at "createdAt", i.updated_at "updatedAt", coalesce(c.company_name, c.name) "customerLabel", d.title "dealTitle"
        from inquiries i left join customers c on c.id = i.customer_id left join inquiry_sources s on s.id = i.source_id
        left join deals d on d.id = i.converted_deal_id
       where i.id = ${id}`;
    return row ?? null;
  });
}

/** 連絡先（メール・電話）が同じ既存の顧客（顧客に紐づけていない問い合わせで、重複登録を防ぐ候補） */
export async function matchingCustomers(email: string | null, phone: string | null): Promise<{ id: string; label: string; sub: string | null }[]> {
  if (!email && !phone) return [];
  const digits = phone?.replace(/\D/g, "") ?? "";
  return asCurrentUser(async (tx) => [...await tx<{ id: string; label: string; sub: string | null }[]>`
    select id, coalesce(company_name, name) label, concat_ws('・', name, email, phone) sub from customers
     where (${email}::text is not null and lower(email) = lower(${email}))
        or (${digits} <> '' and regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ${digits})
     limit 5`]);
}
