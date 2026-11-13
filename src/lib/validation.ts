/** 入力の検証（画面とサーバーで同じものを使う。DB の制約・トリガー・RLS が最後の守り） */
import { z } from "zod";
import {
  ACTIVITY_TYPES, CUSTOMER_RANKS, CUSTOMER_TYPES, EDITABLE_INQUIRY_STATUSES, ORG_ROLES, PRIORITIES, STAGE_CATEGORIES, TAG_COLORS, TASK_STATUSES,
} from "@/lib/domain/labels";
import { isDateString } from "@/lib/domain/dates";

const emptyToNull = (v: string) => (v === "" ? null : v);

export const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}は${max}文字以内で入力してください`).transform(emptyToNull).nullable();

const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label}を入力してください`).max(max, `${label}は${max}文字以内で入力してください`);

const optionalEmail = z.string().trim().max(200, "メールアドレスは200文字以内です")
  .refine((v) => v === "" || z.email().safeParse(v).success, "メールアドレスの形式が正しくありません")
  .transform(emptyToNull).nullable();

const optionalPhone = z.string().trim().max(30, "電話番号は30文字以内です")
  .refine((v) => v === "" || /^[0-9０-９+\-－() ]{6,30}$/.test(v), "電話番号は数字とハイフンで入力してください")
  .transform((v) => (v === "" ? null : v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/－/g, "-")))
  .nullable();

const optionalUuid = z.string().transform(emptyToNull).pipe(z.uuid("選択肢から選んでください").nullable()).nullable();

const optionalDate = z.string().transform(emptyToNull)
  .pipe(z.string().refine(isDateString, "日付を正しく入力してください").nullable()).nullable();

/** 'YYYY-MM-DDTHH:mm'（日本時間の入力欄）→ Date */
const dateTimeLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "日時を正しく入力してください")
  .transform((v) => new Date(`${v}:00+09:00`))
  .refine((d) => !Number.isNaN(d.getTime()), "日時を正しく入力してください");

export const yen = (label: string) =>
  z.union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? (v.trim() === "" ? Number.NaN : Number(v.replace(/[,，円\s]/g, ""))) : v))
    .pipe(z.number({ error: `${label}を数字で入力してください` })
      .int(`${label}は円単位の整数で入力してください`).min(0, `${label}は0円以上にしてください`).max(100_000_000_000, `${label}が大きすぎます`));

const optionalYen = (label: string) =>
  z.union([z.number(), z.string()]).transform((v) => (typeof v === "string" && v.trim() === "" ? null : v))
    .pipe(yen(label).nullable()).nullable();

// ---------------------------------------------------------------
export const customerSchema = z.object({
  type: z.enum(CUSTOMER_TYPES),
  company_name: optionalText(100, "会社名"),
  name: optionalText(50, "氏名"),
  department: optionalText(50, "部署"),
  position: optionalText(50, "役職"),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(200, "住所"),
  owner_id: optionalUuid,
  rank: z.string().transform(emptyToNull).pipe(z.enum(CUSTOMER_RANKS).nullable()).nullable(),
  memo: optionalText(2000, "メモ"),
  tag_ids: z.array(z.uuid()).max(20, "タグは20個までです"),
}).superRefine((v, ctx) => {
  if (v.type === "corporate" && !v.company_name) ctx.addIssue({ code: "custom", path: ["company_name"], message: "法人の場合は会社名を入力してください" });
  if (v.type === "individual" && !v.name) ctx.addIssue({ code: "custom", path: ["name"], message: "個人の場合は氏名を入力してください" });
});
export type CustomerInput = z.input<typeof customerSchema>;

export const inquirySchema = z.object({
  received_at: dateTimeLocal,
  customer_id: optionalUuid,
  create_customer: z.boolean(),
  source_id: optionalUuid,
  category: optionalText(30, "問い合わせ種別"),
  title: requiredText(100, "件名"),
  content: optionalText(5000, "問い合わせ内容"),
  contact_name: optionalText(50, "氏名"),
  company_name: optionalText(100, "会社名"),
  phone: optionalPhone,
  email: optionalEmail,
  owner_id: optionalUuid,
  priority: z.enum(PRIORITIES),
  status: z.enum(EDITABLE_INQUIRY_STATUSES),
  next_action_on: optionalDate,
  memo: optionalText(2000, "メモ"),
}).superRefine((v, ctx) => {
  if (!v.customer_id && !v.contact_name && !v.company_name) {
    ctx.addIssue({ code: "custom", path: ["contact_name"], message: "既存の顧客を選ぶか、氏名・会社名のどちらかを入力してください" });
  }
  if (v.received_at.getTime() > Date.now() + 5 * 60_000) {
    ctx.addIssue({ code: "custom", path: ["received_at"], message: "受付日時に未来の日時は指定できません" });
  }
});
export type InquiryInput = z.input<typeof inquirySchema>;

export const convertSchema = z.object({
  title: requiredText(100, "案件名"),
  estimated_amount: yen("見積金額"),
  deal_type: optionalText(30, "案件種別"),
  create_task: z.boolean(),
});

