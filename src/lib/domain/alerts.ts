/**
 * 対応漏れの自動検出（純粋関数）。アラートは保存せず、表示のたびに現在のデータから計算する。
 * 日付の境界は組織のタイムゾーンの暦日で判定する（「今日」が終わる 23:59 までは期限内）。
 */
import { diffDays, hoursBetween, toLocalDate, type DateString } from "./dates";
import { OPEN_INQUIRY_STATUSES, PRIORITY_RANK, type InquiryStatus, type Priority, type StageCategory, type TaskStatus } from "./labels";

export type AlertRules = {
  /** 未対応のまま、この時間（時間）を過ぎた問い合わせ */
  unansweredHours: number;
  /** 見積提出から、この日数を過ぎても受注・失注になっていない案件 */
  quoteFollowDays: number;
  /** 最終接触から、この日数を過ぎた進行中の案件 */
  noContactDays: number;
};

export const DEFAULT_ALERT_RULES: AlertRules = { unansweredHours: 24, quoteFollowDays: 7, noContactDays: 30 };

export type AlertKind = "unanswered" | "quote_follow" | "no_contact" | "task_overdue" | "follow_up_due" | "task_due_today";
export type Severity = "critical" | "high" | "medium";
export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  unanswered: "未対応の問い合わせ",
  quote_follow: "見積フォロー",
  no_contact: "長期未接触",
  task_overdue: "期限超過タスク",
  follow_up_due: "フォロー予定",
  task_due_today: "今日が期限のタスク",
};

export type Alert = {
  kind: AlertKind;
  severity: Severity;
  targetType: "inquiry" | "deal" | "task";
  targetId: string;
  title: string;
  message: string;
  ownerId: string | null;
  /** 並べ替え用：基準を過ぎてからの長さ（時間） */
  overdueHours: number;
};

export type AlertInquiry = {
  id: string; title: string; status: InquiryStatus; priority: Priority; receivedAt: Date; ownerId: string | null; nextActionOn: DateString | null;
};
export type AlertDeal = {
  id: string; title: string; category: StageCategory; ownerId: string | null; quoteSubmittedOn: DateString | null;
  lastContactAt: Date | null; createdAt: Date; nextFollowUpOn: DateString | null;
};
export type AlertTask = { id: string; title: string; status: TaskStatus; priority: Priority; dueOn: DateString | null; assigneeId: string | null };

export type AlertInput = { inquiries: AlertInquiry[]; deals: AlertDeal[]; tasks: AlertTask[] };

/** 未対応：ステータスが「未対応」のまま、受付から基準時間以上 */
export function isUnanswered(inq: Pick<AlertInquiry, "status" | "receivedAt">, now: Date, hours: number): boolean {
  return inq.status === "new" && hoursBetween(inq.receivedAt, now) >= hours;
}

/** 見積フォロー：見積提出から基準日数以上、まだ進行中（受注・失注・保留ではない） */
export function needsQuoteFollow(deal: Pick<AlertDeal, "category" | "quoteSubmittedOn">, today: DateString, days: number): boolean {
  return deal.category === "open" && !!deal.quoteSubmittedOn && diffDays(deal.quoteSubmittedOn, today) >= days;
}

/** 休眠（長期未接触）：進行中の案件で、最終接触（なければ作成日）から基準日数以上 */
export function isDormant(deal: Pick<AlertDeal, "category" | "lastContactAt" | "createdAt">, today: DateString, days: number, tz: string): boolean {
  if (deal.category !== "open") return false;
  const basis = toLocalDate(deal.lastContactAt ?? deal.createdAt, tz);
  return diffDays(basis, today) >= days;
}

/** 期限超過：期限の日が今日より前で、未完了 */
export function isOverdue(task: Pick<AlertTask, "status" | "dueOn">, today: DateString): boolean {
  return task.status !== "done" && !!task.dueOn && task.dueOn < today;
}

export function daysSince(date: DateString, today: DateString): number {
  return diffDays(date, today);
}

