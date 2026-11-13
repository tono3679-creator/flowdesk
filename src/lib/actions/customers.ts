"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";
import { splitTags, type ImportRowInput } from "@/lib/domain/csv";
import { checkImportRows, toCustomerInput, type ImportRowResult } from "@/lib/customer-import";
import { customerSchema, type CustomerInput } from "@/lib/validation";
import { run, uuidSchema, validate } from "./helpers";
import type { ActionResult } from "./result";

export async function saveCustomer(id: string | null, input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const v = validate(customerSchema, input);
  if (!v.ok) return v.result;
  const { tag_ids: tagIds, ...d } = v.data;
  const r = await run(() => asCurrentUser(async (tx, user) => {
    const values = { ...d, company_name: d.type === "corporate" ? d.company_name : d.company_name ?? null };
    let customerId: string;
    if (id === null) {
      const [row] = await tx<{ id: string }[]>`insert into customers ${tx({ ...values, organization_id: user.organizationId })} returning id`;
      customerId = row.id;
    } else {
      const [row] = await tx<{ id: string }[]>`update customers set ${tx(values)} where id = ${id} returning id`;
      if (!row) throw Object.assign(new Error("この顧客を編集する権限がありません（担当者かマネージャー以上が編集できます）"), { code: "42501" });
      customerId = row.id;
      await tx`delete from customer_tag_relations where customer_id = ${customerId} and not (tag_id = any(${tagIds}::uuid[]))`;
    }
    if (tagIds.length > 0) {
      await tx`
        insert into customer_tag_relations (organization_id, customer_id, tag_id)
        select ${user.organizationId}, ${customerId}, t from unnest(${tagIds}::uuid[]) t
        on conflict do nothing`;
    }
    return customerId;
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true, data: { id: r.value } };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx) => {
    const [deal] = await tx`select 1 from deals where customer_id = ${id} limit 1`;
    if (deal) throw Object.assign(new Error("案件がある顧客は削除できません。先に案件を削除してください"), { code: "23503" });
    const [row] = await tx`delete from customers where id = ${id} returning id`;
    if (!row) throw Object.assign(new Error("削除できるのはマネージャー以上です"), { code: "42501" });
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------
// CSV の取り込み
// ---------------------------------------------------------------
const MAX_IMPORT_ROWS = 1000;

const importSchema = z.array(z.record(z.string(), z.string().max(5000))).min(1, "取り込む行がありません").max(MAX_IMPORT_ROWS, `一度に取り込めるのは${MAX_IMPORT_ROWS}行までです`);

/** 顧客を CSV から一括登録する。エラーの無い行だけを登録し、1行でも DB で失敗したら全体を取り消す */
export async function importCustomers(rows: ImportRowInput[]): Promise<ActionResult<{ imported: number; skipped: number; results: ImportRowResult[] }>> {
  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "取り込む内容を確認してください" };
  const r = await run(() => asCurrentUser(async (tx, user) => {
    if (!user.isManager) throw Object.assign(new Error("CSV の取り込みは管理者・マネージャーが行えます"), { code: "42501" });
    const existing = await tx<{ email: string }[]>`select lower(email) email from customers where email is not null`;
    const results = checkImportRows(rows, new Set(existing.map((e) => e.email)));
    const tags = await tx<{ id: string; name: string }[]>`select id, name from customer_tags`;
    const tagId = new Map(tags.map((t) => [t.name, t.id]));
    let imported = 0;
    for (let i = 0; i < rows.length; i++) {
      if (!results[i].ok) continue;
      const { input } = toCustomerInput(rows[i]);
      const d = customerSchema.parse(input);
      const values = { type: d.type, company_name: d.company_name, name: d.name, department: d.department, position: d.position, phone: d.phone, email: d.email, address: d.address, rank: d.rank, memo: d.memo };
      const [c] = await tx<{ id: string }[]>`insert into customers ${tx({ ...values, owner_id: null, organization_id: user.organizationId })} returning id`;
      for (const name of splitTags(rows[i].tags)) {
        let id = tagId.get(name);
        if (!id && user.role === "admin" && name.length <= 20) {
          const [t] = await tx<{ id: string }[]>`insert into customer_tags (organization_id, name) values (${user.organizationId}, ${name}) returning id`;
          id = t.id;
          tagId.set(name, id);
        }
        if (id) await tx`insert into customer_tag_relations (organization_id, customer_id, tag_id) values (${user.organizationId}, ${c.id}, ${id}) on conflict do nothing`;
      }
      imported++;
    }
    return { imported, skipped: rows.length - imported, results };
  }), "取り込みに失敗しました。内容を確認して再度お試しください");
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true, data: r.value };
}
