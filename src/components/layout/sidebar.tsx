"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OrgRole } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";
import { navFor, isActive, type BadgeKey } from "./nav";
import { Logo } from "./logo";

export type NavBadges = Record<BadgeKey, number>;

const BADGE_LABEL: Record<BadgeKey, string> = { unanswered: "未対応", alerts: "アラート", overdue: "期限超過" };

export function SidebarBody({
  organizationName, role, badges, onNavigate,
}: { organizationName: string; role: OrgRole; badges: NavBadges; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-5 pb-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="ダッシュボードへ">
          <Logo inverted />
        </Link>
      </div>
      <nav aria-label="メインメニュー" className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
        {navFor(role).map((group) => (
          <div key={group.group || "top"} className="flex flex-col gap-0.5">
            {group.group && <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-sidebar-muted">{group.group}</div>}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const badge = item.badgeKey && badges[item.badgeKey] > 0 ? badges[item.badgeKey] : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-white shadow-[inset_3px_0_0_var(--brand)]"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white",
                  )}
                >
                  <item.icon className={cn("size-4.5 shrink-0", active ? "text-white" : "text-sidebar-muted group-hover:text-white")} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {badge !== null && item.badgeKey && (
                    <span
                      className={cn("rounded-full px-1.5 text-[11px] leading-5 font-semibold text-white tabular", item.badgeKey === "alerts" ? "bg-destructive" : "bg-warning")}
                      aria-label={`${BADGE_LABEL[item.badgeKey]} ${badge} 件`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4">
        <div className="text-[11px] text-sidebar-muted">ご利用中の組織</div>
        <div className="text-keep mt-0.5 text-sm font-medium text-white">{organizationName}</div>
        <Link href="/about" onClick={onNavigate} className="mt-2 inline-block text-[11px] text-sidebar-muted underline-offset-2 hover:text-white hover:underline">
          このシステムについて
        </Link>
      </div>
    </div>
  );
}

export function Sidebar(props: { organizationName: string; role: OrgRole; badges: NavBadges }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
      <SidebarBody {...props} />
    </aside>
  );
}
