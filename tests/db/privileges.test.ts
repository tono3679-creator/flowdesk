import { afterAll, describe, expect, it } from "vitest";
import { connect } from "./helpers";

/**
 * DB の権限の一覧を固定する。権限を足したり外したりしたら、ここも意図して書き換える
 * （うっかり広げてしまうのを防ぐため）。
 */
const sql = connect();
afterAll(async () => { await sql.end(); });

describe("権限の一覧", () => {
  it("表の権限（authenticated）：読み取りと削除だけ。書き込みは列単位で許可する", async () => {
    const rows = await sql<{ g: string }[]>`
      select table_name || ':' || string_agg(privilege_type, ',' order by privilege_type) as g
      from information_schema.role_table_grants where grantee = 'authenticated' and table_schema in ('public', 'app_auth', 'app_private')
      group by table_schema, table_name order by 1`;
    expect(rows.map((r) => r.g)).toEqual([
      "activities:DELETE,SELECT",
      "customer_tag_relations:DELETE,SELECT",
      "customer_tags:DELETE,SELECT",
      "customers:DELETE,SELECT",
      "deal_stage_history:SELECT",
      "deals:DELETE,SELECT",
      "inquiries:DELETE,SELECT",
      "inquiry_sources:DELETE,SELECT",
      "organization_members:SELECT",
      "organization_settings:SELECT",
      "organizations:SELECT",
      "pipeline_stages:DELETE,SELECT",
      "profiles:SELECT",
      "sales:SELECT",
      "tasks:DELETE,SELECT",
    ]);
  });

  it("売上・ステータス履歴・ログイン情報には書き込めない（トリガーだけが書く）", async () => {
    const rows = await sql<{ t: string }[]>`
      select distinct table_name as t from information_schema.column_privileges
      where grantee = 'authenticated' and table_schema in ('public', 'app_auth') and privilege_type in ('INSERT', 'UPDATE') order by 1`;
    expect(rows.map((r) => r.t)).not.toEqual(expect.arrayContaining(["sales"]));
    expect(rows.map((r) => r.t)).not.toContain("deal_stage_history");
    expect(rows.map((r) => r.t)).not.toContain("users");
    // 番号・作成者・確度の自動計算に使う列は書けない
    const cols = await sql<{ c: string }[]>`select table_name || '.' || column_name c from information_schema.column_privileges
      where grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
        and column_name in ('number', 'created_by', 'expected_revenue', 'first_response_at', 'converted_deal_id', 'organization_id')
        and privilege_type = 'UPDATE'`;
    expect(cols).toHaveLength(0);
  });

  it("anon には何も許可しない。すべての表で RLS が有効", async () => {
    const [{ n }] = await sql`select count(*)::int n from information_schema.role_table_grants where grantee = 'anon'`;
    expect(n).toBe(0);
    const noRls = await sql`select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(noRls).toHaveLength(0);
  });

  it("authenticated が呼べる関数", async () => {
    const rows = await sql<{ f: string }[]>`select s.nspname || '.' || p.proname as f from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname in ('public', 'app_private', 'app_auth') and has_function_privilege('authenticated', p.oid, 'execute') order by 1`;
    expect(rows.map((r) => r.f)).toEqual([
      // トリガー関数（呼び出し元の権限で動くもの）
      "app_private.activity_user", "app_private.bulk_loading", "app_private.enforce_member_owner", "app_private.keep_one_admin",
      "app_private.set_created_by", "app_private.task_completed_at", "app_private.touch_updated_at",
      "public.admin_add_member", "public.convert_inquiry", "public.current_org_id", "public.current_org_role", "public.is_org_manager", "public.org_today",
    ]);
  });
});
