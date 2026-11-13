import "server-only";
import type { TransactionSql } from "postgres";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { DEFAULT_DEMO_SEED, generateDemoData } from "./generator";
import { loadDataset } from "./load";

export const DEMO_TTL_HOURS = 24;
export type DemoPersona = "admin" | "manager" | "member";
export const DEMO_PERSONAS: DemoPersona[] = ["admin", "manager", "member"];

/** デモ組織が上限まで作られているときのエラー（利用者向けの文言で知らせる） */
export class DemoCapacityError extends Error {
  constructor() {
    super("デモ環境の上限に達しています");
    this.name = "DemoCapacityError";
  }
}

/** 新しいデモ組織を作れるか。上限に達していたら期限切れのデモを片付けてから数え直す */
export async function ensureDemoCapacity(): Promise<void> {
  const sql = db();
  const count = async () => {
    const [row] = await sql<{ n: number }[]>`select count(*)::int n from organizations where is_demo and demo_expires_at > now()`;
    return row.n;
  };
  if ((await count()) < serverEnv.demoMaxActive) return;
  await sql`select app_private.demo_cleanup()`;
  if ((await count()) >= serverEnv.demoMaxActive) throw new DemoCapacityError();
}

async function deleteDemoOrg(tx: TransactionSql, userId: string) {
  const rows = await tx<{ organization_id: string }[]>`
    select m.organization_id from organization_members m join organizations o on o.id = m.organization_id
     where m.user_id = ${userId} and o.is_demo`;
  if (!rows[0]) return;
  const users = await tx<{ user_id: string }[]>`select user_id from organization_members where organization_id = ${rows[0].organization_id}`;
  await tx`delete from organizations where id = ${rows[0].organization_id}`;
  await tx`delete from app_auth.users where id = any(${users.map((u) => u.user_id)}::uuid[]) and is_anonymous`;
}

/**
 * 訪問者専用のデモ組織（株式会社NextWorks・社員8人・過去6か月分のデータ）を作り、選んだ役割の社員の ID を返す。
 * previousUserId があれば、その利用者のデモ組織を同じトランザクションで削除する（初期化）。
 */
export async function createDemoSandbox(persona: DemoPersona, previousUserId?: string): Promise<{ userId: string; organizationId: string }> {
  const data = generateDemoData({
    seed: DEFAULT_DEMO_SEED,
    now: new Date(),
    organizationId: crypto.randomUUID(),
    mode: { kind: "demo", expiresAt: new Date(Date.now() + DEMO_TTL_HOURS * 3600_000) },
  });
  await loadDataset(db(), data, async (tx) => {
    if (previousUserId) await deleteDemoOrg(tx, previousUserId);
  });
  return { userId: data.staff[persona], organizationId: data.organizationId };
}

/** デモ組織の中で、指定した役割の社員（最初の1人） */
export async function demoColleague(organizationId: string, persona: DemoPersona): Promise<string | null> {
  const [row] = await db()<{ user_id: string }[]>`
    select m.user_id from organization_members m
      join organizations o on o.id = m.organization_id and o.is_demo and o.demo_expires_at > now()
      join app_auth.users u on u.id = m.user_id and u.is_anonymous
     where m.organization_id = ${organizationId} and m.role = ${persona}
     order by m.created_at limit 1`;
  return row?.user_id ?? null;
}

/** デモ組織とその社員をすべて削除する（デモの終了） */
export async function deleteDemoOf(userId: string): Promise<void> {
  await db().begin((tx) => deleteDemoOrg(tx, userId));
}
