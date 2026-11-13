/**
 * 見本の組織「株式会社NextWorks」（メールアドレスとパスワードでログインする）を作り直す。
 *   npm run db:seed
 * 公開環境ではビルドのたびに自動で実行する（scripts/deploy/vercel-build.ts）。データは実行した時点の「今」から過去6か月分。
 * ログイン：admin@ / manager@ / member@flowdesk.example ほか（パスワードは SEED_LOGIN_PASSWORD。ローカルの既定は README）
 */
import path from "node:path";
import postgres from "postgres";
import { seedShowcase } from "../../src/lib/demo/showcase";
import { toPostgresJsUrl } from "../../src/lib/db/url";

export { seedShowcase };

/** ローカル用の既定のパスワード（公開環境では使えない。scripts/deploy/production-env.ts） */
export const LOCAL_DEFAULT_PASSWORD = "flowdesk-demo-2026";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL を設定してください");
  const sql = postgres(toPostgresJsUrl(url), { max: 1, prepare: false, onnotice: () => {} });
  try {
    await seedShowcase(sql, { password: process.env.SEED_LOGIN_PASSWORD || LOCAL_DEFAULT_PASSWORD });
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