export const dealSchema = z.object({
  title: requiredText(100, "案件名"),
  customer_id: z.uuid("顧客を選んでください"),
  owner_id: optionalUuid,
  deal_type: optionalText(30, "案件種別"),
  stage_id: z.uuid("ステータスを選んでください"),
  probability_manual: z.boolean(),
  probability: z.coerce.number({ error: "受注確度を数字で入力してください" }).int().min(0, "0〜100で入力してください").max(100, "0〜100で入力してください"),
  estimated_amount: yen("見積金額"),
  actual_amount: optionalYen("受注金額"),
  started_on: optionalDate,
  quote_submitted_on: optionalDate,
  expected_close_on: optionalDate,
  expected_complete_on: optionalDate,
  closed_on: optionalDate,
  revenue_on: optionalDate,
  next_follow_up_on: optionalDate,
  lost_reason: optionalText(50, "失注理由"),
  memo: optionalText(5000, "メモ"),
});
export type DealInput = z.input<typeof dealSchema>;

export const taskSchema = z.object({
  title: requiredText(100, "タイトル"),
  description: optionalText(2000, "内容"),
  assignee_id: optionalUuid,
  customer_id: optionalUuid,
  deal_id: optionalUuid,
  inquiry_id: optionalUuid,
  priority: z.enum(PRIORITIES),
  status: z.enum(TASK_STATUSES),
  start_on: optionalDate,
  due_on: optionalDate,
  memo: optionalText(2000, "メモ"),
}).refine((v) => !v.start_on || !v.due_on || v.start_on <= v.due_on, { path: ["due_on"], message: "期限は開始日以降にしてください" });
export type TaskInput = z.input<typeof taskSchema>;

export const activitySchema = z.object({
  activity_type: z.enum(ACTIVITY_TYPES),
  occurred_at: dateTimeLocal,
  customer_id: optionalUuid,
  inquiry_id: optionalUuid,
  deal_id: optionalUuid,
  content: requiredText(5000, "対応内容"),
  result: optionalText(1000, "結果"),
  next_action_on: optionalDate,
  memo: optionalText(2000, "メモ"),
}).superRefine((v, ctx) => {
  if (!v.customer_id && !v.inquiry_id && !v.deal_id) ctx.addIssue({ code: "custom", path: ["customer_id"], message: "顧客・問い合わせ・案件のどれかを選んでください" });
  if (v.occurred_at.getTime() > Date.now() + 24 * 3600_000) ctx.addIssue({ code: "custom", path: ["occurred_at"], message: "対応日時は今日までにしてください" });
});
export type ActivityInput = z.input<typeof activitySchema>;

// ---------------------------------------------------------------
// 設定
// ---------------------------------------------------------------
const list = (label: string, max: number) =>
  z.array(z.string().trim().min(1).max(30, `${label}は30文字以内です`)).min(1, `${label}を1つ以上入力してください`).max(max)
    .refine((v) => new Set(v).size === v.length, `${label}に同じ名前があります`);

export const settingsSchema = z.object({
  company_name: requiredText(100, "会社名"),
  industry: requiredText(50, "業種"),
  timezone: z.enum(["Asia/Tokyo"]),
  currency: z.enum(["JPY"]),
  unanswered_hours: z.coerce.number().int().min(1, "1以上で入力してください").max(720, "720時間以内にしてください"),
  quote_follow_days: z.coerce.number().int().min(1, "1以上で入力してください").max(180, "180日以内にしてください"),
  no_contact_days: z.coerce.number().int().min(1, "1以上で入力してください").max(365, "365日以内にしてください"),
  first_response_target_hours: z.coerce.number().int().min(1, "1以上で入力してください").max(720, "720時間以内にしてください"),
  inquiry_categories: list("問い合わせ種別", 30),
  deal_types: list("案件種別", 30),
  priority_labels: z.object({ low: requiredText(10, "表示名"), medium: requiredText(10, "表示名"), high: requiredText(10, "表示名"), urgent: requiredText(10, "表示名") }),
  auto_tasks: z.boolean(),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const stageSchema = z.object({
  id: z.uuid().nullable(),
  name: requiredText(30, "ステータス名"),
  category: z.enum(STAGE_CATEGORIES),
  default_probability: z.coerce.number().int().min(0).max(100),
  board_column: optionalText(20, "ボードの列"),
  marks_quote_submitted: z.boolean(),
  is_active: z.boolean(),
});
export const stagesSchema = z.array(stageSchema).min(1).max(30)
  .refine((v) => new Set(v.map((s) => s.name)).size === v.length, "同じ名前のステータスがあります")
  .refine((v) => v.some((s) => s.category === "open" && s.is_active), "進行中のステータスを1つ以上有効にしてください");

export const sourceSchema = z.object({ id: z.uuid().nullable(), name: requiredText(30, "経路名"), is_active: z.boolean() });
export const sourcesSchema = z.array(sourceSchema).min(1).max(30)
  .refine((v) => new Set(v.map((s) => s.name)).size === v.length, "同じ名前の経路があります");

export const tagSchema = z.object({ id: z.uuid().nullable(), name: requiredText(20, "タグ名"), color: z.enum(TAG_COLORS) });
export const tagsSchema = z.array(tagSchema).max(50)
  .refine((v) => new Set(v.map((s) => s.name)).size === v.length, "同じ名前のタグがあります");

export const memberSchema = z.object({
  email: z.email("メールアドレスの形式が正しくありません").max(200),
  display_name: requiredText(50, "氏名"),
  title: optionalText(50, "役職"),
  role: z.enum(ORG_ROLES),
  password: z.string().min(12, "パスワードは12文字以上にしてください").max(100),
});
