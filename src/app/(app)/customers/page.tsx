import Link from "next/link";
import { Download, Plus, Upload, Users } from "lucide-react";
import { RankMark, TagChip } from "@/components/common/badges";
import { Muted } from "@/components/common/detail";
import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { CUSTOMER_PAGE_SIZE, listCustomers, parseCustomerFilters } from "@/lib/data/customers";
import { getLookups, memberName } from "@/lib/data/lookups";
import { diffDays, toLocalDate } from "@/lib/domain/dates";
import { CUSTOMER_RANKS, CUSTOMER_TYPES, CUSTOMER_TYPE_LABEL } from "@/lib/domain/labels";
import { formatDate, formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "顧客" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseCustomerFilters(params);
  const [{ rows, total }, lookups] = await Promise.all([listCustomers(filters), getLookups()]);
  const page = filters.page ?? 1;
  const today = toLocalDate(new Date());
  const tag = new Map(lookups.tags.map((t) => [t.id, t]));
  const qs = (p?: number) => {
    const q = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
    if (p && p > 1) q.set("page", String(p));
    return q.size ? `?${q}` : "";
  };
  const dormant = (d: Date | null) => d !== null && diffDays(toLocalDate(d), today) >= user.settings.noContactDays;

  return (
    <div className="space-y-5">
      <PageHeader
        title="顧客"
        description="取引先・見込み客の一覧。案件・売上・対応履歴を顧客ごとにまとめて見られます"
        actions={
          <>
            {user.isManager && (
              <>
                <Button variant="outline" asChild><a href={`/api/export/customers${qs()}`}><Download />CSV出力</a></Button>
                <Button variant="outline" asChild><Link href="/customers/import"><Upload />CSV取り込み</Link></Button>
              </>
            )}
            <Button asChild><Link href="/customers/new"><Plus />顧客を登録</Link></Button>
          </>
        }
      />
      <Card className="gap-0 py-0">
        <ListFilters
          placeholder="会社名・氏名・メール・電話番号で検索"
          selects={[
            { key: "owner", label: "担当者", allLabel: "すべての担当者", options: [{ value: "none", label: "未割当" }, ...lookups.members.filter((m) => m.isActive).map((m) => ({ value: m.id, label: m.name }))] },
            { key: "tag", label: "タグ", allLabel: "すべてのタグ", options: lookups.tags.map((t) => ({ value: t.id, label: `#${t.name}` })) },
            { key: "rank", label: "ランク", allLabel: "すべてのランク", options: CUSTOMER_RANKS.map((r) => ({ value: r, label: `ランク${r}` })) },
            { key: "type", label: "法人／個人", allLabel: "法人・個人", options: CUSTOMER_TYPES.map((t) => ({ value: t, label: CUSTOMER_TYPE_LABEL[t] })) },
            { key: "sort", label: "並び順", allLabel: "更新が新しい順", options: [{ value: "sales", label: "累計売上が多い順" }, { value: "contact", label: "最終接触が古い順" }] },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="条件に合う顧客はありません" description="顧客を登録するか、CSV でまとめて取り込めます。"
            action={<Button asChild size="sm"><Link href="/customers/new"><Plus />顧客を登録</Link></Button>} />
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>顧客名</TableHead>
                    <TableHead>連絡先</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>ランク</TableHead>
                    <TableHead>タグ</TableHead>
                    <TableHead className="text-right">進行中の案件</TableHead>
                    <TableHead className="text-right">累計売上</TableHead>
                    <TableHead>最終接触</TableHead>
                    <TableHead>次回予定</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-64">
                        <Link href={`/customers/${c.id}`} className="block truncate font-medium text-brand hover:underline">{c.companyName ?? c.name}</Link>
                        <div className="truncate text-xs text-muted-foreground">{c.type === "individual" ? "個人" : [c.department, c.name].filter(Boolean).join("・") || "—"}</div>
                      </TableCell>
                      <TableCell className="max-w-52 text-xs">
                        <div className="truncate tabular">{c.phone ?? "—"}</div>
                        <div className="truncate text-muted-foreground">{c.email ?? ""}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{memberName(lookups, c.ownerId)}</TableCell>
                      <TableCell>{c.rank ? <RankMark rank={c.rank} /> : <Muted />}</TableCell>
                      <TableCell className="max-w-48">
                        <div className="flex flex-wrap gap-1">{c.tagIds.map((id) => tag.get(id)).filter((t) => !!t).slice(0, 3).map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)}</div>
                      </TableCell>
                      <TableCell className="text-right tabular">{c.openDeals > 0 ? `${c.openDeals}件` : <Muted />}</TableCell>
                      <TableCell className="text-right tabular font-medium">{c.totalSales > 0 ? formatYen(c.totalSales) : <Muted />}</TableCell>
                      <TableCell className={cn("tabular whitespace-nowrap", dormant(c.lastContactAt) ? "font-medium text-warning-strong" : "text-muted-foreground")}>
                        {c.lastContactAt ? formatDate(c.lastContactAt) : "—"}
                      </TableCell>
                      <TableCell className={cn("tabular whitespace-nowrap", c.nextActionOn && c.nextActionOn < today && "font-medium text-danger-strong")}>
                        {c.nextActionOn ? formatDate(c.nextActionOn) : <Muted />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y lg:hidden">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`} className="block px-4 py-3 hover:bg-accent/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.companyName ?? c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.type === "individual" ? "個人" : c.name ?? "—"}・{memberName(lookups, c.ownerId)}</div>
                      </div>
                      {c.rank && <RankMark rank={c.rank} />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular">累計売上 {formatYen(c.totalSales)}</span>
                      <span className={cn("tabular", dormant(c.lastContactAt) && "text-warning-strong")}>最終接触 {formatDate(c.lastContactAt)}</span>
                      {c.tagIds.map((id) => tag.get(id)).filter((t) => !!t).slice(0, 2).map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t">
              <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE))} total={total} pageSize={CUSTOMER_PAGE_SIZE} hrefFor={(p) => `/customers${qs(p)}`} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
