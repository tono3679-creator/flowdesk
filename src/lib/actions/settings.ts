"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";
import { ORG_ROLES } from "@/lib/domain/labels";
import { hashPassword } from "@/lib/password";
import { memberSchema, settingsSchema, sourcesSchema, stagesSchema, tagsSchema, type SettingsInput } from "@/lib/validation";
import { run, uuidSchema, validate } from "./helpers";
import type { ActionResult } from "./result";

const denied = () => Object.assign(new Error("設定を変更できるのは管理者だけです"), { code: "42501" });

/** 会社情報・アラート条件・種別・優先度の表示名 */
export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  const v = validate(settingsSchema, input);
  if (!v.ok) return v.result;
  const d = v.data;
  const r = await run(() => asCurrentUser(async (tx, user) => {
    if (user.role !== "admin") throw denied();
    await tx`update organizations set name = ${d.company_name} where id = ${user.organizationId}`;
    const [row] = await tx`
      update organization_settings set ${tx({
        industry: d.industry, timezone: d.timezone, unanswered_hours: d.unanswered_hours, quote_follow_days: d.quote_follow_days,
        no_contact_days: d.no_contact_days, first_response_target_hours: d.first_response_target_hours, inquiry_categories: d.inquiry_categories,
        deal_types: d.deal_types, auto_tasks: d.auto_tasks,
      })}, priority_labels = ${tx.json(d.priority_labels)}
       where organization_id = ${user.organizationId} returning organization_id`;
    if (!row) throw denied();
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * 一覧の設定（ステータス・経路・タグ）を、並び順も含めてまとめて保存する。
 * 画面から消したものは削除する。使われているものは削除できないので「無効」にするよう案内する。
 */
async function saveList(table: "pipeline_stages" | "inquiry_sources" | "customer_tags", rows: Record<string, unknown>[], usedBy: string | null): Promise<void> {
  await asCurrentUser(async (tx, user) => {
    if (user.role !== "admin") throw denied();
    const keep = rows.map((r) => r.id).filter((id): id is string => typeof id === "string");
    const removed = await tx<{ id: string; name: string }[]>`select id, name from ${tx(table)} where not (id = any(${keep}::uuid[]))`;
    for (const x of removed) {
      if (usedBy) {
        const [used] = await tx.unsafe(`select 1 from public.${usedBy} where ${table === "pipeline_stages" ? "stage_id" : "source_id"} = $1 limit 1`, [x.id]);
        if (used) throw Object.assign(new Error(`「${x.name}」は使われているため削除できません。無効にしてください`), { code: "23503" });
      }
    }
    if (removed.length > 0) await tx`delete from ${tx(table)} where id = any(${removed.map((x) => x.id)}::uuid[])`;
    // 名前の入れ替えで一意制約にかからないよう、いったん仮の名前にする
    if (keep.length > 0) await tx`update ${tx(table)} set name = '__tmp_' || id::text where id = any(${keep}::uuid[])`;
    for (const [i, row] of rows.entries()) {
      const { id, ...values } = row;
      if (id) await tx`update ${tx(table)} set ${tx({ ...values, sort_order: i })} where id = ${id as string}`;
      else await tx`insert into ${tx(table)} ${tx({ ...values, sort_order: i, organization_id: user.organizationId })}`;
    }
  });
}

export async function saveStages(input: z.input<typeof stagesSchema>): Promise<ActionResult> {
  const v = validate(stagesSchema, input);
  if (!v.ok) return v.result;
  const r = await run(() => saveList("pipeline_stages", v.data.map((s) => ({
    id: s.id, name: s.name, category: s.category, default_probability: s.category === "won" || s.category === "completed" ? 100 : s.category === "lost" ? 0 : s.default_probability,
    board_column: s.board_column, marks_quote_submitted: s.marks_quote_submitted, is_active: s.is_active,
  })), "deals"));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveSources(input: z.input<typeof sourcesSchema>): Promise<ActionResult> {
  const v = validate(sourcesSchema, input);
  if (!v.ok) return v.result;
  const r = await run(() => saveList("inquiry_sources", v.data.map((s) => ({ id: s.id, name: s.name, is_active: s.is_active })), "inquiries"));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveTags(input: z.input<typeof tagsSchema>): Promise<ActionResult> {
  const v = validate(tagsSchema, input);
  if (!v.ok) return v.result;
  const r = await run(() => saveList("customer_tags", v.data.map((s) => ({ id: s.id, name: s.name, color: s.color })), null));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

/** メンバーの追加（管理者。デモ環境では DB 側で断る） */
export async function addMember(input: z.input<typeof memberSchema>): Promise<ActionResult> {
  const v = validate(memberSchema, input);
  if (!v.ok) return v.result;
  const d = v.data;
  const r = await run(async () => {
    const hash = await hashPassword(d.password);
    await asCurrentUser(async (tx) => {
      await tx`select public.admin_add_member(${d.email}, ${d.display_name}, ${d.title ?? ""}, ${d.role}, ${hash})`;
    });
  });
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 役割の変更・利用停止（管理者が1人もいなくなる変更は DB が断る） */
export async function updateMember(userId: string, role: (typeof ORG_ROLES)[number], isActive: boolean): Promise<ActionResult> {
  const parsed = z.object({ userId: uuidSchema, role: z.enum(ORG_ROLES), isActive: z.boolean() }).safeParse({ userId, role, isActive });
  if (!parsed.success) return { ok: false, error: "不正な操作です" };
  const r = await run(() => asCurrentUser(async (tx, user) => {
    if (user.role !== "admin") throw denied();
    if (user.isDemo) throw Object.assign(new Error("デモ環境ではメンバーの役割を変更できません。画面上部の「役割を切り替え」をお使いください"), { code: "42501" });
    const [row] = await tx`update organization_members set role = ${role}, is_active = ${isActive} where user_id = ${userId} returning user_id`;
    if (!row) throw denied();
  }));
  if (!r.ok) return r.result;
  revalidatePath("/", "layout");
  return { ok: true };
}
