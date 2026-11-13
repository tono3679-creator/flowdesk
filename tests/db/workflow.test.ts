import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, connect, createTenant, dropTenant, errorOf, type TestTenant } from "./helpers";
import { expectedRevenue } from "@/lib/domain/money";

/** 問い合わせ → 対応 → 案件化 → ステータス変更 → 受注・売上 の業務ルール（トリガー・関数） */
const sql = connect();
let t: TestTenant;
beforeAll(async () => { t = await createTenant(sql, 21); });
afterAll(async () => { await dropTenant(sql, t); await sql.end(); });

const stage = (key: string) => {
  const names: Record<string, string> = { hearing: "ヒアリング", proposed: "提案済み", quote: "見積提出", won: "受注", lost: "失注" };
  const s = t.data.stages.find((x) => x.name === names[key]);
  if (!s) throw new Error(`stage ${key} not found: ${t.data.stages.map((x) => x.name).join(",")}`);
  return s;
};

async function newInquiry(userId: string, owner: string | null) {
  const [row] = await as(sql, t, userId, (tx) => tx<{ id: string; number: number; status: string }[]>`
    insert into public.inquiries (organization_id, received_at, title, contact_name, company_name, email, owner_id, priority, status)
    values (${t.orgId}, now() - interval '2 hours', 'テストの問い合わせ', '新井 太郎', '株式会社テスト', 'arai@example.com', ${owner}, 'high', 'new')
    returning id, number, status`);
  return row;
}

describe("問い合わせから案件まで", () => {
  it("問い合わせ番号は組織ごとの連番", async () => {
    const a = await newInquiry(t.staff.manager, null);
    const b = await newInquiry(t.staff.manager, null);
    expect(b.number).toBe(a.number + 1);
  });

  it("最初の対応を記録すると、初回対応日時が入り「未対応」が「対応中」になる", async () => {
    const inq = await newInquiry(t.staff.member, t.staff.member);
    await as(sql, t, t.staff.member, (tx) => tx`
      insert into public.activities (organization_id, inquiry_id, activity_type, occurred_at, content, next_action_on)
      values (${t.orgId}, ${inq.id}, 'call', now() - interval '1 hour', '折り返し電話。要件をヒアリング', current_date + 3)`);
    const [row] = await sql`select status, first_response_at, next_action_on from public.inquiries where id = ${inq.id}`;
    expect(row.status).toBe("in_progress");
    expect(row.first_response_at).toBeInstanceOf(Date);
    expect(row.next_action_on).not.toBeNull();
  });

  it("案件化：顧客を作り、案件・タスクを作り、問い合わせを「案件化」にする", async () => {
    const inq = await newInquiry(t.staff.member, t.staff.member);
    const [{ deal_id }] = await as(sql, t, t.staff.member, (tx) => tx`
      select public.convert_inquiry(${inq.id}, 'テスト案件', 1200000, 'Web制作', true) deal_id`);
    const [deal] = await sql`select d.*, s.category from public.deals d join public.pipeline_stages s on s.id = d.stage_id where d.id = ${deal_id}`;
    expect(deal.inquiry_id).toBe(inq.id);
    expect(deal.owner_id).toBe(t.staff.member);
    expect(deal.category).toBe("open");
    expect(Number(deal.expected_revenue)).toBe(expectedRevenue(1_200_000, deal.probability));
    const [inquiry] = await sql`select status, converted_deal_id, customer_id from public.inquiries where id = ${inq.id}`;
    expect(inquiry).toMatchObject({ status: "converted", converted_deal_id: deal_id });
    const [customer] = await sql`select type, company_name, name, email from public.customers where id = ${inquiry.customer_id}`;
    expect(customer).toMatchObject({ type: "corporate", company_name: "株式会社テスト", name: "新井 太郎", email: "arai@example.com" });
    const tasks = await sql`select title, assignee_id from public.tasks where deal_id = ${deal_id}`;
    expect(tasks.map((x) => x.title)).toContain("ヒアリングの日程調整：テスト案件");

    // 二重の案件化はできない
    const err = await errorOf(as(sql, t, t.staff.member, (tx) => tx`select public.convert_inquiry(${inq.id}, 'もう一度', 0, null, false)`));
    expect(err).toBe("この問い合わせは案件化済みです");
  });

  it("他人の問い合わせは、一般担当者には案件化できない", async () => {
    const inq = await newInquiry(t.staff.manager, t.staff.tanaka);
    const err = await errorOf(as(sql, t, t.staff.member, (tx) => tx`select public.convert_inquiry(${inq.id}, 'x', 0, null, false)`));
    // 見えない問い合わせなので「見つからない」か「権限がない」
    expect(err).toMatch(/見つかりません|担当者かマネージャー以上/);
  });
});

