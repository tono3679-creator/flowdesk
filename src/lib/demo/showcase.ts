/**
 * 見本の組織（メールアドレスとパスワードでログインする「株式会社NextWorks」）を作り直す。
 * Seed（npm run db:seed）・公開時のビルド・毎日の定期処理から使う（データが常に「今」から過去6か月分になるように）。
 */
import type { Sql } from "postgres";
import { hashPassword } from "../password";
import { DEFAULT_DEMO_SEED, generateDemoData } from "./generator";
import { loadDataset } from "./load";
import { STAFF } from "./master-data";

export async function seedShowcase(sql: Sql, opts: { password: string; now?: Date; log?: (s: string) => void }) {
  const log = opts.log ?? console.log;
  const emails = STAFF.map((s) => s.email);
  const data = generateDemoData({
    seed: DEFAULT_DEMO_SEED, now: opts.now ?? new Date(), organizationId: crypto.randomUUID(),
    mode: { kind: "showcase", passwordHash: await hashPassword(opts.password) },
  });
  await loadDataset(sql, data, async (tx) => {
    // 前の見本の組織と、そのログイン用の利用者を消す
    await tx`delete from public.organizations where is_showcase`;
    await tx`delete from app_auth.users where lower(email) = any(${emails}::text[])`;
  });
  log(`見本の組織を作り直しました（顧客 ${data.customers.length}・問い合わせ ${data.inquiries.length}・案件 ${data.deals.length}・タスク ${data.tasks.length}・対応履歴 ${data.activities.length}）`);
}
