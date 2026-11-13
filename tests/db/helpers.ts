import postgres, { type Sql, type TransactionSql } from "postgres";
import { randomUUID } from "node:crypto";
import { generateDemoData, type DemoDataset } from "@/lib/demo/generator";
import { loadDataset } from "@/lib/demo/load";
import { DB_TYPES } from "@/lib/db/types";
import { runAsUser } from "@/lib/db/rls";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/flowdesk";

export function connect(): Sql {
  return postgres(TEST_DATABASE_URL, { max: 4, prepare: false, onnotice: () => {}, types: DB_TYPES });
}

export type TestTenant = { orgId: string; data: DemoDataset; staff: DemoDataset["staff"] };

/** テスト用の組織を1つ作る（デモと同じ株式会社NextWorks のデータ。利用者は admin / manager / member ほか） */
export async function createTenant(sql: Sql, seed = 7, now = new Date()): Promise<TestTenant> {
  const orgId = randomUUID();
  const data = generateDemoData({ seed, now, organizationId: orgId, mode: { kind: "demo", expiresAt: new Date(Date.now() + 3600_000) } });
  await loadDataset(sql, data);
  return { orgId, data, staff: data.staff };
}

export async function dropTenant(sql: Sql, t: TestTenant) {
  await sql`delete from public.organizations where id = ${t.orgId}`;
  await sql`delete from app_auth.users where id in ${sql(Object.values(t.staff))}`;
}

/** その組織の利用者として実行する（RLS が効く） */
export function as<T>(sql: Sql, t: TestTenant, userId: string, fn: (tx: TransactionSql) => Promise<T>) {
  return runAsUser(sql, userId, fn, t.orgId);
}

/** 例外のメッセージ（失敗しなかったら null） */
export async function errorOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
