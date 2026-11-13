"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";
import { dealSchema, type DealInput } from "@/lib/validation";
import { run, uuidSchema, validate } from "./helpers";
import type { ActionResult } from "./result";

/**
 * 案件の登録・編集。確度・受注日・失注日・見積提出日・売上は DB のトリガーがステータスに合わせて整える
 * （手動で確度を決めた案件は、ステータスが変わっても確度を保つ。受注は100%・失注は0%）。
 */
export async function saveDeal(id: string | null, input: DealInput, expectedUpdatedAt?: string): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const v = validate(dealSchema, input);
  if (!v.ok) return v.result;
  const d = v.data;
  const r = await run(() => asCurrentUser(async (tx, user) => {
    const [stage] = await tx<{ category: string }[]>`select category from pipeline_stages where id = ${d.stage_id}`;
    if (!stage) throw Object.assign(new Error("ステータスが見つかりません"), { code: "23503" });
    if (stage.category === "lost" && !d.lost_reason) {
      throw Object.assign(new Error("失注にするときは失注理由を選んでください"), { code: "23514" });
    }
    const values = { ...d };
    if (id === null) {
      const [row] = await tx<{ id: string }[]>`insert into deals ${tx({ ...values, organization_id: user.organizationId })} returning id`;
      return row.id;
    }
    // 同時編集の確認：開いたあとに誰かが保存していたら上書きしない
    const [row] = await tx<{ id: string }[]>`
      update deals set ${tx(values)}
       where id = ${id} ${expectedUpdatedAt ? tx`and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', ${new Date(expectedUpdatedAt)}::timestamptz)` : tx``}
      returning id`;
    if (!row) {
      const [exists] = await tx`select 1 from deals where id = ${id}`;
      if (exists && expectedUpdatedAt) throw Object.assign(new Error("ほかのメンバーがこの案件を更新しました。画面を読み込み直してから編集してください"), { code: "40001" });
      throw Object.assign(new Error("この案件を編集する権限がありません"), { code: "42501" });
    }
    return row.id;
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true, data: { id: r.value } };
}

/** Kanban のドラッグ＆ドロップでステータスを変える（DB に保存） */
export async function moveDealStage(dealId: string, stageId: string, lostReason?: string | null): Promise<ActionResult<{ probability: number }>> {
  const parsed = z.object({ dealId: z.uuid(), stageId: z.uuid(), lostReason: z.string().trim().max(50).nullish() }).safeParse({ dealId, stageId, lostReason });
  if (!parsed.success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    const [stage] = await tx<{ category: string }[]>`select category from pipeline_stages where id = ${stageId} and is_active`;
    if (!stage) throw Object.assign(new Error("ステータスが見つかりません"), { code: "23503" });
    if (stage.category === "lost" && !parsed.data.lostReason) {
      throw Object.assign(new Error("失注にするときは失注理由を選んでください"), { code: "23514" });
    }
    const [row] = await tx<{ probability: number }[]>`
      update deals set stage_id = ${stageId}, lost_reason = ${stage.category === "lost" ? (parsed.data.lostReason ?? null) : null}
       where id = ${dealId} returning probability`;
    if (!row) throw Object.assign(new Error("この案件を変更する権限がありません"), { code: "42501" });
    return row.probability;
  }), "ステータスを保存できませんでした。時間をおいて再度お試しください");
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true, data: { probability: r.value } };
}

export async function deleteDeal(id: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    // 元の問い合わせは DB のトリガーが「対応中」に戻す（案件化の取り消し）
    const [row] = await tx`delete from deals where id = ${id} returning id`;
    if (!row) throw Object.assign(new Error("削除できるのはマネージャー以上です"), { code: "42501" });
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}
