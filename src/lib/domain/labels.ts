/** 区分の値と表示名（DB の enum と同じ値）。画面・CSV・テストで共通に使う */

export const ORG_ROLES = ["admin", "manager", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];
export const ROLE_LABEL: Record<OrgRole, string> = { admin: "管理者", manager: "マネージャー", member: "一般担当者" };

export const CUSTOMER_TYPES = ["corporate", "individual"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = { corporate: "法人", individual: "個人" };

export const CUSTOMER_RANKS = ["S", "A", "B", "C"] as const;
export type CustomerRank = (typeof CUSTOMER_RANKS)[number];

export const INQUIRY_STATUSES = ["new", "in_progress", "on_hold", "converted", "closed", "not_needed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "未対応", in_progress: "対応中", on_hold: "保留", converted: "案件化", closed: "完了", not_needed: "対応不要",
};
/** まだ対応が続いている問い合わせ */
export const OPEN_INQUIRY_STATUSES: readonly InquiryStatus[] = ["new", "in_progress", "on_hold"];
/** 画面から選べるステータス（案件化は「案件化」ボタンだけで行う） */
export const EDITABLE_INQUIRY_STATUSES = ["new", "in_progress", "on_hold", "closed", "not_needed"] as const;

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const DEFAULT_PRIORITY_LABEL: Record<Priority, string> = { low: "低", medium: "中", high: "高", urgent: "緊急" };
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
export type PriorityLabels = Record<Priority, string>;

export const STAGE_CATEGORIES = ["open", "won", "completed", "lost", "hold"] as const;
export type StageCategory = (typeof STAGE_CATEGORIES)[number];
export const STAGE_CATEGORY_LABEL: Record<StageCategory, string> = {
  open: "進行中", won: "受注", completed: "完了（受注）", lost: "失注", hold: "保留",
};
export const WON_CATEGORIES: readonly StageCategory[] = ["won", "completed"];
export function isWon(category: StageCategory): boolean {
  return category === "won" || category === "completed";
}

export const TASK_STATUSES = ["todo", "doing", "waiting", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: "未着手", doing: "対応中", waiting: "確認待ち", done: "完了" };

export const ACTIVITY_TYPES = ["call", "email", "line", "online_meeting", "visit", "meeting", "quote", "other"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  call: "電話", email: "メール", line: "LINE", online_meeting: "オンライン会議", visit: "訪問", meeting: "商談", quote: "見積提出", other: "その他",
};

export const TAG_COLORS = ["slate", "blue", "green", "amber", "red", "violet", "teal", "pink"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export const LOST_REASONS = ["価格", "競合に決定", "予算不足", "時期が合わない", "要件が合わない", "連絡が途絶えた", "その他"] as const;

export const INDUSTRIES = [
  "建設・設備", "不動産", "Web制作", "システム開発", "修理・メンテナンス", "清掃", "士業", "人材", "保険代理店",
  "コンサルティング", "BtoB営業", "広告代理店", "法人向け業務改善・Web制作", "その他サービス業",
] as const;
