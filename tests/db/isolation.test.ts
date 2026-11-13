import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, connect, createTenant, dropTenant, errorOf, type TestTenant } from "./helpers";

/** マルチテナントの分離と、役割ごとに見える範囲 */
const sql = connect();
let a: TestTenant;
let b: TestTenant;
beforeAll(async () => { a = await createTenant(sql, 11); b = await createTenant(sql, 12); });
afterAll(async () => { await dropTenant(sql, a); await dropTenant(sql, b); await sql.end(); });

const TABLES = ["customers", "inquiries", "deals", "tasks", "activities", "sales", "pipeline_stages", "inquiry_sources", "customer_tags", "deal_stage_history"] as const;

describe("組織の分離", () => {
  it("管理者でも、自分の組織のデータしか見えない", async () => {
    for (const table of TABLES) {
      const orgs = await as(sql, a, a.staff.admin, (tx) => tx`select distinct organization_id from ${tx(`public.${table}`)}`);
      expect(orgs.map((r) => r.organization_id), table).toEqual([a.orgId]);
    }
  });

  it("所属していない組織を指定しても何も見えない", async () => {
    const rows = await as(sql, b, a.staff.admin, (tx) => tx`select count(*)::int n from public.customers`);
    expect(rows[0].n).toBe(0);
  });

  it("他の組織の行は ID を指定しても読めず、書き換えもできない", async () => {
    const target = b.data.customers[0];
    const read = await as(sql, a, a.staff.admin, (tx) => tx`select id from public.customers where id = ${target.id}`);
    expect(read).toHaveLength(0);
    const updated = await as(sql, a, a.staff.admin, (tx) => tx`update public.customers set memo = 'x' where id = ${target.id} returning id`);
    expect(updated).toHaveLength(0);
    const deleted = await as(sql, a, a.staff.admin, (tx) => tx`delete from public.inquiries where id = ${b.data.inquiries[0].id} returning id`);
    expect(deleted).toHaveLength(0);
  });

  it("他の組織の ID で行を作れない", async () => {
    const err = await errorOf(as(sql, a, a.staff.admin, (tx) => tx`
      insert into public.customers (organization_id, type, company_name) values (${b.orgId}, 'corporate', '侵入テスト')`));
    expect(err).toMatch(/row-level security/);
  });

  it("他の組織の案件を案件化の関数から触れない", async () => {
    const inq = b.data.inquiries.find((i) => i.status !== "converted")!;
    const err = await errorOf(as(sql, a, a.staff.admin, (tx) => tx`select public.convert_inquiry(${inq.id}, 'x', 0, null, false)`));
    expect(err).toBe("問い合わせが見つかりません");
  });
});

describe("役割ごとの見える範囲", () => {
  it("一般担当者は、自分担当・未割当・自分が受け付けた問い合わせだけ見える", async () => {
    const me = a.staff.member;
    const rows = await as(sql, a, me, (tx) => tx<{ owner_id: string | null; created_by: string | null }[]>`select owner_id, created_by from public.inquiries`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.owner_id === null || r.owner_id === me || r.created_by === me)).toBe(true);
    const all = await as(sql, a, a.staff.manager, (tx) => tx`select count(*)::int n from public.inquiries`);
    expect(all[0].n).toBe(a.data.inquiries.length);
    expect(rows.length).toBeLessThan(all[0].n);
  });

  it("一般担当者は、自分の案件だけ見える", async () => {
    const me = a.staff.member;
    const rows = await as(sql, a, me, (tx) => tx<{ owner_id: string | null; created_by: string | null }[]>`select owner_id, created_by from public.deals`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.owner_id === me || r.created_by === me)).toBe(true);
  });

  it("一般担当者は、問い合わせの担当を他の人にできない（マネージャーはできる）", async () => {
    const inq = a.data.inquiries.find((i) => i.owner_id === a.staff.member)!;
    const err = await errorOf(as(sql, a, a.staff.member, (tx) => tx`update public.inquiries set owner_id = ${a.staff.tanaka} where id = ${inq.id}`));
    expect(err).toBe("担当者を他のメンバーに変更できるのはマネージャー以上です");
    const ok = await as(sql, a, a.staff.manager, (tx) => tx`update public.inquiries set owner_id = ${a.staff.tanaka} where id = ${inq.id} returning id`);
    expect(ok).toHaveLength(1);
    await as(sql, a, a.staff.manager, (tx) => tx`update public.inquiries set owner_id = ${a.staff.member} where id = ${inq.id}`);
  });

  it("一般担当者は問い合わせ・案件を削除できない", async () => {
    const inq = a.data.inquiries.find((i) => i.owner_id === a.staff.member)!;
    const rows = await as(sql, a, a.staff.member, (tx) => tx`delete from public.inquiries where id = ${inq.id} returning id`);
    expect(rows).toHaveLength(0);
  });

  it("設定（アラートの条件）を変えられるのは管理者だけ", async () => {
    const byManager = await as(sql, a, a.staff.manager, (tx) => tx`update public.organization_settings set unanswered_hours = 12 returning organization_id`);
    expect(byManager).toHaveLength(0);
    const byAdmin = await as(sql, a, a.staff.admin, (tx) => tx`update public.organization_settings set unanswered_hours = 24 returning organization_id`);
    expect(byAdmin).toHaveLength(1);
  });
});