/** 対応漏れのアラートをすべて検出し、重要度 → 遅れの大きい順に並べる */
export function detectAlerts(input: AlertInput, rules: AlertRules, now: Date, tz: string): Alert[] {
  const today = toLocalDate(now, tz);
  const alerts: Alert[] = [];

  for (const inq of input.inquiries) {
    if (isUnanswered(inq, now, rules.unansweredHours)) {
      const hours = hoursBetween(inq.receivedAt, now);
      alerts.push({
        kind: "unanswered",
        severity: inq.priority === "urgent" || inq.priority === "high" ? "critical" : "high",
        targetType: "inquiry", targetId: inq.id, title: inq.title, ownerId: inq.ownerId,
        message: `問い合わせから${rules.unansweredHours}時間以上未対応です（受付から${formatElapsed(hours)}）`,
        overdueHours: hours - rules.unansweredHours,
      });
    }
    if (OPEN_INQUIRY_STATUSES.includes(inq.status) && inq.nextActionOn && inq.nextActionOn <= today) {
      const late = diffDays(inq.nextActionOn, today);
      alerts.push({
        kind: "follow_up_due", severity: late > 0 ? "high" : "medium",
        targetType: "inquiry", targetId: inq.id, title: inq.title, ownerId: inq.ownerId,
        message: late > 0 ? `次回対応予定日を${late}日過ぎています` : "今日が次回対応予定日です",
        overdueHours: late * 24,
      });
    }
  }

  for (const deal of input.deals) {
    if (needsQuoteFollow(deal, today, rules.quoteFollowDays)) {
      const days = diffDays(deal.quoteSubmittedOn as string, today);
      alerts.push({
        kind: "quote_follow", severity: "high", targetType: "deal", targetId: deal.id, title: deal.title, ownerId: deal.ownerId,
        message: `見積提出から${days}日経過しています。フォローを推奨します。`,
        overdueHours: (days - rules.quoteFollowDays) * 24,
      });
    }
    if (isDormant(deal, today, rules.noContactDays, tz)) {
      const days = diffDays(toLocalDate(deal.lastContactAt ?? deal.createdAt, tz), today);
      alerts.push({
        kind: "no_contact", severity: "medium", targetType: "deal", targetId: deal.id, title: deal.title, ownerId: deal.ownerId,
        message: `${rules.noContactDays}日以上顧客との接触がありません（最終接触から${days}日）。`,
        overdueHours: (days - rules.noContactDays) * 24,
      });
    }
    if (deal.category === "open" && deal.nextFollowUpOn && deal.nextFollowUpOn <= today) {
      const late = diffDays(deal.nextFollowUpOn, today);
      alerts.push({
        kind: "follow_up_due", severity: late > 0 ? "high" : "medium",
        targetType: "deal", targetId: deal.id, title: deal.title, ownerId: deal.ownerId,
        message: late > 0 ? `次回フォロー日を${late}日過ぎています` : "今日が次回フォロー日です",
        overdueHours: late * 24,
      });
    }
  }

  for (const task of input.tasks) {
    if (isOverdue(task, today)) {
      const late = diffDays(task.dueOn as string, today);
      alerts.push({
        kind: "task_overdue",
        severity: task.priority === "urgent" || task.priority === "high" ? "critical" : "high",
        targetType: "task", targetId: task.id, title: task.title, ownerId: task.assigneeId,
        message: `期限を${late}日過ぎています`,
        overdueHours: late * 24,
      });
    }
  }
  return sortAlerts(alerts);
}

/** 今日やること：アラート ＋ 今日が期限のタスク（優先度順） */
export function buildTodayList(input: AlertInput, rules: AlertRules, now: Date, tz: string): Alert[] {
  const today = toLocalDate(now, tz);
  const items = detectAlerts(input, rules, now, tz);
  for (const task of input.tasks) {
    if (task.status !== "done" && task.dueOn === today) {
      items.push({
        kind: "task_due_today", severity: task.priority === "urgent" ? "critical" : task.priority === "high" ? "high" : "medium",
        targetType: "task", targetId: task.id, title: task.title, ownerId: task.assigneeId,
        message: "今日が期限です", overdueHours: -PRIORITY_RANK[task.priority],
      });
    }
  }
  return sortAlerts(items);
}

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.overdueHours - a.overdueHours);
}

export function countByKind(alerts: Alert[]): Record<AlertKind, number> {
  const out: Record<AlertKind, number> = { unanswered: 0, quote_follow: 0, no_contact: 0, task_overdue: 0, follow_up_due: 0, task_due_today: 0 };
  for (const a of alerts) out[a.kind]++;
  return out;
}

function formatElapsed(hours: number): string {
  if (hours < 48) return `${Math.floor(hours)}時間`;
  return `${Math.floor(hours / 24)}日`;
}
