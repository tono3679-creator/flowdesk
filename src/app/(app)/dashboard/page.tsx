import Link from "next/link";
import {
  AlarmClock, ArrowRight, Briefcase, CalendarCheck, CircleAlert, Gauge, GitMerge, Inbox, JapaneseYen, PartyPopper, Percent, Timer, TrendingUp,
} from "lucide-react";
import { AlertList } from "@/components/alerts/alert-list";
import { InquiryStatusBadge, PriorityBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/data/dashboard";
import { getLookups, memberName } from "@/lib/data/lookups";
import { countByKind } from "@/lib/domain/alerts";
import { formatMinutes } from "@/lib/domain/dates";
import type { InquiryStatus, Priority } from "@/lib/domain/labels";
import { formatDateLong, formatDateTime, formatNumber, formatPercent, formatYen, formatYenCompact } from "@/lib/format";

export const metadata = { title: "ダッシュボード" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const [data, lookups, params] = await Promise.all([getDashboard(user), getLookups(), searchParams]);
  const k = data.kpis;
  const owner = (id: string | null) => memberName(lookups, id);
  const counts = countByKind(data.alerts);
  const maxPipeline = Math.max(1, ...data.pipeline.map((p) => p.expected));
  const trend = data.monthly.map((m) => ({ label: `${Number(m.month.slice(5))}月`, inquiries: m.inquiries, converted: m.converted, wonAmount: m.wonAmount }));
  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${firstName}さん、お疲れさまです`}
        description={`${formatDateLong(new Date())}・${user.isManager ? `${user.organizationName} 全体` : "あなたの担当分"}の状況です`}
        actions={
          <>
            <Button variant="outline" asChild><Link href="/inquiries/new"><Inbox />問い合わせを登録</Link></Button>
            <Button asChild><Link href="/deals/board"><Briefcase />案件ボード</Link></Button>
          </>
        }
      />
      {params.denied && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-2 text-sm text-warning-strong">
          その画面は管理者・マネージャーだけが見られます。役割を切り替えるとお試しいただけます。
        </p>
      )}

      <section aria-label="主な指標" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="今月の問い合わせ" value={formatNumber(k.inquiriesThisMonth, "件")} icon={Inbox} href="/inquiries" sub={`先月 ${formatNumber(k.inquiriesLastMonth)}件`} />
        <KpiCard
          label="未対応の問い合わせ" value={formatNumber(k.unanswered, "件")} icon={CircleAlert} href="/inquiries?status=new"
          tone={k.unansweredOverdue > 0 ? "danger" : k.unanswered > 0 ? "warning" : undefined}
          sub={k.unansweredOverdue > 0 ? `うち${user.settings.unansweredHours}時間超 ${k.unansweredOverdue}件` : "対応漏れなし"}
        />
        <KpiCard label="対応中の案件" value={formatNumber(k.openDeals, "件")} icon={Briefcase} href="/deals" sub={`見積総額 ${formatYenCompact(k.pipelineEstimated)}`} />
        <KpiCard label="今月の案件化" value={formatNumber(k.convertedThisMonth, "件")} icon={GitMerge} sub={`案件化率 ${formatPercent(k.conversionRateThisMonth)}`} />
        <KpiCard label="受注率（今月）" value={formatPercent(k.winRateThisMonth)} icon={Percent} sub={`直近3か月 ${formatPercent(k.winRate3Months)}`} />
        <KpiCard label="今月の受注金額" value={formatYen(k.wonAmountThisMonth)} icon={JapaneseYen} tone="success" sub={`${k.wonCountThisMonth}件受注`} />
        <KpiCard label="受注見込金額" value={formatYen(k.pipelineExpected)} icon={TrendingUp} sub="見積金額 × 受注確度の合計" />
        <KpiCard
          label="期限超過のタスク" value={formatNumber(k.overdueTasks, "件")} icon={AlarmClock} href="/tasks?view=overdue"
          tone={k.overdueTasks > 0 ? "danger" : undefined} sub={k.overdueTasks > 0 ? "すぐに対応が必要です" : "期限内です"}
        />
        <KpiCard
          label="平均初回対応時間" value={formatMinutes(k.avgFirstResponseMinutes)} icon={Timer}
          sub={`先月 ${formatMinutes(k.avgFirstResponseLastMonth)}`}
        />
        <KpiCard label="対応漏れアラート" value={formatNumber(data.alerts.length, "件")} icon={Gauge} href="/alerts" tone={data.alerts.length > 0 ? "warning" : undefined}
          sub={`見積フォロー ${counts.quote_follow}・未接触 ${counts.no_contact}`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-4 sm:px-5">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="size-4.5 text-brand" aria-hidden />今日やること</CardTitle>
              <CardDescription>対応漏れアラートと今日が期限のタスクを、優先度の高い順に並べています</CardDescription>
            </div>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-semibold text-primary-foreground tabular" aria-label={`${data.today.length}件`}>{data.today.length}</span>
          </CardHeader>
          <CardContent className="px-0">
            {data.today.length === 0 ? (
              <EmptyState icon={PartyPopper} title="今日やるべきことはすべて片付いています" description="新しい問い合わせが来たら、ここに表示されます。" />
            ) : (
              <>
                <AlertList alerts={data.today.slice(0, 10)} ownerName={owner} dense />
                {data.today.length > 10 && (
                  <div className="border-t px-5 py-3 text-right">
                    <Link href="/alerts" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                      残り{data.today.length - 10}件を見る<ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-base">進行中の案件（受注見込）</CardTitle>
              <CardDescription>ステータス別の件数と、見積金額 × 受注確度の合計</CardDescription>
            </CardHeader>
            <CardContent>
              {data.pipeline.every((p) => p.count === 0) ? (
                <EmptyState title="進行中の案件はありません" className="py-6" />
              ) : (
                <ul className="grid gap-3">
                  {data.pipeline.map((p) => (
                    <li key={p.column}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{p.column}<span className="ml-1.5 text-xs text-muted-foreground tabular">{p.count}件</span></span>
                        <span className="tabular font-semibold">{formatYen(p.expected)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(p.expected / maxPipeline) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-4 sm:px-5">
              <CardTitle className="text-base">最近の問い合わせ</CardTitle>
              <Link href="/inquiries" className="text-sm font-medium text-brand hover:underline">一覧へ</Link>
            </CardHeader>
            <CardContent className="px-0">
              {data.recentInquiries.length === 0 ? (
                <EmptyState title="問い合わせはまだありません" className="py-6" />
              ) : (
                <ul className="divide-y">
                  {data.recentInquiries.map((i) => (
                    <li key={i.id}>
                      <Link href={`/inquiries/${i.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/50 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{i.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {formatDateTime(i.receivedAt)}・{i.company ?? i.contact ?? "—"}・{owner(i.ownerId)}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <InquiryStatusBadge status={i.status as InquiryStatus} />
                          <PriorityBadge priority={i.priority as Priority} labels={user.settings.priorityLabels} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">直近6か月の推移</CardTitle>
          <CardDescription>問い合わせ件数・案件化件数（受付月）と受注金額（受注月）</CardDescription>
        </CardHeader>
        <CardContent><TrendChart data={trend} /></CardContent>
      </Card>
    </div>
  );
}
