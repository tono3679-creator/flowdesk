import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle, Building2, CalendarClock, CalendarDays, CircleUserRound, Clock, GitMerge, Hash, Mail, Phone, Radio, Tag, Timer, UserRound,
} from "lucide-react";
import { ActivityDialog } from "@/components/activities/activity-dialog";
import { InquiryStatusBadge, PriorityBadge } from "@/components/common/badges";
import { BackLink, DetailItem, Muted } from "@/components/common/detail";
import { InquiryActions, LinkCustomerButton } from "@/components/inquiries/inquiry-actions";
import { RelatedTasks } from "@/components/tasks/related-tasks";
import { Timeline } from "@/components/timeline/timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { getInquiry, matchingCustomers } from "@/lib/data/inquiries";
import { getLookups, memberName } from "@/lib/data/lookups";
import { loadRelatedTasks, loadTimeline } from "@/lib/data/timeline";
import { isUnanswered } from "@/lib/domain/alerts";
import { formatMinutes, hoursBetween, toLocalDate } from "@/lib/domain/dates";
import { formatAgo, formatDate, formatDateTimeFull } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const inq = await getInquiry((await params).id);
  return { title: inq ? inq.title : "問い合わせ" };
}

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [inq, lookups] = await Promise.all([getInquiry(id), getLookups()]);
  if (!inq) notFound();
  const [timeline, tasks, matches] = await Promise.all([
    asCurrentUser((tx) => loadTimeline(tx, { inquiryId: inq.id })),
    asCurrentUser((tx) => loadRelatedTasks(tx, { inquiryId: inq.id })),
    inq.customerId ? Promise.resolve([]) : matchingCustomers(inq.email, inq.phone),
  ]);
  const now = new Date();
  const name = (uid: string | null) => memberName(lookups, uid);
  const canEdit = user.isManager || !inq.ownerId || inq.ownerId === user.userId;
  const late = isUnanswered(inq, now, user.settings.unansweredHours);
  const responseMinutes = inq.firstResponseAt ? Math.round((inq.firstResponseAt.getTime() - inq.receivedAt.getTime()) / 60_000) : null;
  const waitingHours = Math.floor(hoursBetween(inq.receivedAt, now));

  return (
    <div className="space-y-5">
      <BackLink href="/inquiries" label="問い合わせ一覧" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground tabular">No.{inq.number}</span>
            <InquiryStatusBadge status={inq.status} />
            <PriorityBadge priority={inq.priority} labels={user.settings.priorityLabels} />
          </div>
          <h1 className="text-keep mt-1 text-xl font-bold tracking-tight sm:text-2xl">{inq.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTimeFull(inq.receivedAt)} 受付（{formatAgo(inq.receivedAt, now)}）・担当 {name(inq.ownerId)}
          </p>
        </div>
        <InquiryActions
          id={inq.id} title={inq.title} status={inq.status} ownerId={inq.ownerId} canEdit={canEdit} canDelete={user.isManager}
          dealTypes={user.settings.dealTypes} category={inq.category} hasContact={!inq.customerId}
        />
      </div>

      {late && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-danger-soft px-4 py-3 text-sm text-danger-strong">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{user.settings.unansweredHours}時間以上未対応の問い合わせがあります（受付から{waitingHours}時間）</p>
            <p>お客様へ連絡したら「対応を記録」から残してください。記録すると自動で「対応中」になります。</p>
          </div>
        </div>
      )}
      {inq.status === "converted" && inq.convertedDealId && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm text-success-strong">
          <GitMerge className="size-4" aria-hidden />
          <span>{formatDate(inq.convertedAt)} に案件化しました：</span>
          <Link href={`/deals/${inq.convertedDealId}`} className="font-semibold underline">{inq.dealTitle}</Link>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader><CardTitle className="text-base">問い合わせ内容</CardTitle></CardHeader>
            <CardContent className="grid gap-5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{inq.content ?? <Muted>内容は入力されていません</Muted>}</p>
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <DetailItem icon={Radio} label="問い合わせ経路">{inq.sourceName ?? <Muted />}</DetailItem>
                <DetailItem icon={Tag} label="問い合わせ種別">{inq.category ?? <Muted />}</DetailItem>
                <DetailItem icon={CalendarClock} label="次回対応予定日">{inq.nextActionOn ? formatDate(inq.nextActionOn) : <Muted />}</DetailItem>
                <DetailItem icon={Timer} label="初回対応">
                  {inq.firstResponseAt ? `${formatDateTimeFull(inq.firstResponseAt)}（${formatMinutes(responseMinutes)}）` : <span className="text-warning-strong">まだ対応していません</span>}
                </DetailItem>
                <DetailItem icon={Clock} label="最終対応日時">{inq.lastActivityAt ? formatDateTimeFull(inq.lastActivityAt) : <Muted />}</DetailItem>
                <DetailItem icon={Hash} label="登録">{name(inq.createdBy)}・{formatDate(inq.createdAt)}</DetailItem>
              </dl>
              {inq.memo && (
                <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <div className="text-xs font-medium text-muted-foreground">メモ</div>
                  <p className="whitespace-pre-wrap">{inq.memo}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
              <CardTitle className="text-base">対応履歴</CardTitle>
              <ActivityDialog size="sm" scope={{ inquiry_id: inq.id, customer_id: inq.customerId, deal_id: inq.convertedDealId }} />
            </CardHeader>
            <CardContent className="px-0"><Timeline events={timeline} userName={name} showDeal /></CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader><CardTitle className="text-base">お客様</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm">
              {inq.customerId ? (
                <Link href={`/customers/${inq.customerId}`} className="flex items-center gap-2 rounded-md border px-3 py-2 font-medium text-brand hover:bg-accent/50">
                  <Building2 className="size-4" aria-hidden />{inq.customerLabel}
                </Link>
              ) : (
                <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-strong">顧客は未登録です。案件化すると、この連絡先で顧客を作成します。</p>
              )}
              <dl className="grid gap-3">
                <DetailItem icon={Building2} label="会社名">{inq.companyName ?? <Muted>個人</Muted>}</DetailItem>
                <DetailItem icon={UserRound} label="氏名">{inq.contactName ?? <Muted />}</DetailItem>
                <DetailItem icon={Phone} label="電話番号">{inq.phone ? <a href={`tel:${inq.phone}`} className="text-brand hover:underline">{inq.phone}</a> : <Muted />}</DetailItem>
                <DetailItem icon={Mail} label="メールアドレス">{inq.email ? <a href={`mailto:${inq.email}`} className="break-all text-brand hover:underline">{inq.email}</a> : <Muted />}</DetailItem>
                <DetailItem icon={CircleUserRound} label="担当者">{name(inq.ownerId)}</DetailItem>
                <DetailItem icon={CalendarDays} label="受付日">{formatDate(toLocalDate(inq.receivedAt))}</DetailItem>
              </dl>
              {matches.length > 0 && (
                <div className="grid gap-2 rounded-md border border-dashed p-3">
                  <p className="text-xs font-medium text-muted-foreground">連絡先が同じ顧客が見つかりました</p>
                  {matches.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/customers/${m.id}`} className="font-medium hover:underline">{m.label}</Link>
                        <div className="truncate text-xs text-muted-foreground">{m.sub}</div>
                      </div>
                      {canEdit && <LinkCustomerButton inquiryId={inq.id} customerId={m.id} label={m.label} />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3 sm:px-5"><CardTitle className="text-base">関連タスク</CardTitle></CardHeader>
            <CardContent className="px-0">
              <RelatedTasks
                tasks={tasks.map((t) => ({ ...t, assignee: name(t.assigneeId) }))} today={toLocalDate(now)} priorityLabels={user.settings.priorityLabels}
                newHref={`/tasks/new?inquiry=${inq.id}${inq.customerId ? `&customer=${inq.customerId}` : ""}`}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
