/**
 * 生成したデータを DB に一括登録する（データベース所有者の接続で実行する）。
 * 自動更新のトリガー（採番・履歴・売上・最終接触日）は app_private.bulk_loading() で止め、生成した値をそのまま入れる。
 * 登録後の値がトリガーの計算と一致することは tests/db/consistency.test.ts で確かめている。
 */
import type { Sql, TransactionSql } from "postgres";
import type { DemoDataset } from "./generator";

type Row = object;
const CHUNK = 400;

async function insertRows(tx: TransactionSql, table: string, rows: Row[]) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const [schema, name] = table.includes(".") ? table.split(".") : ["public", table];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) {
        const v = (r as Record<string, unknown>)[c];
        out[c] = v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) ? tx.json(v as never) : v;
      }
      return out;
    });
    await tx`insert into ${tx(schema)}.${tx(name)} ${tx(chunk as Record<string, never>[], columns)}`;
  }
}

/** データセットを登録する。before は同じトランザクションの中で先に行う処理（古いデモの削除など） */
export async function loadDataset(sql: Sql, data: DemoDataset, before?: (tx: TransactionSql) => Promise<void>) {
  await sql.begin(async (tx) => {
    if (before) await before(tx);
    await tx`select set_config('flowdesk.bulk_load', 'on', true)`;
    await insertRows(tx, "app_auth.users", data.users);
    await insertRows(tx, "organizations", [data.organization]);
    await insertRows(tx, "organization_settings", [data.settings]);
    await insertRows(tx, "profiles", data.profiles);
    await insertRows(tx, "organization_members", data.members);
    await insertRows(tx, "pipeline_stages", data.stages);
    await insertRows(tx, "inquiry_sources", data.sources);
    await insertRows(tx, "customer_tags", data.tags);
    await insertRows(tx, "customers", data.customers);
    await insertRows(tx, "customer_tag_relations", data.tagRelations);
    // 問い合わせ → 案件 → 問い合わせの案件化（相互に参照するので2段階）
    await insertRows(tx, "inquiries", data.inquiries.map((i) => ({ ...i, status: i.status === "converted" ? "in_progress" : i.status, converted_deal_id: null })));
    await insertRows(tx, "deals", data.deals);
    for (const inq of data.inquiries.filter((i) => i.converted_deal_id)) {
      await tx`update public.inquiries set status = 'converted', converted_deal_id = ${inq.converted_deal_id}, updated_at = ${inq.updated_at} where id = ${inq.id}`;
    }
    await insertRows(tx, "deal_stage_history", data.history);
    await insertRows(tx, "tasks", data.tasks);
    await insertRows(tx, "activities", data.activities);
    await insertRows(tx, "sales", data.sales);
    await insertRows(tx, "app_private.counters", data.counters);
    await tx`select set_config('flowdesk.bulk_load', 'off', true)`;
  });
}
