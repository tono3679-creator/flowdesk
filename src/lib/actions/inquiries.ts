"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";
import { EDITABLE_INQUIRY_STATUSES } from "@/lib/domain/labels";
import { convertSchema, inquirySchema, type InquiryInput } from "@/lib/validation";
import { run, uuidSchema, validate } from "./helpers";
import type { ActionResult } from "./result";

/** 問い合わせの登録・編集。「顧客として登録」にチェックがあれば、連絡先から顧客も作って紐づける */
export async function saveInquiry(id: string | null, input: InquiryInput): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const v = validate(inquirySchema, input);
  if (!v.ok) return v.result;
  const d = v.data;
  const r = await run(() => asCurrentUser(async (tx, user) => {
    let customerId = d.customer_id;
    if (!customerId && d.create_customer) {
      const [c] = await tx<{ id: string }[]>`
        insert into customers (organization_id, type, company_name, name, phone, email, owner_id)
        values (${user.organizationId}, ${d.company_name ? "corporate" : "individual"}, ${d.company_name}, ${d.contact_name}, ${d.phone}, ${d.email}, ${d.owner_id})
        returning id`;
      customerId = c.id;
    }
    const values = {
      customer_id: customerId, received_at: d.received_at, source_id: d.source_id, category: d.category, title: d.title, content: d.content,
      contact_name: d.contact_name, company_name: d.company_name, phone: d.phone, email: d.email, owner_id: d.owner_id, priority: d.priority,
      next_action_on: d.next_action_on, memo: d.memo,
    };
    if (id === null) {
      const [row] = await tx<{ id: string }[]>`
        insert into inquiries ${tx({ ...values, organization_id: user.organizationId, status: d.status })} returning id`;
      return row.id;
    }
    // 案件化済みの問い合わせは、ステータスを変えない（案件化の取り消しは案件側で行う）
    const [row] = await tx<{ id: string }[]>`
      update inquiries set ${tx(values)}, status = case when status = 'converted' then status else ${d.status}::inquiry_status end
       where id = ${id} returning id`;
    if (!row) throw Object.assign(new Error("この問い合わせを編集する権限がありません"), { code: "42501" });
    return row.id;
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true, data: { id: r.value } };
}

/** 一覧・詳細からステータスだけを変える */
export async function setInquiryStatus(id: string, status: (typeof EDITABLE_INQUIRY_STATUSES)[number]): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid(), status: z.enum(EDITABLE_INQUIRY_STATUSES) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    const [row] = await tx`update inquiries set status = ${status} where id = ${id} and status <> 'converted' returning id`;
    if (!row) throw Object.assign(new Error("ステータスを変更できませんでした（案件化済み、または権限がありません）"), { code: "42501" });
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 担当者を自分にする（未割当の問い合わせを引き受ける） */
export async function takeInquiry(id: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx, user) => {
    const [row] = await tx`update inquiries set owner_id = ${user.userId} where id = ${id} and owner_id is null returning id`;
    if (!row) throw Object.assign(new Error("ほかのメンバーが先に担当になりました"), { code: "40001" });
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 問い合わせを案件化する（顧客・内容・担当者・対応履歴を引き継ぐ。DB の convert_inquiry） */
export async function convertInquiry(id: string, input: z.input<typeof convertSchema>): Promise<ActionResult<{ dealId: string }>> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const v = validate(convertSchema, input);
  if (!v.ok) return v.result;
  const r = await run(() => asCurrentUser(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      select public.convert_inquiry(${id}, ${v.data.title}, ${v.data.estimated_amount}, ${v.data.deal_type}, ${v.data.create_task}) id`;
    return row.id;
  }), "案件化に失敗しました。時間をおいて再度お試しください");
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true, data: { dealId: r.value } };
}

/** 既存の顧客に紐づける */
export async function linkInquiryCustomer(id: string, customerId: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(customerId).success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    const [row] = await tx`update inquiries set customer_id = ${customerId} where id = ${id} returning id`;
    if (!row) throw Object.assign(new Error("この問い合わせを編集する権限がありません"), { code: "42501" });
    await tx`update activities set customer_id = ${customerId} where inquiry_id = ${id} and customer_id is null`;
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteInquiry(id: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    const [row] = await tx`delete from inquiries where id = ${id} returning id`;
    if (!row) throw Object.assign(new Error("削除できるのはマネージャー以上です"), { code: "42501" });
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}
