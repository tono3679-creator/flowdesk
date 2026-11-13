"use server";
import { revalidatePath } from "next/cache";
import { asCurrentUser } from "@/lib/auth";
import { activitySchema, type ActivityInput } from "@/lib/validation";
import { run, uuidSchema, validate } from "./helpers";
import type { ActionResult } from "./result";

/**
 * 対応履歴を登録する。登録すると DB のトリガーが、顧客・案件の最終接触日、問い合わせの初回対応日時（未対応→対応中）、
 * 次回対応日、見積提出日を自動で更新する。
 */
export async function createActivity(input: ActivityInput): Promise<ActionResult<{ id: string }>> {
  const v = validate(activitySchema, input);
  if (!v.ok) return v.result;
  const d = v.data;
  const r = await run(() => asCurrentUser(async (tx, user) => {
    const [row] = await tx<{ id: string }[]>`
      insert into activities ${tx({
        organization_id: user.organizationId, customer_id: d.customer_id, inquiry_id: d.inquiry_id, deal_id: d.deal_id, user_id: user.userId,
        activity_type: d.activity_type, occurred_at: d.occurred_at, content: d.content, result: d.result, next_action_on: d.next_action_on, memo: d.memo,
      })} returning id`;
    return row.id;
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true, data: { id: r.value } };
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    const [row] = await tx`delete from activities where id = ${id} returning id`;
    if (!row) throw Object.assign(new Error("削除できるのは自分の記録か、マネージャー以上です"), { code: "42501" });
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}
