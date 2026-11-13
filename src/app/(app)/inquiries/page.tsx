import Link from "next/link";
import { Download, Inbox, Plus } from "lucide-react";
import { InquiryStatusBadge, PriorityBadge } from "@/components/common/badges";
import { Muted } from "@/components/common/detail";
import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { listInquiries, PAGE_SIZE, parseInquiryFilters } from "@/lib/data/inquiries";
import { getLookups, memberName } from "@/lib/data/lookups";
import { isUnanswered } from "@/lib/domain/alerts";
import { INQUIRY_STATUSES, INQUIRY_STATUS_LABEL, PRIORITIES } from "@/lib/domain/labels";
import { formatAgo, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "問い合わせ" };

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseInquiryFilters(params);
  const [{ rows, total }, lookups] = await Promise.all([listInquiries(filters), getLookups()]);
  const page = filters.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();
  const hrefFor = (p: number) => {
    const qs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
    if (p > 1) qs.set("page", String(p));
    return `/inquiries${qs.size ? `?${qs}` : ""}`;
  };
  const exportQs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
  const late = (r: (typeof rows)[number]) => isUnanswered({ status: r.status, receivedAt: r.receivedAt }, now, user.settings.unansweredHours);

  return (
    <div className="space-y-5">
      <PageHeader
        title="問い合わせ"
        description={user.isManager ? "チームに届いたすべての問い合わせ" : "自分が担当・登録した問い合わせと、担当者が決まっていない問い合わせ"}
        actions={
          <>
            {user.isManager && (
              <Button variant="outline" asChild>
                <a href={`/api/export/inquiries${exportQs.size ? `?${exportQs}` : ""}`}><Download />CSV出力</a>
              </Button>
            )}
            <Button asChild><Link href="/inquiries/new"><Plus />問い合わせを登録</Link></Button>
          </>
        }
      />
      <Card className="gap-0 py-0">
        <ListFilters
          placeholder="件名・内容・顧客名・連絡先で検索"
          dateRange={{ label: "受付日" }}
          selects={[
            { key: "status", label: "ステータス", allLabel: "すべてのステータス", options: [{ value: "open", label: "未完了（未対応・対応中・保留）" }, ...INQUIRY_STATUSES.map((s) => ({ value: s, label: INQUIRY_STATUS_LABEL[s] }))] },
            { key: "owner", label: "担当者", allLabel: "すべての担当者", options: [{ value: "none", label: "未割当" }, ...lookups.members.filter((m) => m.isActive).map((m) => ({ value: m.id, label: m.name }))] },
            { key: "source", label: "経路", allLabel: "すべての経路", options: lookups.sources.map((s) => ({ value: s.id, label: s.name })) },
            { key: "priority", label: "優先度", allLabel: "すべての優先度", options: PRIORITIES.map((p) => ({ value: p, label: user.settings.priorityLabels[p] })) },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={total === 0 && Object.keys(filters).length === 0 ? "問い合わせはまだありません" : "条件に合う問い合わせはありません"}
            description="電話・メール・フォームなどで受けた問い合わせを登録すると、対応漏れを自動でお知らせします。"
            action={<Button asChild size="sm"><Link href="/inquiries/new"><Plus />問い合わせを登録</Link></Button>}
          />
        ) : (
          <>
            {/* PC：表 */}
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>受付日時</TableHead>
                    <TableHead>顧客名 / 会社名</TableHead>
                    <TableHead>問い合わせ内容</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>優先度</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>最終対応</TableHead>
                    <TableHead>次回対応予定</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className={cn(late(r) && "bg-danger-soft/40")}>
                      <TableCell className="tabular whitespace-nowrap">
                        {formatDateTime(r.receivedAt)}
                        <div className={cn("text-xs", late(r) ? "font-medium text-danger-strong" : "text-muted-foreground")}>{formatAgo(r.receivedAt, now)}</div>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <div className="truncate font-medium">{r.contactName ?? <Muted />}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.companyName ?? "個人"}</div>
                      </TableCell>
                      <TableCell className="max-w-80">
                        <Link href={`/inquiries/${r.id}`} className="block truncate font-medium text-brand hover:underline">{r.title}</Link>
                        <div className="truncate text-xs text-muted-foreground">{[r.sourceName, r.category, r.content].filter(Boolean).join("・")}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.ownerId ? memberName(lookups, r.ownerId) : <span className="text-warning-strong">未割当</span>}</TableCell>
                      <TableCell><PriorityBadge priority={r.priority} labels={user.settings.priorityLabels} /></TableCell>
                      <TableCell><InquiryStatusBadge status={r.status} /></TableCell>
                      <TableCell className="tabular whitespace-nowrap text-muted-foreground">{formatDateTime(r.lastActivityAt)}</TableCell>
                      <TableCell className="tabular whitespace-nowrap">{r.nextActionOn ? formatDate(r.nextActionOn) : <Muted />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* スマホ・タブレット：カード */}
            <ul className="divide-y lg:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/inquiries/${r.id}`} className={cn("block px-4 py-3 hover:bg-accent/50", late(r) && "bg-danger-soft/40")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.companyName ?? r.contactName ?? "—"}{r.companyName && r.contactName ? `・${r.contactName}` : ""}</div>
                      </div>
                      <InquiryStatusBadge status={r.status} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <PriorityBadge priority={r.priority} labels={user.settings.priorityLabels} />
                      <span className={cn("tabular", late(r) && "font-medium text-danger-strong")}>受付 {formatDateTime(r.receivedAt)}（{formatAgo(r.receivedAt, now)}）</span>
                      <span>{memberName(lookups, r.ownerId)}</span>
                      {r.nextActionOn && <span className="tabular">次回 {formatDate(r.nextActionOn)}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t">
              <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} hrefFor={hrefFor} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
