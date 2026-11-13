"use server";
import { z } from "zod";
import { asCurrentUser } from "@/lib/auth";

export type PickerKind = "customer" | "deal" | "inquiry";
export type PickerItem = { id: string; label: string; sub: string | null };

const schema = z.object({ kind: z.enum(["customer", "deal", "inquiry"]), q: z.string().max(100) });

/** 顧客・案件・問い合わせを名前で探す（入力欄の候補。RLS で見られるものだけ） */
export async function searchPicker(kind: PickerKind, q: string): Promise<PickerItem[]> {
  const parsed = schema.safeParse({ kind, q });
  if (!parsed.success) return [];
  const like = `%${parsed.data.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return asCurrentUser(async (tx) => {
    if (kind === "customer") {
      return [...await tx<PickerItem[]>`
        select id, coalesce(company_name, name) label,
               concat_ws('・', case when company_name is not null then name end, phone, email) sub
          from customers
         where coalesce(company_name, '') || ' ' || coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') ilike ${like}
         order by updated_at desc limit 12`];
    }
    if (kind === "deal") {
      return [...await tx<PickerItem[]>`
        select d.id, d.title label, coalesce(c.company_name, c.name) sub
          from deals d join customers c on c.id = d.customer_id
         where d.title || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.name, '') ilike ${like}
         order by d.updated_at desc limit 12`];
    }
    return [...await tx<PickerItem[]>`
      select i.id, i.title label, coalesce(i.company_name, i.contact_name) sub
        from inquiries i
       where i.title || ' ' || coalesce(i.company_name, '') || ' ' || coalesce(i.contact_name, '') ilike ${like}
       order by i.received_at desc limit 12`];
  });
}
