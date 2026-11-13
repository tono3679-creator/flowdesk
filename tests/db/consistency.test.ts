import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, connect, createTenant, dropTenant, type TestTenant } from "./helpers";
import { monthPeriod, toLocalDate } from "@/lib/domain/dates";

/** 読み込んだデモデータの整合性（画面の数字が DB とずれないこと） */
const sql = connect();
let t: TestTenant;
beforeAll(async () => { t = await createTenant(sql, 41); });
afterAll(async () => { await dropTenant(sql, t); await sql.end(); });

describe("データの整合性", () => {
  it("件数が生成したデータと一致する", async () => {
    const [c] = await as(sql, t, t.staff.admin, (tx) => tx`select
      (select count(*)::int from public.customers) customers, (select count(*)::int from public.inquiries) inquiries,
      (select count(*)::int from public.deals) deals, (select count(*)::int from public.tasks) tasks,
      (select count(*)::int from public.activities) activities, (select count(*)::int from public.sales) sales`);
    expect(c).toEqual({
      customers: t.data.customers.length, inquiries: t.data.inquiries.length, deals: t.data.deals.length,
      tasks: t.data.tasks.length, activities: t.data.activities.length, sales: t.data.sales.length,
    });
  });

  it("売上は受注・完了の案件と1対1で、金額は受注金額", async () => {
    const bad = await sql`
      select d.id from public.deals d join public.pipeline_stages s on s.id = d.stage_id
        left join public.sales x on x.deal_id = d.id
       where d.organization_id = ${t.orgId}
         and ((s.category in ('won', 'completed')) <> (x.id is not null) or (x.id is not null and x.amount <> coalesce(d.actual_amount, d.estimated_amount)))`;
    expect(bad).toHaveLength(0);
  });

  it("案件化済みの問い合わせはすべて案件を指し、案件の顧客と一致する", async () => {
    const bad = await sql`
      select i.id from public.inquiries i left join public.deals d on d.id = i.converted_deal_id
       where i.organization_id = ${t.orgId} and i.status = 'converted' and (d.id is null or d.customer_id is distinct from coalesce(i.customer_id, d.customer_id))`;
    expect(bad).toHaveLength(0);
  });

  it("番号の採番カウンターは最大の番号以上（次に作る番号が重複しない）", async () => {
    const rows = await sql`
      select c.kind, c.value, (case c.kind when 'customers' then (select max(number) from public.customers where organization_id = c.organization_id)
                                         when 'inquiries' then (select max(number) from public.inquiries where organization_id = c.organization_id)
                                         when 'deals' then (select max(number) from public.deals where organization_id = c.organization_id) end) max
        from app_private.counters c where c.organization_id = ${t.orgId}`;
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) expect(r.value, r.kind).toBeGreaterThanOrEqual(r.max ?? 0);
  });

  it("今月の受注件数：DB の集計と生成データの集計が一致する", async () => {
    const today = toLocalDate(new Date(), "Asia/Tokyo");
    const period = monthPeriod(today);
    const [{ n }] = await sql`select count(*)::int n from public.deals d join public.pipeline_stages s on s.id = d.stage_id
      where d.organization_id = ${t.orgId} and s.category in ('won', 'completed') and d.closed_on between ${period.from} and ${period.to}`;
    const cats = new Map(t.data.stages.map((s) => [s.id, s.category]));
    const deals = t.data.deals.map((d) => ({ ...d, category: cats.get(d.stage_id)!, closedOn: d.closed_on }));
    const won = deals.filter((d) => (d.category === "won" || d.category === "completed") && d.closedOn && d.closedOn >= period.from && d.closedOn <= period.to);
    expect(n).toBe(won.length);
  });
});
