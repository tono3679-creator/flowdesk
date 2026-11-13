import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Delta } from "@/components/analytics/delta";
import { PrintButton } from "@/components/analytics/print-button";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { asCurrentUser, requireRole } from "@/lib/auth";
import { getAnalytics } from "@/lib/data/analytics";
import { addDays, addMonths, endOfMonth, formatMinutes, isDateString, startOfMonth, startOfWeek, startOfYear, toLocalDate, type Period } from "@/lib/domain/dates";
import { formatDate, formatDateLong, formatNumber, formatPercent, formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "レポート" };

const TYPES = { daily: "日次", weekly: "週次", monthly: "月次", yearly: "年間" } as const;
type ReportType = keyof typeof TYPES;

function periodFor(type: ReportType, date: string): { period: Period; previous: Period; prev: string; next: string; title: string } {
  switch (type) {
    case "daily":
      return { period: { from: date, to: date }, previous: { from: addDays(date, -1), to: addDays(date, -1) }, prev: addDays(date, -1), next: addDays(date, 1), title: formatDateLong(date) };
    case "weekly": {
      const from = startOfWeek(date);
      return { period: { from, to: addDays(from, 6) }, previous: { from: addDays(from, -7), to: addDays(from, -1) }, prev: addDays(from, -7), next: addDays(from, 7), title: `${formatDate(from)}〜${formatDate(addDays(from, 6))} の週` };
    }
    case "monthly": {
      const from = startOfMonth(date);
      const last = addMonths(from, -1);
      return { period: { from, to: endOfMonth(from) }, previous: { from: last, to: endOfMonth(last) }, prev: last, next: addMonths(from, 1), title: `${from.slice(0, 4)}年${Number(from.slice(5, 7))}月` };
    }
    case "yearly": {
      const from = startOfYear(date);
      const last = addMonths(from, -12);
      return { period: { from, to: `${from.slice(0, 4)}-12-31` }, previous: { from: last, to: `${last.slice(0, 4)}-12-31` }, prev: last, next: addMonths(from, 12), title: `${from.slice(0, 4)}年` };
    }
  }
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string; date?: string }> }) {
  const user = await requireRole(["admin", "manager"]);
  const sp = await searchParams;
  const type: ReportType = sp.type && sp.type in TYPES ? (sp.type as ReportType) : "monthly";
  const today = toLocalDate(new Date(), user.settings.timezone);
  const date = sp.date && isDateString(sp.date) ? sp.date : today;
  const { period, previous, prev, next, title } = periodFor(type, date);
  const [a, extra] = await Promise.all([
    getAnalytics(user, period, previous),
    asCurrentUser(async (tx) => {
      const [row] = await tx<{ activities: number; tasksDone: number; customers: number; quotes: number; quoteAmount: number }[]>`
        select (select count(*)::int from activities where occurred_at >= (${period.from}::date)::timestamp at time zone 'Asia/Tokyo'
                  and occurred_at < ((${period.to}::date + 1)::timestamp at time zone 'Asia/Tokyo')) activities,
               (select count(*)::int from tasks where completed_at >= (${period.from}::date)::timestamp at time zone 'Asia/Tokyo'
                  and completed_at < ((${period.to}::date + 1)::timestamp at time zone 'Asia/Tokyo')) "tasksDone",
               (select count(*)::int from customers where created_at >= (${period.from}::date)::timestamp at time zone 'Asia/Tokyo'
                  and created_at < ((${period.to}::date + 1)::timestamp at time zone 'Asia/Tokyo')) customers,
               (select count(*)::int from deals where quote_submitted_on between ${period.from}::date and ${period.to}::date) quotes,
               (select coalesce(sum(estimated_amount), 0) from deals where quote_submitted_on between ${period.from}::date and ${period.to}::date) "quoteAmount"`;
      return row;
    }),
  ]);
  const s = a.summary;
  const p = a.comparable ? a.previous : { ...a.previous, inquiries: null, converted: null, conversionRate: null, won: null, winRate: null, wonAmount: null, sales: null, avgFirstResponseMinutes: null };
  const sources = a.sources.filter((x) => x.inquiries > 0);
  const owners = a.owners.filter((o) => o.ownerId && (o.inquiries + o.won + o.lost > 0));
  const href = (t: ReportType, d: string) => `/reports?type=${t}&date=${d}`;

  const rows: { label: string; value: string; delta?: React.ReactNode }[] = [
    { label: "問い合わせ件数", value: formatNumber(s.inquiries, "件"), delta: <Delta current={s.inquiries} previous={p.inquiries} kind="count" /> },
    { label: "うち未対応", value: formatNumber(s.unanswered, "件") },
    { label: "案件化件数", value: formatNumber(s.converted, "件"), delta: <Delta current={s.converted} previous={p.converted} kind="count" /> },
    { label: "案件化率", value: formatPercent(s.conversionRate), delta: <Delta current={s.conversionRate} previous={p.conversionRate} kind="percent" /> },
    { label: "見積提出", value: `${extra.quotes}件・${formatYen(extra.quoteAmount)}` },
    { label: "受注件数", value: formatNumber(s.won, "件"), delta: <Delta current={s.won} previous={p.won} kind="count" /> },
    { label: "失注件数", value: formatNumber(s.lost, "件") },
    { label: "受注率", value: formatPercent(s.winRate), delta: <Delta current={s.winRate} previous={p.winRate} kind="percent" /> },
    { label: "受注金額", value: formatYen(s.wonAmount), delta: <Delta current={s.wonAmount} previous={p.wonAmount} kind="yen" /> },
    { label: "売上（計上日ベース）", value: formatYen(s.sales), delta: <Delta current={s.sales} previous={p.sales} kind="yen" /> },
    { label: "平均受注単価", value: formatYen(s.avgDealSize === null ? null : Math.round(s.avgDealSize)) },
    { label: "平均初回対応時間", value: formatMinutes(s.avgFirstResponseMinutes), delta: <Delta current={s.avgFirstResponseMinutes} previous={p.avgFirstResponseMinutes} kind="minutes" better="down" /> },
    { label: `初回対応率（${user.settings.firstResponseTargetHours}時間以内）`, value: formatPercent(s.firstResponseRate) },
    { label: "対応履歴の件数", value: formatNumber(extra.activities, "件") },
    { label: "完了したタスク", value: formatNumber(extra.tasksDone, "件") },
    { label: "新規顧客", value: formatNumber(extra.customers, "社") },
    { label: "受注見込金額（現在の進行中案件）", value: formatYen(a.pipelineTotal.expected) },
  ];

  return (
    <div className="space-y-5 print:space-y-3">
      <PageHeader title="レポート" description={`${user.organizationName} の営業レポート。前の期間と比べた増減も表示します`} actions={<PrintButton />} className="print:hidden" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <nav aria-label="レポートの種類" className="inline-flex rounded-lg bg-muted p-1">
          {(Object.keys(TYPES) as ReportType[]).map((t) => (
            <Link key={t} href={href(t, date)} aria-current={t === type ? "page" : undefined}
              className={cn("inline-flex h-8 items-center rounded-md px-4 text-sm font-medium", t === type ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{TYPES[t]}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={href(type, prev)} className="inline-flex size-8 items-center justify-center rounded-md border bg-card hover:bg-accent" aria-label="前の期間"><ChevronLeft className="size-4" /></Link>
          <span className="min-w-44 text-center text-sm font-semibold">{title}</span>
          <Link href={href(type, next > today ? today : next)} aria-disabled={period.to >= today}
            className={cn("inline-flex size-8 items-center justify-center rounded-md border bg-card hover:bg-accent", period.to >= today && "pointer-events-none opacity-40")} aria-label="次の期間"><ChevronRight className="size-4" /></Link>
          {period.to < today && <Link href={href(type, today)} className="text-sm text-brand hover:underline">今日を含む期間へ</Link>}
        </div>
      </div>

      <h2 className="hidden text-xl font-bold print:block">{TYPES[type]}レポート　{title}</h2>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-3 sm:px-5"><CardTitle className="text-base">{TYPES[type]}レポート　{title}</CardTitle></CardHeader>
          <CardContent className="px-0">
            <dl className="divide-y">
              {rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-4 py-2 sm:grid-cols-[200px_1fr_auto] sm:px-5">
                  <dt className="text-sm text-muted-foreground">{r.label}</dt>
                  <dd className="text-right text-sm font-semibold tabular sm:text-left">{r.value}</dd>
                  <dd className="col-span-2 text-right text-xs sm:col-span-1">{r.delta}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <div className="grid content-start gap-5">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3 sm:px-5"><CardTitle className="text-base">経路別</CardTitle></CardHeader>
            <CardContent className="px-0">
              {sources.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">この期間の問い合わせはありません</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>経路</TableHead><TableHead className="text-right">問い合わせ</TableHead><TableHead className="text-right">案件化</TableHead><TableHead className="text-right">受注</TableHead><TableHead className="text-right">受注金額</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sources.map((r) => (
                      <TableRow key={r.name}><TableCell>{r.name}</TableCell><TableCell className="text-right tabular">{r.inquiries}</TableCell><TableCell className="text-right tabular">{r.converted}</TableCell><TableCell className="text-right tabular">{r.won}</TableCell><TableCell className="text-right tabular">{formatYen(r.wonAmount)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3 sm:px-5"><CardTitle className="text-base">担当者別</CardTitle></CardHeader>
            <CardContent className="px-0">
              {owners.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">この期間の実績はありません</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>担当者</TableHead><TableHead className="text-right">問い合わせ</TableHead><TableHead className="text-right">受注</TableHead><TableHead className="text-right">受注率</TableHead><TableHead className="text-right">受注金額</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {owners.map((o) => (
                      <TableRow key={o.ownerId}><TableCell className="whitespace-nowrap">{o.name}</TableCell><TableCell className="text-right tabular">{o.inquiries}</TableCell><TableCell className="text-right tabular">{o.won}</TableCell><TableCell className="text-right tabular">{formatPercent(o.winRate)}</TableCell><TableCell className="text-right tabular">{formatYen(o.wonAmount)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {a.lostReasons.length > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-4 py-3 sm:px-5"><CardTitle className="text-base">失注理由</CardTitle></CardHeader>
              <CardContent className="px-0">
                <ul className="divide-y">{a.lostReasons.map((r) => <li key={r.reason} className="flex justify-between px-5 py-2 text-sm"><span>{r.reason}</span><span className="tabular">{r.count}件</span></li>)}</ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
