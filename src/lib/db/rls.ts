import type { Sql, TransactionSql } from "postgres";

/**
 * ログインユーザーとして SQL を実行する。
 * トランザクションの中でロールを authenticated に切り替え、JWT の内容（sub）を設定するので、
 * RLS と auth.uid() がその利用者の権限で効く（アプリの処理は必ずここを通して DB を読み書きする）。
 * organizationId を渡すと、その組織として操作する（所属していない組織なら current_org_id() が null になり何も見えない）。
 */
export async function runAsUser<T>(
  sql: Sql,
  userId: string,
  fn: (tx: TransactionSql) => Promise<T>,
  organizationId?: string | null,
): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated", ...(organizationId ? { org_id: organizationId } : {}) });
  const result = await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true)`;
    return fn(tx);
  });
  return result as T;
}
