import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DealBoard, type BoardColumn } from "@/components/deals/deal-board";
import { DealViewTabs } from "@/components/deals/deal-tabs";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { boardDeals } from "@/lib/data/deals";
import { getLookups, memberName } from "@/lib/data/lookups";
import { isDormant, needsQuoteFollow } from "@/lib/domain/alerts";
import { addDays, toLocalDate } from "@/lib/domain/dates";

export const metadata = { title: "案件ボード" };

const CLOSED_DAYS = 60;

export default async function DealBoardPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const user = await requireUser();
  const { mine } = await searchParams;
  const today = toLocalDate(new Date());
  const [deals, lookups] = await Promise.all([boardDeals(addDays(today, -CLOSED_DAYS), mine === "1" ? user.userId : undefined), getLookups()]);

  // ボードの列（設定の「ボードの列」が同じステータスを1列にまとめる。列が空のステータス＝保留はボードに出さない）
  const columns: BoardColumn[] = [];
  for (const s of lookups.stages.filter((x) => x.isActive && x.boardColumn)) {
    const key = s.boardColumn!;
    const col = columns.find((c) => c.key === key) ?? (columns.push({ key, stages: [] }), columns[columns.length - 1]);
    col.stages.push({ id: s.id, name: s.name, category: s.category, defaultProbability: s.defaultProbability });
  }
  const onBoard = new Set(columns.flatMap((c) => c.stages.map((s) => s.id)));
  const offBoard = deals.filter((d) => !onBoard.has(d.stageId)).length;
  const rules = user.settings;

  const cards = deals.filter((d) => onBoard.has(d.stageId)).map((d) => ({
    id: d.id, title: d.title, customerName: d.customerName, ownerName: memberName(lookups, d.ownerId), stageId: d.stageId, probability: d.probability,
    estimatedAmount: d.estimatedAmount, actualAmount: d.category === "won" || d.category === "completed" ? d.actualAmount : null,
    expectedCloseOn: d.expectedCloseOn, nextFollowUpOn: d.nextFollowUpOn, quoteSubmittedOn: d.quoteSubmittedOn,
    alert: needsQuoteFollow(d, today, rules.quoteFollowDays) ? "見積フォロー" : isDormant(d, today, rules.noContactDays, rules.timezone) ? `${rules.noContactDays}日以上未接触` : null,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="案件ボード"
        description={`カードをドラッグしてステータスを変更できます（保存されます）。受注・完了・失注は直近${CLOSED_DAYS}日分を表示`}
        actions={
          <>
            <DealViewTabs current="board" />
            <Button variant="outline" asChild>
              <Link href={mine === "1" ? "/deals/board" : "/deals/board?mine=1"}>{mine === "1" ? "全員の案件を表示" : "自分の案件だけ表示"}</Link>
            </Button>
            <Button asChild><Link href="/deals/new"><Plus />案件を作成</Link></Button>
          </>
        }
      />
      {offBoard > 0 && (
        <p className="text-sm text-muted-foreground">
          保留中の案件 {offBoard}件はボードに表示していません。<Link href="/deals?category=hold" className="text-brand hover:underline">一覧で見る</Link>
        </p>
      )}
      <DealBoard columns={columns} cards={cards} today={today} />
    </div>
  );
}