describe("案件のステータスと売上", () => {
  async function newDeal() {
    const inq = await newInquiry(t.staff.manager, t.staff.manager);
    const [{ id }] = await as(sql, t, t.staff.manager, (tx) => tx`select public.convert_inquiry(${inq.id}, 'ステータスのテスト', 500000, null, false) id`);
    return { dealId: id as string, inquiryId: inq.id };
  }
  const move = (dealId: string, stageId: string, extra = sql``) =>
    as(sql, t, t.staff.manager, (tx) => tx`update public.deals set stage_id = ${stageId} ${extra} where id = ${dealId}`);

  it("ステータスを変えると既定の確度になり、履歴が残る", async () => {
    const { dealId } = await newDeal();
    await move(dealId, stage("proposed").id);
    const [d] = await sql`select probability, expected_revenue from public.deals where id = ${dealId}`;
    expect(d.probability).toBe(stage("proposed").default_probability);
    expect(Number(d.expected_revenue)).toBe(expectedRevenue(500000, d.probability));
    const history = await sql`select to_stage_id from public.deal_stage_history where deal_id = ${dealId} order by changed_at, id`;
    expect(history.at(-1)?.to_stage_id).toBe(stage("proposed").id);
  });

  it("見積提出にすると見積提出日が入り、フォローのタスクができる", async () => {
    const { dealId } = await newDeal();
    await move(dealId, stage("quote").id);
    const [d] = await sql`select quote_submitted_on from public.deals where id = ${dealId}`;
    expect(d.quote_submitted_on).not.toBeNull();
    const tasks = await sql`select title from public.tasks where deal_id = ${dealId} and is_auto`;
    expect(tasks.map((x) => x.title)).toContain("見積フォロー：ステータスのテスト");
  });

  it("受注で確度100%・受注日・売上、失注で確度0%・売上の取り消し", async () => {
    const { dealId } = await newDeal();
    await move(dealId, stage("won").id);
    const [won] = await sql`select probability, closed_on, actual_amount from public.deals where id = ${dealId}`;
    expect(won.probability).toBe(100);
    expect(won.closed_on).not.toBeNull();
    expect(Number(won.actual_amount)).toBe(500000);
    const sales = await sql`select amount from public.sales where deal_id = ${dealId}`;
    expect(sales.map((s) => Number(s.amount))).toEqual([500000]);

    await move(dealId, stage("lost").id, sql`, lost_reason = '価格'`);
    const [lost] = await sql`select probability, expected_revenue from public.deals where id = ${dealId}`;
    expect(lost.probability).toBe(0);
    expect(Number(lost.expected_revenue)).toBe(0);
    expect(await sql`select 1 from public.sales where deal_id = ${dealId}`).toHaveLength(0);
  });

  it("確度を手動で決めた案件は、ステータスを変えても確度を保つ（受注・失注は固定）", async () => {
    const { dealId } = await newDeal();
    await as(sql, t, t.staff.manager, (tx) => tx`update public.deals set probability_manual = true, probability = 65 where id = ${dealId}`);
    await move(dealId, stage("proposed").id);
    expect((await sql`select probability from public.deals where id = ${dealId}`)[0].probability).toBe(65);
    await move(dealId, stage("won").id);
    expect((await sql`select probability from public.deals where id = ${dealId}`)[0].probability).toBe(100);
  });

  it("案件を削除すると、元の問い合わせは「対応中」に戻る", async () => {
    const { dealId, inquiryId } = await newDeal();
    await as(sql, t, t.staff.manager, (tx) => tx`delete from public.deals where id = ${dealId}`);
    const [inq] = await sql`select status, converted_deal_id from public.inquiries where id = ${inquiryId}`;
    expect(inq).toMatchObject({ status: "in_progress", converted_deal_id: null });
  });

  it("受注見込金額（生成列）は TypeScript の計算と一致する", async () => {
    const rows = await sql<{ estimated_amount: number; probability: number; expected_revenue: number }[]>`
      select estimated_amount, probability, expected_revenue from public.deals where organization_id = ${t.orgId}`;
    for (const r of rows) expect(Number(r.expected_revenue)).toBe(expectedRevenue(Number(r.estimated_amount), r.probability));
    // 端数の四捨五入
    const [x] = await sql`select round(333 * 50 / 100.0)::bigint v`;
    expect(Number(x.v)).toBe(expectedRevenue(333, 50));
  });
});
