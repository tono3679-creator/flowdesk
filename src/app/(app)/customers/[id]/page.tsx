import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Building2, CircleUserRound, Inbox, Mail, MapPin, Pencil, Phone, Plus, UserRound } from "lucide-react";
import { ActivityDialog } from "@/components/activities/activity-dialog";
import { InquiryStatusBadge, RankMark, StageBadge, TagChip } from "@/components/common/badges";
import { BackLink, DetailItem, MiniStat, Muted } from "@/components/common/detail";
import { EmptyState } from "@/components/common/empty-state";
import { CustomerDeleteButton } from "@/components/customers/customer-delete";
import { RelatedTasks } from "@/components/tasks/related-tasks";
import { Timeline } from "@/components/timeline/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/data/customers";
import { getLookups, memberName } from "@/lib/data/lookups";
import { loadRelatedTasks, loadTimeline } from "@/lib/data/timeline";
import { diffDays, startOfYear, toLocalDate } from "@/lib/domain/dates";
import { CUSTOMER_TYPE_LABEL, type InquiryStatus } from "@/lib/domain/labels";
import { formatDate, formatDateTime, formatYen } from "@/lib/format";

export const metadata = { title: "顧客の詳細" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const today = toLocalDate(new Date());
  const [data, lookups] = await Promise.all([getCustomer(id, startOfYear(today)), getLookups()]);
  if (!data) notFound();
  const { customer: c, deals, inquiries } = data;
  const [timeline, tasks] = await Promise.all([
    asCurrentUser((tx) => loadTimeline(tx, { customerId: c.id })),
    asCurrentUser((tx) => loadRelatedTasks(tx, { customerId: c.id })),
  ]);
  const name = (uid: string | null) => memberName(lookups, uid);
  const canEdit = user.isManager || !c.ownerId || c.ownerId === user.userId || c.createdBy === user.userId;
  const tags = c.tagIds.map((t) => lookups.tags.find((x) => x.id === t)).filter((t) => !!t);
  const sinceContact = c.lastContactAt ? diffDays(toLocalDate(c.lastContactAt), today) : null;
  const pipeline = deals.filter((d) => d.category === "open").reduce((s, d) => s + d.expectedRevenue, 0);

  return (
    <div className="space-y-5">
      <BackLink href="/customers" label="顧客一覧" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular">No.{c.number}</span>
            <span>{CUSTOMER_TYPE_LABEL[c.type]}</span>
            {c.rank && <RankMark rank={c.rank} />}
            {tags.map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)}
          </div>
          <h1 className="text-keep mt-1 text-xl font-bold tracking-tight sm:text-2xl">{c.companyName ?? c.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{[c.department, c.position, c.companyName ? c.name : null].filter(Boolean).join("・") || "　"}　担当 {name(c.ownerId)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button variant="outline" asChild><Link href={`/customers/${c.id}/edit`}><Pencil />編集</Link></Button>}
          {user.isManager && <CustomerDeleteButton id={c.id} hasDeals={c.dealCount > 0} />}
          <Button variant="outline" asChild><Link href={`/deals/new?customer=${c.id}`}><Briefcase />案件を作成</Link></Button>
          <ActivityDialog scope={{ customer_id: c.id }} />
        </div>
      </div>

      <section aria-label="この顧客の数字" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="受注金額（累計）" value={formatYen(c.wonAmount)} sub={`受注 ${c.wonCount}件`} />
        <MiniStat label="累計売上" value={formatYen(c.totalSales)} sub={`今年 ${formatYen(c.salesThisYear)}`} />
        <MiniStat label="進行中の案件" value={`${c.openDeals}件`} sub={`受注見込 ${formatYen(pipeline)}`} />
        <MiniStat label="問い合わせ" value={`${c.inquiryCount}件`} />
        <MiniStat
          label="最終接触日" value={c.lastContactAt ? formatDate(c.lastContactAt) : "—"}
          sub={sinceContact === null ? "まだ接触していません" : `${sinceContact}日前`}
          tone={sinceContact !== null && sinceContact >= user.settings.noContactDays ? "warning" : undefined}
        />
        <MiniStat label="次回予定" value={c.nextActionOn ? formatDate(c.nextActionOn) : "—"} tone={c.nextActionOn && c.nextActionOn < today ? "danger" : undefined}
          sub={c.nextActionOn && c.nextActionOn < today ? "予定日を過ぎています" : undefined} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="grid min-w-0 content-start gap-5">
          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 sm:px-5">
              <CardTitle className="text-base">案件履歴</CardTitle>
              <span className="text-xs text-muted-foreground">{deals.length}件</span>
            </CardHeader>
            <CardContent className="px-0">
              {deals.length === 0 ? (
                <EmptyState icon={Briefcase} title="案件はまだありません" className="py-6"
                  action={<Button size="sm" variant="outline" asChild><Link href={`/deals/new?customer=${c.id}`}><Plus />案件を作成</Link></Button>} />
              ) : (
                <ul className="divide-y">
                  {deals.map((d) => (
                    <li key={d.id}>
                      <Link href={`/deals/${d.id}`} className="flex flex-col gap-1 px-4 py-2.5 hover:bg-accent/50 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{d.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {name(d.ownerId)}・{d.closedOn ? `${formatDate(d.closedOn)} 確定` : d.expectedCloseOn ? `受注予定 ${formatDate(d.expectedCloseOn)}` : "受注予定日 未定"}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="tabular text-sm font-semibold">{formatYen(d.actualAmount ?? d.estimatedAmount)}</span>
                          <StageBadge name={d.stageName} category={d.category} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
              <CardTitle className="text-base">対応のタイムライン</CardTitle>
              <ActivityDialog size="sm" variant="outline" scope={{ customer_id: c.id }} />
            </CardHeader>
            <CardContent className="px-0"><Timeline events={timeline} userName={name} showDeal /></CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <DetailItem icon={Building2} label="会社名">{c.companyName ?? <Muted>個人</Muted>}</DetailItem>
                <DetailItem icon={UserRound} label="氏名">{c.name ?? <Muted />}{c.position && <span className="text-muted-foreground">（{c.position}）</span>}</DetailItem>
                <DetailItem icon={Phone} label="電話番号">{c.phone ? <a href={`tel:${c.phone}`} className="text-brand hover:underline">{c.phone}</a> : <Muted />}</DetailItem>
                <DetailItem icon={Mail} label="メールアドレス">{c.email ? <a href={`mailto:${c.email}`} className="break-all text-brand hover:underline">{c.email}</a> : <Muted />}</DetailItem>
                <DetailItem icon={MapPin} label="住所">{c.address ?? <Muted />}</DetailItem>
                <DetailItem icon={CircleUserRound} label="担当者">{name(c.ownerId)}</DetailItem>
              </dl>
              {c.memo && <p className="mt-4 rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap">{c.memo}</p>}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3 sm:px-5"><CardTitle className="text-base">タスク</CardTitle></CardHeader>
            <CardContent className="px-0">
              <RelatedTasks tasks={tasks.map((t) => ({ ...t, assignee: name(t.assigneeId) }))} today={today} priorityLabels={user.settings.priorityLabels}
                newHref={`/tasks/new?customer=${c.id}`} />
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 sm:px-5">
              <CardTitle className="text-base">問い合わせ履歴</CardTitle>
              <span className="text-xs text-muted-foreground">{inquiries.length}件</span>
            </CardHeader>
            <CardContent className="px-0">
              {inquiries.length === 0 ? <EmptyState icon={Inbox} title="問い合わせはありません" className="py-6" /> : (
                <ul className="divide-y">
                  {inquiries.map((i) => (
                    <li key={i.id}>
                      <Link href={`/inquiries/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{i.title}</div>
                          <div className="text-xs text-muted-foreground tabular">{formatDateTime(i.receivedAt)}・{name(i.ownerId)}</div>
                        </div>
                        <InquiryStatusBadge status={i.status as InquiryStatus} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
