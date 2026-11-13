import {
  LayoutDashboard, Inbox, Briefcase, ListTodo, Building2, MessagesSquare, BellRing, ChartColumn, FileBarChart, JapaneseYen, Settings,
  type LucideIcon,
} from "lucide-react";
import type { OrgRole } from "@/lib/domain/labels";

export type BadgeKey = "unanswered" | "alerts" | "overdue";
export type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: BadgeKey; roles?: OrgRole[] };

const MANAGERS: OrgRole[] = ["admin", "manager"];

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "",
    items: [
      { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
      { href: "/alerts", label: "対応漏れアラート", icon: BellRing, badgeKey: "alerts" },
    ],
  },
  {
    group: "営業",
    items: [
      { href: "/inquiries", label: "問い合わせ", icon: Inbox, badgeKey: "unanswered" },
      { href: "/deals", label: "案件", icon: Briefcase },
      { href: "/tasks", label: "タスク", icon: ListTodo, badgeKey: "overdue" },
      { href: "/customers", label: "顧客", icon: Building2 },
      { href: "/activities", label: "活動履歴", icon: MessagesSquare },
    ],
  },
  {
    group: "分析",
    items: [
      { href: "/analytics", label: "分析", icon: ChartColumn, roles: MANAGERS },
      { href: "/sales", label: "売上", icon: JapaneseYen, roles: MANAGERS },
      { href: "/reports", label: "レポート", icon: FileBarChart, roles: MANAGERS },
    ],
  },
  {
    group: "管理",
    items: [{ href: "/settings", label: "設定", icon: Settings, roles: ["admin"] }],
  },
];

export function navFor(role: OrgRole) {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
