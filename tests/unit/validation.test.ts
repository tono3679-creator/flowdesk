import { describe, expect, it } from "vitest";
import { dealSchema, inquirySchema, taskSchema, yen, type DealInput, type InquiryInput, type TaskInput } from "@/lib/validation";

const UUID = "11111111-1111-4111-8111-111111111111";

const inquiry = (o: Partial<InquiryInput> = {}): InquiryInput => ({
  received_at: "2026-11-12T10:00", customer_id: "", create_customer: false, source_id: "", category: "", title: "サイト改修の相談",
  content: "", contact_name: "山田", company_name: "", phone: "", email: "", owner_id: "", priority: "medium", status: "new",
  next_action_on: "", memo: "", ...o,
});

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => i.message));

describe("問い合わせの入力", () => {
  it("空欄は null になり、受付日時は日本時間として読む", () => {
    const r = inquirySchema.parse(inquiry());
    expect(r.customer_id).toBeNull();
    expect(r.content).toBeNull();
    expect(r.received_at.toISOString()).toBe("2026-11-12T01:00:00.000Z");
  });

  it("顧客・氏名・会社名のどれも無いとエラー", () => {
    expect(messages(inquirySchema.safeParse(inquiry({ contact_name: "" })))).toContain("既存の顧客を選ぶか、氏名・会社名のどちらかを入力してください");
    expect(inquirySchema.safeParse(inquiry({ contact_name: "", company_name: "株式会社A" })).success).toBe(true);
    expect(inquirySchema.safeParse(inquiry({ contact_name: "", customer_id: UUID })).success).toBe(true);
  });

  it("未来の受付日時は受け付けない", () => {
    expect(messages(inquirySchema.safeParse(inquiry({ received_at: "2099-01-01T00:00" })))).toContain("受付日時に未来の日時は指定できません");
  });

  it("件名は必須・100文字まで", () => {
    expect(messages(inquirySchema.safeParse(inquiry({ title: "   " })))).toContain("件名を入力してください");
    expect(messages(inquirySchema.safeParse(inquiry({ title: "あ".repeat(101) })))).toContain("件名は100文字以内で入力してください");
  });

  it("電話番号は全角を半角にそろえ、メールは形式を確かめる", () => {
    expect(inquirySchema.parse(inquiry({ phone: "０３－１２３４－５６７８" })).phone).toBe("03-1234-5678");
    expect(messages(inquirySchema.safeParse(inquiry({ phone: "abc" })))).toContain("電話番号は数字とハイフンで入力してください");
    expect(messages(inquirySchema.safeParse(inquiry({ email: "foo@" })))).toContain("メールアドレスの形式が正しくありません");
  });

  it("案件化済みはフォームから選べない", () => {
    expect(inquirySchema.safeParse(inquiry({ status: "converted" as never })).success).toBe(false);
  });
});

describe("金額の入力", () => {
  const y = yen("見積金額");
  it("カンマ・円・空白を取り除いて整数にする", () => {
    expect(y.parse("1,200,000円")).toBe(1_200_000);
    expect(y.parse(" 3000 ")).toBe(3000);
    expect(y.parse(500)).toBe(500);
  });
  it("空・負数・小数・文字はエラー", () => {
    expect(y.safeParse("").success).toBe(false);
    expect(y.safeParse("-1").success).toBe(false);
    expect(y.safeParse("10.5").success).toBe(false);
    expect(y.safeParse("abc").success).toBe(false);
  });
});

describe("案件・タスクの入力", () => {
  const deal = (o: Partial<DealInput> = {}): DealInput => ({
    title: "コーポレートサイト", customer_id: UUID, owner_id: "", deal_type: "", stage_id: UUID, probability_manual: false, probability: 30,
    estimated_amount: "1000000", actual_amount: "", started_on: "", quote_submitted_on: "", expected_close_on: "2026-12-01",
    expected_complete_on: "", closed_on: "", revenue_on: "", next_follow_up_on: "", lost_reason: "", memo: "", ...o,
  });
  it("案件：受注金額は空なら null、確度は 0〜100", () => {
    const r = dealSchema.parse(deal());
    expect(r.actual_amount).toBeNull();
    expect(r.estimated_amount).toBe(1_000_000);
    expect(dealSchema.safeParse(deal({ probability: 101 })).success).toBe(false);
    expect(dealSchema.safeParse(deal({ expected_close_on: "2026-02-30" })).success).toBe(false);
  });

  const task = (o: Partial<TaskInput> = {}): TaskInput => ({
    title: "見積書を送る", description: "", assignee_id: "", customer_id: "", deal_id: "", inquiry_id: "", priority: "high", status: "todo",
    start_on: "", due_on: "", memo: "", ...o,
  });
  it("タスク：期限は開始日以降", () => {
    expect(taskSchema.safeParse(task({ start_on: "2026-11-10", due_on: "2026-11-10" })).success).toBe(true);
    expect(messages(taskSchema.safeParse(task({ start_on: "2026-11-10", due_on: "2026-11-09" })))).toContain("期限は開始日以降にしてください");
  });
});
