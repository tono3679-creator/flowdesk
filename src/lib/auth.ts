import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { asUser, type Tx } from "@/lib/db";
import type { AlertRules } from "@/lib/domain/alerts";
import { DEFAULT_PRIORITY_LABEL, type OrgRole, type PriorityLabels } from "@/lib/domain/labels";
import { readSession } from "@/lib/session";

export type OrgSettings = AlertRules & {
  industry: string;
  timezone: string;
  currency: string;
  firstResponseTargetHours: number;
  inquiryCategories: string[];
  dealTypes: string[];
  priorityLabels: PriorityLabels;
  autoTasks: boolean;
};

export type CurrentUser = {
  userId: string;
  role: OrgRole;
  organizationId: string;
  organizationName: string;
  displayName: string;
  title: string | null;
  isDemo: boolean;
  isAnonymous: boolean;
  /** 管理者・マネージャー（チーム全体を見る） */
  isManager: boolean;
  settings: OrgSettings;
};

/** ログイン中の利用者と所属組織（未ログイン・所属なしなら null） */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const rows = await asUser(session.id, (tx) => tx<{
    role: OrgRole; organization_id: string; organization_name: string; display_name: string; title: string | null; is_demo: boolean;
    industry: string; timezone: string; currency: string; unanswered_hours: number; quote_follow_days: number; no_contact_days: number;
    first_response_target_hours: number; inquiry_categories: string[]; deal_types: string[]; priority_labels: Partial<PriorityLabels>; auto_tasks: boolean;
  }[]>`
    select m.role, o.id organization_id, o.name organization_name, p.display_name, p.title, o.is_demo,
           s.industry, s.timezone, s.currency, s.unanswered_hours, s.quote_follow_days, s.no_contact_days, s.first_response_target_hours,
           s.inquiry_categories, s.deal_types, s.priority_labels, s.auto_tasks
      from organizations o
      join organization_members m on m.organization_id = o.id and m.user_id = ${session.id} and m.is_active
      join profiles p on p.id = m.user_id
      join organization_settings s on s.organization_id = o.id
     where o.id = current_org_id()`, session.organizationId);
  const row = rows[0];
  if (!row) return null;
  return {
    userId: session.id,
    role: row.role,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    displayName: row.display_name,
    title: row.title,
    isDemo: row.is_demo,
    isAnonymous: session.isAnonymous,
    isManager: row.role === "admin" || row.role === "manager",
    settings: {
      industry: row.industry,
      timezone: row.timezone,
      currency: row.currency,
      unansweredHours: row.unanswered_hours,
      quoteFollowDays: row.quote_follow_days,
      noContactDays: row.no_contact_days,
      firstResponseTargetHours: row.first_response_target_hours,
      inquiryCategories: row.inquiry_categories,
      dealTypes: row.deal_types,
      priorityLabels: { ...DEFAULT_PRIORITY_LABEL, ...row.priority_labels },
      autoTasks: row.auto_tasks,
    },
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 役割が足りなければダッシュボードへ（画面用。Server Actions も同じ確認をし、DB の RLS が最終的に断る） */
export async function requireRole(roles: OrgRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

/** ログイン中の利用者として RLS 付きで実行（データ取得と Server Actions の入口） */
export async function asCurrentUser<T>(fn: (tx: Tx, user: CurrentUser) => Promise<T>): Promise<T> {
  const user = await requireUser();
  return asUser(user.userId, (tx) => fn(tx, user), user.organizationId);
}
