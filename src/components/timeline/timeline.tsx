import Link from "next/link";
import { ArrowRight, Inbox, type LucideIcon } from "lucide-react";
import { ACTIVITY_ICON, StageBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import type { TimelineEvent } from "@/lib/data/timeline";
import { ACTIVITY_TYPE_LABEL } from "@/lib/domain/labels";
import { formatDate, formatDateTimeFull } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 問い合わせ → 電話 → 商談 → 見積提出 → フォロー → 受注 の流れを時系列で表示する */
export function Timeline({ events, userName, showDeal }: { events: TimelineEvent[]; userName: (id: string | null) => string; showDeal?: boolean }) {
  if (events.length === 0) {
    return <EmptyState icon={Inbox} title="対応履歴はまだありません" description="「対応を記録」から、電話やメールのやり取りを残せます。" className="py-8" />;
  }
  return (
    <ol className="relative grid gap-0 px-4 py-2 sm:px-5" aria-label="対応のタイムライン">
      {events.map((e, i) => {
        const { Icon, tone } = iconOf(e);
        return (
          <li key={`${e.kind}:${e.id}`} className="relative flex gap-3 pb-5 last:pb-2">
            {i < events.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden />}
            <span className={cn("relative z-[1] mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card", tone)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <time className="tabular" dateTime={e.at.toISOString()}>{formatDateTimeFull(e.at)}</time>
                {e.kind !== "inquiry" && <span>{userName(e.userId)}</span>}
              </div>
              {e.kind === "inquiry" && (
                <div className="mt-0.5">
                  <div className="text-sm font-semibold">問い合わせ受付{e.sourceName ? `（${e.sourceName}）` : ""}</div>
                  <Link href={`/inquiries/${e.id}`} className="text-sm text-brand hover:underline">{e.title}</Link>
                  {e.content && <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{e.content}</p>}
                </div>
              )}
              {e.kind === "activity" && (
                <div className="mt-0.5">
                  <div className="text-sm font-semibold">{ACTIVITY_TYPE_LABEL[e.type]}</div>
                  <p className="text-sm whitespace-pre-wrap">{e.content}</p>
                  {e.result && <p className="mt-1 text-sm"><span className="text-muted-foreground">結果：</span>{e.result}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {e.nextActionOn && <span>次回対応 {formatDate(e.nextActionOn)}</span>}
                    {showDeal && e.dealId && e.dealTitle && <Link href={`/deals/${e.dealId}`} className="text-brand hover:underline">案件：{e.dealTitle}</Link>}
                  </div>
                </div>
              )}
              {e.kind === "stage" && (
                <div className="mt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    ステータス変更
                    {e.from && <><span className="font-normal text-muted-foreground">{e.from}</span><ArrowRight className="size-3.5 text-muted-foreground" aria-label="から" /></>}
                    <StageBadge name={e.to} category={e.category} />
                  </div>
                  {showDeal && <Link href={`/deals/${e.dealId}`} className="text-xs text-brand hover:underline">案件：{e.dealTitle}</Link>}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function iconOf(e: TimelineEvent): { Icon: LucideIcon; tone: string } {
  if (e.kind === "inquiry") return { Icon: Inbox, tone: "text-danger-strong border-destructive/30" };
  if (e.kind === "activity") return { Icon: ACTIVITY_ICON[e.type], tone: e.type === "quote" ? "text-warning-strong border-warning/40" : "text-brand border-brand/30" };
  const won = e.category === "won" || e.category === "completed";
  return { Icon: ArrowRight, tone: won ? "text-success-strong border-success/40" : e.category === "lost" ? "text-danger-strong border-destructive/30" : "text-muted-foreground" };
}
