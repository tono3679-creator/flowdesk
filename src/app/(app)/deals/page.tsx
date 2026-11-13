import Link from "next/link";
import { Briefcase, Download, Plus } from "lucide-react";
import { StageBadge } from "@/components/common/badges";
import { MiniStat, Muted } from "@/components/common/detail";
import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { DealViewTabs } from "@/components/deals/deal-tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { DEAL_PAGE_SIZE, listDeals, parseDealFilters } from "@/lib/data/deals";
import { getLookups, memberName } from "@/lib/data/lookups";
import { toLocalDate } from "@/lib/domain/dates";
import { formatDate, formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "案件" };

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseDealFilters(params);
  const [{ rows, total, totals }, lookups] = await Promise.all([listDeals(filters), getLookups()]);
  const page = filters.page ?? 1;
  const today = toLocalDate(new Date());
  const qs = (p?: number) => {
    const q = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
    if (p && p > 1) q.set("page", String(p));
    return q.size ? `?${q}` : "";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="案件"
        description="見積金額 × 受注確度 = 受注見込金額。ステータスを変えると確度も自動で変わります"
        actions={
          <>
            <DealViewTabs current="list" />
            {user.isManager && <Button variant="outline" asChild><a href={`/api/export/deals${qs()}`}><Download />CSV出力</a></Button>}
            <Button asChild><Link href="/deals/new"><Plus />案件を作成</Link></Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MiniStat label="対象の案件" value={`${total}件`} />
        <MiniStat className="col-span-2 sm:col-span-1" label="受注見込金額（進行中）" value={formatYen(totals.expected)} sub={`見積総額 ${formatYen(totals.estimated)}`} />
        <MiniStat label="受注金額" value={formatYen(totals.won)} />
      </div>
      <Card className="gap-0 py-0">
        <ListFilters
          placeholder="案件名・顧客名・メモで検索"
          dateRange={{ label: "受注(予定)日" }}
          selects={[
            { key: "category", label: "状況", allLabel: "すべての状況", options: [
              { value: "open", label: "進行中" }, { value: "closed_won", label: "受注・完了" }, { value: "lost", label: "失注" }, { value: "hold", label: "保留" },
            ] },
            { key: "stage", label: "ステータス", allLabel: "すべてのステータス", options: lookups.stages.map((s) => ({ value: s.id, label: s.name })) },
            { key: "owner", label: "担当者", allLabel: "すべての担当者", options: [{ value: "none", label: "未割当" }, ...lookups.members.filter((m) => m.isActive).map((m) => ({ value: m.id, label: m.name }))] },
            { key: "type", label: "案件種別", allLabel: "すべての種別", options: user.settings.dealTypes.map((t) => ({ value: t, label: t })) },
            { key: "sort", label: "並び順", allLabel: "更新が新しい順", options: [
              { value: "expected", label: "受注見込が大きい順" }, { value: "amount", label: "見積金額が大きい順" }, { value: "close", label: "受注予定日が近い順" },
            ] },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={Briefcase} title="条件に合う案件はありません" description="問い合わせ詳細の「案件化する」か、ここから案件を作成できます。"
            action={<Button asChild size="sm"><Link href="/deals/new"><Plus />案件を作成</Link></Button>} />
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>案件名 / 顧客</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead className="text-right">見積金額</TableHead>
                    <TableHead className="text-right">確度</TableHead>
                    <TableHead className="text-right">受注見込</TableHead>
                    <TableHead>受注予定日</TableHead>
                    <TableHead>最終接触</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((d) => {
                    const late = d.category === "open" && d.expectedCloseOn !== null && d.expectedCloseOn < today;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="max-w-80">
                          <Link href={`/deals/${d.id}`} className="block truncate font-medium text-brand hover:underline">{d.title}</Link>
                          <div className="truncate text-xs text-muted-foreground">{d.customerName}{d.dealType ? `・${d.dealType}` : ""}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{memberName(lookups, d.ownerId)}</TableCell>
                        <TableCell><StageBadge name={d.stageName} category={d.category} /></TableCell>
                        <TableCell className="text-right tabular">{formatYen(d.estimatedAmount)}</TableCell>
                        <TableCell className="text-right tabular">{d.probability}%</TableCell>
                        <TableCell className="text-right tabular font-semibold">
                          {d.category === "won" || d.category === "completed" ? <span className="text-success-strong">{formatYen(d.actualAmount ?? d.estimatedAmount)}</span> : formatYen(d.expectedRevenue)}
                        </TableCell>
                        <TableCell className={cn("tabular whitespace-nowrap", late && "font-medium text-danger-strong")}>
                          {d.closedOn ? <span className="text-muted-foreground">{formatDate(d.closedOn)} 確定</span> : d.expectedCloseOn ? formatDate(d.expectedCloseOn) : <Muted />}
                        </TableCell>
                        <TableCell className="tabular whitespace-nowrap text-muted-foreground">{formatDate(d.lastContactAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y lg:hidden">
              {rows.map((d) => (
                <li key={d.id}>
                  <Link href={`/deals/${d.id}`} className="block px-4 py-3 hover:bg-accent/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{d.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{d.customerName}・{memberName(lookups, d.ownerId)}</div>
                      </div>
                      <StageBadge name={d.stageName} category={d.category} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular">
                      <span>見積 {formatYen(d.estimatedAmount)}</span><span>確度 {d.probability}%</span>
                      <span className="font-semibold text-foreground">見込 {formatYen(d.expectedRevenue)}</span>
                      {d.expectedCloseOn && !d.closedOn && <span>受注予定 {formatDate(d.expectedCloseOn)}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t">
              <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / DEAL_PAGE_SIZE))} total={total} pageSize={DEAL_PAGE_SIZE} hrefFor={(p) => `/deals${qs(p)}`} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
