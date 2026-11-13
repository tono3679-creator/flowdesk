import { CalendarRange, CheckCircle2, Clock, GitMerge, Inbox, JapaneseYen, Lightbulb, Percent, Timer, TrendingUp, Trophy, XCircle } from "lucide-react";
import { Delta } from "@/components/analytics/delta";
import { RangeTabs } from "@/components/analytics/range-tabs";
import { ColumnChart, RankingChart, TrendLineChart } from "@/components/charts/charts";
import { EmptyState } from "@/components/common/empty-state";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { getAnalytics, periodOf, previousOf, RANGE_LABEL, RANGES, type RangeKey } from "@/lib/data/analytics";
import { formatMinutes, toLocalDate } from "@/lib/domain/dates";
import { formatDate, formatNumber, formatPercent, formatYen } from "@/lib/format";

export const metadata = { title: "営業分析" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireRole(["admin", "manager"]);
  const { range: raw } = await searchParams;
  const range: RangeKey = (RANGES as readonly string[]).includes(raw ?? "") ? (raw as RangeKey) : "6m";
  const today = toLocalDate(new Date(), user.settings.timezone);
  const period = periodOf(range, today);
  const a = await getAnalytics(user, period, previousOf(range, today));
  const s = a.summary;
  // 前の期間にデータが無いときは比較しない（「前期間 —」と表示）
  const p = a.comparable ? a.previous : { ...a.previous, inquiries: null, conversionRate: null, winRate: null, lossRate: null, won: null, wonAmount: null, avgDealSize: null, avgFirstResponseMinutes: null, firstResponseRate: null };
  const monthly = a.monthly.map((m) => ({ ...m, label: `${Number(m.month.slice(5))}月` }));
  const sources = a.sources.filter((x) => x.inquiries > 0);
  const best = [...sources].filter((x) => x.inquiries >= 5).sort((x, y) => (y.inquiryWinRate ?? 0) - (x.inquiryWinRate ?? 0))[0];
  const most = [...sources].sort((x, y) => y.inquiries - x.inquiries)[0];
  const owners = a.owners.filter((o) => o.ownerId !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="営業分析"
        description={`${RANGE_LABEL[range]}（${formatDate(period.from)}〜${formatDate(period.to)}）。問い合わせは受付日、受注・失注は確定日で集計しています`}
        actions={<RangeTabs current={range} basePath="/analytics" />}
      />

      <section aria-label="主な指標" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="問い合わせ件数" icon={Inbox} value={formatNumber(s.inquiries, "件")} sub={<Delta current={s.inquiries} previous={p.inquiries} kind="count" />} />
        <KpiCard label="案件化率" icon={GitMerge} value={formatPercent(s.conversionRate)} sub={<Delta current={s.conversionRate} previous={p.conversionRate} kind="percent" />} />
        <KpiCard label="受注率" icon={Percent} value={formatPercent(s.winRate)} sub={<Delta current={s.winRate} previous={p.winRate} kind="percent" />} />
        <KpiCard label="失注率" icon={XCircle} value={formatPercent(s.lossRate)} sub={<Delta current={s.lossRate} previous={p.lossRate} kind="percent" better="down" />} />
        <KpiCard label="受注件数" icon={Trophy} value={formatNumber(s.won, "件")} sub={<Delta current={s.won} previous={p.won} kind="count" />} />
        <KpiCard label="受注金額" icon={JapaneseYen} tone="success" value={formatYen(s.wonAmount)} sub={<Delta current={s.wonAmount} previous={p.wonAmount} kind="yen" />} />
        <KpiCard label="平均受注単価" icon={TrendingUp} value={formatYen(s.avgDealSize === null ? null : Math.round(s.avgDealSize))} sub={<Delta current={s.avgDealSize} previous={p.avgDealSize} kind="yen" />} />
        <KpiCard label="平均受注期間" icon={CalendarRange} value={s.avgDaysToWin === null ? "—" : `${Math.round(s.avgDaysToWin)}日`} sub="問い合わせから受注まで" />
        <KpiCard label="平均初回対応時間" icon={Timer} value={formatMinutes(s.avgFirstResponseMinutes)}
          sub={<Delta current={s.avgFirstResponseMinutes} previous={p.avgFirstResponseMinutes} kind="minutes" better="down" />} />
        <KpiCard label={`初回対応率（${user.settings.firstResponseTargetHours}時間以内）`} icon={Clock} value={formatPercent(s.firstResponseRate)}
          sub={<Delta current={s.firstResponseRate} previous={p.firstResponseRate} kind="percent" />} />
      </section>

      <Card className="border-brand/30 bg-accent/40">
        <CardHeader className="flex flex-row items-start gap-3">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div>
            <CardTitle className="text-base">問い合わせ経路の分析：どの経路が売上につながっているか</CardTitle>
            <CardDescription className="mt-1 text-foreground">
              {sources.length === 0 ? "この期間の問い合わせはありません。" : (
                <>
                  {most && <>問い合わせがいちばん多いのは<strong>「{most.name}」</strong>（{most.inquiries}件）です。</>}
                  {best && <>受注につながりやすいのは<strong>「{best.name}」</strong>で、問い合わせの{formatPercent(best.inquiryWinRate)}が受注、1件あたりの受注金額は{formatYen(best.revenuePerInquiry)}です。</>}
                </>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        {sources.length > 0 && (
          <CardContent className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="grid gap-5">
              <div>
                <h3 className="mb-1 text-sm font-medium">経路別の受注金額</h3>
                <RankingChart data={sources} y="name" value="wonAmount" name="受注金額" kind="yen" label="問い合わせ経路別の受注金額" />
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium">経路別の受注率（問い合わせのうち受注した割合）</h3>
                <RankingChart data={[...sources].sort((x, y) => (y.inquiryWinRate ?? -1) - (x.inquiryWinRate ?? -1))} y="name" value="inquiryWinRate" name="受注率" kind="percent"
                  label="問い合わせ経路別の受注率" highlight={best?.name} />
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>経路</TableHead>
                    <TableHead className="text-right">問い合わせ</TableHead>
                    <TableHead className="text-right">案件化率</TableHead>
                    <TableHead className="text-right">受注</TableHead>
                    <TableHead className="text-right">受注率</TableHead>
                    <TableHead className="text-right">受注金額</TableHead>
                    <TableHead className="text-right">1件あたり</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium whitespace-nowrap">{r.name}{r.name === best?.name && <CheckCircle2 className="ml-1 inline size-3.5 text-success-strong" aria-label="受注率が最も高い" />}</TableCell>
                      <TableCell className="text-right tabular">{r.inquiries}</TableCell>
                      <TableCell className="text-right tabular">{formatPercent(r.conversionRate)}</TableCell>
                      <TableCell className="text-right tabular">{r.won}</TableCell>
                      <TableCell className="text-right tabular">{formatPercent(r.inquiryWinRate)}</TableCell>
                      <TableCell className="text-right tabular font-medium">{formatYen(r.wonAmount)}</TableCell>
                      <TableCell className="text-right tabular">{formatYen(r.revenuePerInquiry)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">受注率＝その経路の問い合わせのうち受注した割合（受注日が期間外でも含む）</p>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="月別の問い合わせ件数・案件化件数" description="受付月で集計">
          <ColumnChart data={monthly} x="label" kind="count" label="月別の問い合わせ件数と案件化件数"
            series={[{ key: "inquiries", name: "問い合わせ" }, { key: "converted", name: "案件化" }]} />
        </ChartCard>
        <ChartCard title="月別の案件化率・受注率" description="受注率は受注÷（受注＋失注）。件数が0の月は表示しません">
          <TrendLineChart data={monthly} x="label" kind="percent" label="月別の案件化率と受注率"
            series={[{ key: "conversionRate", name: "案件化率" }, { key: "winRate", name: "受注率" }]} />
        </ChartCard>
        <ChartCard title="月別の受注金額" description="受注日で集計">
          <ColumnChart data={monthly} x="label" kind="yen" label="月別の受注金額" series={[{ key: "wonAmount", name: "受注金額" }]} />
        </ChartCard>
        <ChartCard title="月別の受注件数・失注件数">
          <ColumnChart data={monthly} x="label" kind="count" label="月別の受注件数と失注件数" series={[{ key: "won", name: "受注" }, { key: "lost", name: "失注" }]} />
        </ChartCard>
        <ChartCard title="担当者別の受注金額" description="期間内に受注した金額">
          {owners.length === 0 ? <EmptyState title="データがありません" className="py-6" /> :
            <RankingChart data={owners} y="name" value="wonAmount" name="受注金額" kind="yen" label="担当者別の受注金額" />}
        </ChartCard>
        <ChartCard title="進行中の案件（ステータス別の受注見込金額）" description={`進行中 ${a.pipelineTotal.count}件・受注見込 ${formatYen(a.pipelineTotal.expected)}`}>
          <RankingChart data={a.pipeline} y="column" value="expected" name="受注見込金額" kind="yen" label="ステータス別の受注見込金額" />
        </ChartCard>
        <ChartCard title="失注理由" description="期間内に失注した案件">
          {a.lostReasons.length === 0 ? <EmptyState title="この期間の失注はありません" className="py-6" /> :
            <RankingChart data={a.lostReasons} y="reason" value="count" name="件数" kind="count" label="失注理由の内訳" />}
        </ChartCard>
        <ChartCard title="経路別の問い合わせ件数">
          <RankingChart data={[...sources].sort((x, y) => y.inquiries - x.inquiries)} y="name" value="inquiries" name="問い合わせ" kind="count" label="経路別の問い合わせ件数" />
        </ChartCard>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-4 sm:px-5">
          <CardTitle className="text-base">担当者別の成績</CardTitle>
          <CardDescription>受注・失注は期間内に確定したもの。進行中の案件は現時点</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>担当者</TableHead>
                <TableHead className="text-right">問い合わせ</TableHead>
                <TableHead className="text-right">平均初回対応</TableHead>
                <TableHead className="text-right">受注</TableHead>
                <TableHead className="text-right">失注</TableHead>
                <TableHead className="text-right">受注率</TableHead>
                <TableHead className="text-right">受注金額</TableHead>
                <TableHead className="text-right">進行中</TableHead>
                <TableHead className="text-right">受注見込</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((o) => (
                <TableRow key={o.ownerId}>
                  <TableCell className="font-medium whitespace-nowrap">{o.name}</TableCell>
                  <TableCell className="text-right tabular">{o.inquiries}</TableCell>
                  <TableCell className="text-right tabular whitespace-nowrap">{formatMinutes(o.avgFirstResponseMinutes)}</TableCell>
                  <TableCell className="text-right tabular">{o.won}</TableCell>
                  <TableCell className="text-right tabular">{o.lost}</TableCell>
                  <TableCell className="text-right tabular">{formatPercent(o.winRate)}</TableCell>
                  <TableCell className="text-right tabular font-medium">{formatYen(o.wonAmount)}</TableCell>
                  <TableCell className="text-right tabular">{o.openDeals}件</TableCell>
                  <TableCell className="text-right tabular">{formatYen(o.pipeline)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
