import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { ActivityTypeBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { Card } from "@/components/ui/card";
import { z } from "zod";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { getLookups, memberName } from "@/lib/data/lookups";
import { isDateString } from "@/lib/domain/dates";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABEL, type ActivityType } from "@/lib/domain/labels";
import { formatDate, formatDateTimeFull } from "@/lib/format";

export const metadata = { title: "活動履歴" };

const PAGE = 40;
const schema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  type: z.enum(ACTIVITY_TYPES).optional().catch(undefined),
  user: z.uuid().optional().catch(undefined),
  from: z.string().refine(isDateString).optional().catch(undefined),
  to: z.string().refine(isDateString).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

type Row = {
  id: string; type: ActivityType; occurredAt: Date; content: string; result: string | null; userId: string | null; nextActionOn: string | null;
  customerId: string | null; customerName: string | null; dealId: string | null; dealTitle: string | null; inquiryId: string | null; inquiryTitle: string | null;
};

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const params = await searchParams;
  const f = schema.parse(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v)));
  const page = f.page ?? 1;
  const [{ rows, total }, lookups] = await Promise.all([
    asCurrentUser(async (tx) => {
      const like = f.q ? `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
      const where = tx`where true
        ${like ? tx`and (a.content || ' ' || coalesce(a.result, '') || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.name, '')) ilike ${like}` : tx``}
        ${f.type ? tx`and a.activity_type = ${f.type}` : tx``}
        ${f.user ? tx`and a.user_id = ${f.user}` : tx``}
        ${f.from ? tx`and a.occurred_at >= (${f.from}::date)::timestamp at time zone 'Asia/Tokyo'` : tx``}
        ${f.to ? tx`and a.occurred_at < ((${f.to}::date + 1)::timestamp at time zone 'Asia/Tokyo')` : tx``}`;
      const [list, [count]] = await Promise.all([
        tx<Row[]>`
          select a.id, a.activity_type type, a.occurred_at "occurredAt", a.content, a.result, a.user_id "userId", a.next_action_on "nextActionOn",
                 a.customer_id "customerId", coalesce(c.company_name, c.name) "customerName", a.deal_id "dealId", d.title "dealTitle",
                 a.inquiry_id "inquiryId", i.title "inquiryTitle"
            from activities a left join customers c on c.id = a.customer_id left join deals d on d.id = a.deal_id left join inquiries i on i.id = a.inquiry_id
            ${where} order by a.occurred_at desc limit ${PAGE} offset ${(page - 1) * PAGE}`,
        tx<{ n: number }[]>`select count(*)::int n from activities a left join customers c on c.id = a.customer_id ${where}`,
      ]);
      return { rows: [...list], total: count.n };
    }),
    getLookups(),
  ]);
  const qs = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
    if (p > 1) q.set("page", String(p));
    return `/activities${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="活動履歴" description="電話・メール・商談など、チームの対応をまとめて見られます。記録は各詳細画面の「対応を記録」から" />
      <Card className="gap-0 py-0">
        <ListFilters
          placeholder="対応内容・結果・顧客名で検索"
          dateRange={{ label: "対応日" }}
          selects={[
            { key: "type", label: "種別", allLabel: "すべての種別", options: ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABEL[t] })) },
            { key: "user", label: "対応者", allLabel: "すべての対応者", options: lookups.members.map((m) => ({ value: m.id, label: m.name })) },
          ]}
        />
        {rows.length === 0 ? <EmptyState icon={MessagesSquare} title="対応履歴はありません" /> : (
          <>
            <ul className="divide-y">
              {rows.map((a) => (
                <li key={a.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_110px_1fr] sm:gap-4 sm:px-5">
                  <div className="text-xs text-muted-foreground tabular sm:pt-0.5">
                    {formatDateTimeFull(a.occurredAt)}
                    <div>{memberName(lookups, a.userId)}</div>
                  </div>
                  <div><ActivityTypeBadge type={a.type} /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-x-3 text-xs">
                      {a.customerId && <Link href={`/customers/${a.customerId}`} className="font-medium text-brand hover:underline">{a.customerName}</Link>}
                      {a.dealId && <Link href={`/deals/${a.dealId}`} className="text-muted-foreground hover:underline">案件：{a.dealTitle}</Link>}
                      {!a.dealId && a.inquiryId && <Link href={`/inquiries/${a.inquiryId}`} className="text-muted-foreground hover:underline">問い合わせ：{a.inquiryTitle}</Link>}
                    </div>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{a.content}</p>
                    {(a.result || a.nextActionOn) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.result && `結果：${a.result}`}{a.result && a.nextActionOn && "・"}{a.nextActionOn && `次回 ${formatDate(a.nextActionOn)}`}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t"><Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE))} total={total} pageSize={PAGE} hrefFor={qs} /></div>
          </>
        )}
      </Card>
    </div>
  );
}
