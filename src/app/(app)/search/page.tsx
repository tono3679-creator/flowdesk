import Link from "next/link";
import { Briefcase, Building2, Inbox, ListTodo, Search, type LucideIcon } from "lucide-react";
import { InquiryStatusBadge, StageBadge, TaskStatusBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asCurrentUser, requireUser } from "@/lib/auth";
import type { InquiryStatus, StageCategory, TaskStatus } from "@/lib/domain/labels";
import { formatDate, formatYen } from "@/lib/format";

export const metadata = { title: "検索" };

const LIMIT = 10;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  if (!q) {
    return (
      <div className="space-y-5">
        <PageHeader title="検索" />
        <Card><EmptyState icon={Search} title="キーワードを入力してください" description="画面上部の検索欄から、顧客・会社・問い合わせ・案件・タスクをまとめて探せます。" /></Card>
      </div>
    );
  }
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const r = await asCurrentUser(async (tx) => {
    const [customers, inquiries, deals, tasks] = await Promise.all([
      tx<{ id: string; label: string; sub: string | null }[]>`
        select id, coalesce(company_name, name) label, concat_ws('・', case when company_name is not null then name end, phone, email) sub from customers
         where coalesce(company_name, '') || ' ' || coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(memo, '') ilike ${like}
         order by updated_at desc limit ${LIMIT}`,
      tx<{ id: string; title: string; company: string | null; status: InquiryStatus; received_at: Date }[]>`
        select id, title, coalesce(company_name, contact_name) company, status, received_at from inquiries
         where title || ' ' || coalesce(content, '') || ' ' || coalesce(company_name, '') || ' ' || coalesce(contact_name, '') || ' ' || coalesce(email, '') ilike ${like}
         order by received_at desc limit ${LIMIT}`,
      tx<{ id: string; title: string; customer: string; stage: string; category: StageCategory; amount: number }[]>`
        select d.id, d.title, coalesce(c.company_name, c.name) customer, s.name stage, s.category, d.estimated_amount amount
          from deals d join customers c on c.id = d.customer_id join pipeline_stages s on s.id = d.stage_id
         where d.title || ' ' || coalesce(d.memo, '') || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.name, '') ilike ${like}
         order by d.updated_at desc limit ${LIMIT}`,
      tx<{ id: string; title: string; status: TaskStatus; due_on: string | null }[]>`
        select id, title, status, due_on from tasks where title || ' ' || coalesce(description, '') ilike ${like} order by (status = 'done'), due_on nulls last limit ${LIMIT}`,
    ]);
    return { customers: [...customers], inquiries: [...inquiries], deals: [...deals], tasks: [...tasks] };
  });
  const total = r.customers.length + r.inquiries.length + r.deals.length + r.tasks.length;

  return (
    <div className="space-y-5">
      <PageHeader title={`「${q}」の検索結果`} description={total === 0 ? "見つかりませんでした" : `各種類ごとに最大${LIMIT}件を表示しています`} />
      {total === 0 ? <Card><EmptyState icon={Search} title="一致するものはありません" description="会社名・氏名・電話番号・メールアドレス・件名などで探せます。" /></Card> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Group icon={Building2} title="顧客" count={r.customers.length} more={`/customers?q=${encodeURIComponent(q)}`}>
            {r.customers.map((c) => <Item key={c.id} href={`/customers/${c.id}`} title={c.label} sub={c.sub} />)}
          </Group>
          <Group icon={Inbox} title="問い合わせ" count={r.inquiries.length} more={`/inquiries?q=${encodeURIComponent(q)}`}>
            {r.inquiries.map((i) => <Item key={i.id} href={`/inquiries/${i.id}`} title={i.title} sub={`${formatDate(i.received_at)}・${i.company ?? "—"}`} badge={<InquiryStatusBadge status={i.status} />} />)}
          </Group>
          <Group icon={Briefcase} title="案件" count={r.deals.length} more={`/deals?q=${encodeURIComponent(q)}`}>
            {r.deals.map((d) => <Item key={d.id} href={`/deals/${d.id}`} title={d.title} sub={`${d.customer}・${formatYen(d.amount)}`} badge={<StageBadge name={d.stage} category={d.category} />} />)}
          </Group>
          <Group icon={ListTodo} title="タスク" count={r.tasks.length} more={`/tasks?view=team&q=${encodeURIComponent(q)}`}>
            {r.tasks.map((t) => <Item key={t.id} href={`/tasks/${t.id}/edit`} title={t.title} sub={t.due_on ? `期限 ${formatDate(t.due_on)}` : "期限なし"} badge={<TaskStatusBadge status={t.status} />} />)}
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ icon: Icon, title, count, more, children }: { icon: LucideIcon; title: string; count: number; more: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 sm:px-5">
        <CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4 text-brand" aria-hidden />{title}<span className="text-sm font-normal text-muted-foreground">{count}件</span></CardTitle>
        {count > 0 && <Link href={more} className="text-sm text-brand hover:underline">一覧で見る</Link>}
      </CardHeader>
      <CardContent className="px-0">{count === 0 ? <p className="px-5 py-4 text-sm text-muted-foreground">該当なし</p> : <ul className="divide-y">{children}</ul>}</CardContent>
    </Card>
  );
}

function Item({ href, title, sub, badge }: { href: string; title: string; sub: string | null; badge?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 sm:px-5">
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{title}</div>{sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}</div>
        {badge}
      </Link>
    </li>
  );
}
