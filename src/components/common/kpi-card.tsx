import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI のカード。tone は注意が必要な数字（0でなければ色を付ける。文字でも状態を書く） */
export function KpiCard({
  label, value, sub, icon: Icon, tone, href,
}: { label: string; value: string; sub?: React.ReactNode; icon: LucideIcon; tone?: "danger" | "warning" | "success" | "brand"; href?: string }) {
  const body = (
    <div className={cn(
      "flex h-full flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs transition-shadow",
      href && "hover:shadow-md",
      tone === "danger" && "border-destructive/30 bg-danger-soft/40",
      tone === "warning" && "border-warning/40 bg-warning-soft/40",
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-keep text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn(
          "size-4 shrink-0",
          tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-strong" : tone === "success" ? "text-success-strong" : "text-brand",
        )} aria-hidden />
      </div>
      <div className={cn(
        "tabular text-xl font-bold tracking-tight whitespace-nowrap sm:text-2xl",
        tone === "danger" && "text-danger-strong", tone === "warning" && "text-warning-strong",
      )}>{value}</div>
      {sub && <div className="text-keep text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">{body}</Link> : body;
}
