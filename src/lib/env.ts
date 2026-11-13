import "server-only";

/** サーバー専用の環境変数。足りなければ使うときに分かるようにする。 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が設定されていません（.env.example を参照）`);
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const serverEnv = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  /** 同時に存在できるデモ組織の上限（1組織あたり約 2MB） */
  get demoMaxActive() {
    return positiveInt("DEMO_MAX_ACTIVE", 40);
  },
  /** 同じ接続元から1時間に作れるデモ環境の数（大量作成の対策） */
  get demoCreateLimitPerHour() {
    return positiveInt("DEMO_CREATE_LIMIT_PER_HOUR", 30);
  },
};
