import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SeverityBadge } from "@/components/common/badges";
import { ALERT_KIND_LABEL, type Alert } from "@/lib/domain/alerts";
import { cn } from "@/lib/utils";

export function alertHref(a: Pick<Alert, "targetType" | "targetId">): string {
  if (a.targetType === "inquiry") return `/inquiries/${a.targetId}`;
  if (a.targetType === "deal") return `/deals/${a.targetId}`;
  return `/tasks/${a.targetId}/edit`;
}

/** アラート・今日やることの一覧（優先度順に並べた結果をそのまま表示する） */
export function AlertList({ alerts, ownerName, dense }: { alerts: Alert[]; ownerName: (id: string | null) => string; dense?: boolean }) {
  return (
    <ul className="divide-y">
      {alerts.map((a) => (
        <li key={`${a.kind}:${a.targetId}`}>
          <Link href={alertHref(a)} className={cn("group flex items-start gap-3 px-4 hover:bg-accent/50 sm:px-5", dense ? "py-2.5" : "py-3")}>
            <div className="w-16 shrink-0 pt-0.5"><SeverityBadge severity={a.severity} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium text-muted-foreground">{ALERT_KIND_LABEL[a.kind]}</span>
                <span className="text-xs text-muted-foreground">・{ownerName(a.ownerId)}</span>
              </div>
              <div className="truncate text-sm font-medium">{a.title}</div>
              <div className={cn("text-keep text-xs", a.severity === "critical" ? "text-danger-strong" : "text-muted-foreground")}>{a.message}</div>
            </div>
            <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
