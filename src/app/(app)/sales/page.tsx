import Link from "next/link";
import { Download, FileText, JapaneseYen, Receipt, TrendingUp, Users } from "lucide-react";
import { RangeTabs } from "@/components/analytics/range-tabs";
import { ColumnChart, RankingChart } from "@/components/charts/charts";
import { EmptyState } from "@/components/common/empty-state";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { asCurrentUser, requireRole } from "@/lib/auth";
import { periodOf, RANGE_LABEL, RANGES, type RangeKey } from "@/lib/data/analytics";
import { getLookups, memberName } from "@/lib/data/lookups";
import { addMonths, monthKey, monthRange, startOfMonth, toLocalDate } from "@/lib/domain/dates";
import { formatDate, formatNumber, formatYen } from "@/lib/format";

export const metadata = { title: "見積・売上" };

type SaleRow = { dealId: string; title: string; customerId: string; customerName: string; ownerId: string | null; amount: number; recognizedOn: string; dealType: string | null };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireRole(["admin", "manager"]);
  const { range: raw } = await searchParams;
  const range: RangeKey = (RANGES as readonly string[]).includes(raw ?? "") ? (raw as RangeKey) : "this_year";
  const today = toLocalDate(new Date(), user.settings.timezone);
  const period = periodOf(range, today);
  const chartFrom = [period.from, addMonths(startOfMonth(today), -5)].sort()[0];
  const [{ sales, quotes }, lookups] = await Promise.all([
    asCurrentUser(async (tx) => {
      const [sales, [quotes]] = await Promise.all([
        tx<SaleRow[]>`
          select s.deal_id "dealId", d.title, s.customer_id "customerId", coalesce(c.company_name, c.name) "customerName", s.owner_id "ownerId",
                 s.amount, s.recognized_on "recognizedOn", d.deal_type "dealType"
            from sales s join deals d on d.id = s.deal_id join customers c on c.id = s.customer_id
           where s.recognized_on >= ${chartFrom}::date and s.recognized_on <= ${period.to}::date order by s.recognized_on desc`,
        tx<{ count: number; amount: number; expected: number; openCount: number; openAmount: number }[]>`
          select count(*) filter (where d.quote_submitted_on between ${period.from}::date and ${period.to}::date)::int count,
                 coalesce(sum(d.estimated_amount) filter (where d.quote_submitted_on between ${period.from}::date and ${period.to}::date), 0) amount,
                 coalesce(sum(d.expected_revenue) filter (where s.category = 'open'), 0) expected,
                 count(*) filter (where s.category = 'open' and d.quote_submitted_on is not null)::int "openCount",
                 coalesce(sum(d.estimated_amount) filter (where s.category = 'open' and d.quote_submitted_on is not null), 0) "openAmount"
            from deals d join pipeline_stages s on s.id = d.stage_id`,
      ]);
      return { sales: [...sales], quotes };
    }),
    getLookups(),
  ]);
  const inRange = sales.filter((s) => s.recognizedOn >= period.from);
  const total = inRange.reduce((a, s) => a + s.amount, 0);
  const months = monthRange(chartFrom, period.to < today ? period.to : today).map((m) => ({
    month: m, label: `${Number(m.slice(5))}月`, amount: sales.filter((s) => monthKey(s.recognizedOn) === m).reduce((a, s) => a + s.amount, 0),
  }));
  const group = (key: (s: SaleRow) => string, label: (s: SaleRow) => string) => {
    const map = new Map<string, { name: string; amount: number; count: number; id: string }>();
    for (const s of inRange) {
      const k = key(s);
      const cur = map.get(k) ?? { name: label(s), amount: 0, count: 0, id: k };
      cur.amount += s.amount; cur.count++;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  };
  const byOwner = group((s) => s.ownerId ?? "none", (s) => memberName(lookups, s.ownerId));
  const byCustomer = group((s) => s.customerId, (s) => s.customerName);
  const byType = group((s) => s.dealType ?? "未設定", (s) => s.dealType ?? "未設定");

  return (
    <div className="space-y-6">
      <PageHeader
        title="見積・売上"
        description={`${RANGE_LABEL[range]}（${formatDate(period.from)}〜${formatDate(period.to)}）。売上は受注した案件の計上日（完了日・受注日）で集計`}
        actions={
          <>
            <RangeTabs current={range} basePath="/sales" />
            <Button variant="outline" asChild><a href={`/api/export/sales?from=${period.from}&to=${period.to}`}><Download />CSV出力</a></Button>
          </>
        }
      />
      <section aria-label="合計" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="売上合計" icon={JapaneseYen} tone="success" value={formatYen(total)} sub={`${inRange.length}件`} />
        <KpiCard label="平均単価" icon={Receipt} value={formatYen(inRange.length ? Math.round(total / inRange.length) : null)} />
        <KpiCard label="期間内に提出した見積" icon={FileText} value={formatYen(quotes.amount)} sub={`${quotes.count}件`} />
        <KpiCard label="受注見込金額（進行中）" icon={TrendingUp} value={formatYen(quotes.expected)} sub={`見積提出済み ${quotes.openCount}件・${formatYen(quotes.openAmount)}`} />
      </section>

      <Card className="gap-3">
        <CardHeader><CardTitle className="text-base">月別の売上</CardTitle><CardDescription>直近6か月以上を表示</CardDescription></CardHeader>
        <CardContent><ColumnChart data={months} x="label" kind="yen" label="月別の売上" series={[{ key: "amount", name: "売上" }]} /></CardContent>
      </Card>

      {inRange.length === 0 ? (
        <Card><EmptyState icon={JapaneseYen} title="この期間の売上はありません" /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="gap-3">
            <CardHeader><CardTitle className="text-base">担当者別</CardTitle></CardHeader>
            <CardContent><RankingChart data={byOwner} y="name" value="amount" name="売上" kind="yen" label="担当者別の売上" /></CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader><CardTitle className="text-base">案件種別</CardTitle></CardHeader>
            <CardContent><RankingChart data={byType} y="name" value="amount" name="売上" kind="yen" label="案件種別ごとの売上" /></CardContent>
          </Card>
          <Card className="gap-0 py-0 lg:col-span-2">
            <CardHeader className="border-b px-4 py-4 sm:px-5"><CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" aria-hidden />顧客別の売上</CardTitle></CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader><TableRow><TableHead>顧客</TableHead><TableHead className="text-right">件数</TableHead><TableHead className="text-right">売上</TableHead><TableHead className="text-right">構成比</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byCustomer.slice(0, 20).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Link href={`/customers/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link></TableCell>
                      <TableCell className="text-right tabular">{c.count}</TableCell>
                      <TableCell className="text-right tabular font-medium">{formatYen(c.amount)}</TableCell>
                      <TableCell className="text-right tabular">{((c.amount / total) * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter><TableRow><TableCell>合計（{formatNumber(byCustomer.length)}社）</TableCell><TableCell className="text-right tabular">{inRange.length}</TableCell><TableCell className="text-right tabular">{formatYen(total)}</TableCell><TableCell /></TableRow></TableFooter>
              </Table>
              {byCustomer.length > 20 && <p className="px-5 py-2 text-xs text-muted-foreground">上位20社を表示しています</p>}
            </CardContent>
          </Card>
          <Card className="gap-0 py-0 lg:col-span-2">
            <CardHeader className="border-b px-4 py-4 sm:px-5"><CardTitle className="text-base">売上の明細</CardTitle></CardHeader>
            <CardContent className="max-h-[480px] overflow-auto px-0">
              <Table>
                <TableHeader><TableRow><TableHead>計上日</TableHead><TableHead>案件</TableHead><TableHead>顧客</TableHead><TableHead>担当者</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader>
                <TableBody>
                  {inRange.map((s) => (
                    <TableRow key={s.dealId}>
                      <TableCell className="tabular whitespace-nowrap">{formatDate(s.recognizedOn)}</TableCell>
                      <TableCell className="max-w-72 truncate"><Link href={`/deals/${s.dealId}`} className="text-brand hover:underline">{s.title}</Link></TableCell>
                      <TableCell className="max-w-48 truncate">{s.customerName}</TableCell>
                      <TableCell className="whitespace-nowrap">{memberName(lookups, s.ownerId)}</TableCell>
                      <TableCell className="text-right tabular font-medium">{formatYen(s.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
