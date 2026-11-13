"use server";
import { revalidatePath } from "next/cache";
import { asCurrentUser } from "@/lib/auth";
import { taskSchema, type TaskInput } from "@/lib/validation";
import { run, uuidSchema, validate } from "./helpers";
import type { ActionResult } from "./result";

export async function saveTask(id: string | null, input: TaskInput): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const v = validate(taskSchema, input);
  if (!v.ok) return v.result;
  const d = v.data;
  const r = await run(() => asCurrentUser(async (tx, user) => {
    const values = {
      title: d.title, description: d.description, assignee_id: d.assignee_id, customer_id: d.customer_id, deal_id: d.deal_id, inquiry_id: d.inquiry_id,
      priority: d.priority, status: d.status, start_on: d.start_on, due_on: d.due_on, memo: d.memo,
    };
    if (id === null) {
      const [row] = await tx<{ id: string }[]>`insert into tasks ${tx({ ...values, organization_id: user.organizationId })} returning id`;
      return row.id;
    }
    const [row] = await tx<{ id: string }[]>`update tasks set ${tx(values)} where id = ${id} returning id`;
    if (!row) throw Object.assign(new Error("このタスクを編集する権限がありません"), { code: "42501" });
    return row.id;
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true, data: { id: r.value } };
}

/** 完了／未完了の切り替え（一覧のチェックボックス） */
export async function setTaskDone(id: string, done: boolean): Promise<ActionResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    const [row] = await tx`
      update tasks set status = ${done ? "done" : "todo"}::task_status where id = ${id}
       and (status = 'done') <> ${done} returning id`;
    if (!row) {
      // 既に同じ状態なら何もしない。そうでなければ権限が無い
      const [cur] = await tx<{ done: boolean }[]>`select status = 'done' done from tasks where id = ${id}`;
      if (!cur || cur.done !== done) throw Object.assign(new Error("このタスクを変更する権限がありません"), { code: "42501" });
    }
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    const [row] = await tx`delete from tasks where id = ${id} returning id`;
    if (!row) throw Object.assign(new Error("削除できるのは作成者かマネージャー以上です"), { code: "42501" });
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}
