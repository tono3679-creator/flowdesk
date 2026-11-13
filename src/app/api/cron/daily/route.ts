import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { seedShowcase } from "@/lib/demo/showcase";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret = serverEnv.cronSecret;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * 毎日の定期処理（Vercel Cron。vercel.json）
 *   1. 期限切れのデモ組織・セッション・回数の記録を片付ける
 *   2. 見本の組織を「今日」基準で作り直す（SEED_LOGIN_PASSWORD があるときだけ。データが古くならないように）
 *   （アラートは保存しないので、定期処理で作り直す必要はない。表示のたびに現在のデータから計算する）
 */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const sql = db();
  const [c] = await sql<{ n: number }[]>`select app_private.demo_cleanup() n`;
  const password = process.env.SEED_LOGIN_PASSWORD;
  if (password && password.length >= 12) await seedShowcase(sql, { password, log: () => {} });
  return Response.json({ ok: true, demoDeleted: c.n, showcaseRefreshed: !!password });
}
