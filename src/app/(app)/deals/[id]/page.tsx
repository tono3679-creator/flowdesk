import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Building2, CalendarCheck, CalendarClock, CalendarRange, CircleUserRound, FileText, Inbox, Pencil, Radio, Tag, XCircle } from "lucide-react";
import { ActivityDialog } from "@/components/activities/activity-dialog";
import { StageBadge } from "@/components/common/badges";
import { BackLink, DetailItem, MiniStat, Muted } from "@/components/common/detail";
import { DealDeleteButton, DealStageMenu } from "@/components/deals/deal-actions";
import { RelatedTasks } from "@/components/tasks/related-tasks";
import { Timeline } from "@/components/timeline/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { getDeal } from "@/lib/data/deals";
import { getLookups, memberName } from "@/lib/data/lookups";
import { loadRelatedTasks, loadTimeline } from "@/lib/data/timeline";
import { daysSince, isDormant, needsQuoteFollow } from "@/lib/domain/alerts";
import { diffDays, toLocalDate } from "@/lib/domain/dates";
import { formatDate, formatYen } from "@/lib/format";

export const metadata = { title: "案件の詳細" };

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [d, lookups] = await Promise.all([getDeal(id), getLookups()]);
  if (!d) notFound();
  const [timeline, tasks] = await Promise.all([
    asCurrentUser((tx) => loadTimeline(tx, { dealId: d.id })),
    asCurrentUser((tx) => loadRelatedTasks(tx, { dealId: d.id })),
  ]);
  const today = toLocalDate(new Date());
  const name = (uid: string | null) => memberName(lookups, uid);
  const canEdit = user.isManager || d.ownerId === user.userId || d.createdBy === user.userId;
  const rules = user.settings;
  const quoteFollow = needsQuoteFollow(d, today, rules.quoteFollowDays);
  const dormant = isDormant(d, today, rules.noContactDays, rules.timezone);
  const won = d.category === "won" || d.category === "completed";
  const sinceContact = d.lastContactAt ? diffDays(toLocalDate(d.lastContactAt, rules.timezone), today) : null;

  return (
    <div className="space-y-5">
      <BackLink href="/deals" label="案件一覧" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular">No.{d.number}</span>
            <StageBadge name={d.stageName} category={d.category} />
            {d.dealType && <span>{d.dealType}</span>}
          </div>
          <h1 className="text-keep mt-1 text-xl font-bold tracking-tight sm:text-2xl">{d.title}</h1>
          <p className="mt-1 text-sm">
            <Link href={`/customers/${d.customerId}`} className="font-medium text-brand hover:underline">{d.customerName}</Link>
            <span className="text-muted-foreground">・担当 {name(d.ownerId)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <DealStageMenu dealId={d.id} stageId={d.stageId} stages={lookups.stages.filter((s) => s.isActive)} />}
          {canEdit && <Button variant="outline" asChild><Link href={`/deals/${d.id}/edit`}><Pencil />編集</Link></Button>}
          {user.isManager && <DealDeleteButton id={d.id} fromInquiry={!!d.inquiryId} />}
          <ActivityDialog scope={{ deal_id: d.id, customer_id: d.customerId, inquiry_id: d.inquiryId }} />
        </div>
      </div>

      {(quoteFollow || dormant) && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            {quoteFollow && d.quoteSubmittedOn && <p className="font-semibold">見積提出から{daysSince(d.quoteSubmittedOn, today)}日経過しています。フォローしてください</p>}
            {dormant && <p className="font-semibold">{rules.noContactDays}日以上連絡していない案件です（最終接触 {sinceContact === null ? "なし" : `${sinceContact}日前`}）</p>}
          </div>
        </div>
      )}
      {d.category === "lost" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-danger-soft px-4 py-3 text-sm text-danger-strong">
          <XCircle className="size-4" aria-hidden />{formatDate(d.closedOn)} に失注（理由：{d.lostReason ?? "未入力"}）
        </div>
      )}

      <section aria-label="金額" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="見積金額" value={formatYen(d.estimatedAmount)} />
        <MiniStat label="受注確度" value={`${d.probability}%`} sub={d.probabilityManual ? "手動で設定" : "ステータスの既定値"} />
        <MiniStat label="受注見込金額" value={formatYen(d.expectedRevenue)} sub="見積金額 × 受注確度" />
        <MiniStat label="受注金額" value={won ? formatYen(d.actualAmount ?? d.estimatedAmount) : "—"} sub={won ? `${formatDate(d.closedOn)} 受注` : "受注すると表示されます"} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
            <CardTitle className="text-base">対応のタイムライン</CardTitle>
            <ActivityDialog size="sm" variant="outline" scope={{ deal_id: d.id, customer_id: d.customerId, inquiry_id: d.inquiryId }} />
          </CardHeader>
          <CardContent className="px-0"><Timeline events={timeline} userName={name} /></CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader><CardTitle className="text-base">案件の情報</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <DetailItem icon={Building2} label="顧客"><Link href={`/customers/${d.customerId}`} className="text-brand hover:underline">{d.customerName}</Link></DetailItem>
                <DetailItem icon={CircleUserRound} label="担当者">{name(d.ownerId)}</DetailItem>
                <DetailItem icon={Tag} label="案件種別">{d.dealType ?? <Muted />}</DetailItem>
                <DetailItem icon={Inbox} label="元の問い合わせ">
                  {d.inquiryId ? <Link href={`/inquiries/${d.inquiryId}`} className="text-brand hover:underline">{d.inquiryTitle}</Link> : <Muted>なし（直接作成）</Muted>}
                </DetailItem>
                <DetailItem icon={Radio} label="問い合わせ経路">{d.sourceName ?? <Muted />}</DetailItem>
                <DetailItem icon={CalendarRange} label="開始日・完了予定日">{formatDate(d.startedOn)} 〜 {formatDate(d.expectedCompleteOn)}</DetailItem>
                <DetailItem icon={FileText} label="見積提出日">{formatDate(d.quoteSubmittedOn)}</DetailItem>
                <DetailItem icon={CalendarCheck} label="受注予定日">
                  <span className={d.category === "open" && d.expectedCloseOn && d.expectedCloseOn < today ? "font-semibold text-danger-strong" : ""}>{formatDate(d.expectedCloseOn)}</span>
                </DetailItem>
                <DetailItem icon={CalendarClock} label="次回フォロー日">{formatDate(d.nextFollowUpOn)}</DetailItem>
                <DetailItem icon={CalendarClock} label="最終接触日">{formatDate(d.lastContactAt)}</DetailItem>
                {won && <DetailItem icon={CalendarCheck} label="売上計上日">{formatDate(d.revenueOn ?? d.completedOn ?? d.closedOn)}</DetailItem>}
              </dl>
              {d.memo && <p className="mt-4 rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap">{d.memo}</p>}
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3 sm:px-5"><CardTitle className="text-base">タスク</CardTitle></CardHeader>
            <CardContent className="px-0">
              <RelatedTasks tasks={tasks.map((t) => ({ ...t, assignee: name(t.assigneeId) }))} today={today} priorityLabels={rules.priorityLabels}
                newHref={`/tasks/new?deal=${d.id}&customer=${d.customerId}`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
