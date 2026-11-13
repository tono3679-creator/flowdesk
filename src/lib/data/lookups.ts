import "server-only";
import { cache } from "react";
import { asCurrentUser } from "@/lib/auth";
import type { OrgRole, StageCategory, TagColor } from "@/lib/domain/labels";

export type Member = { id: string; name: string; title: string | null; role: OrgRole; isActive: boolean };
export type Stage = {
  id: string; name: string; category: StageCategory; defaultProbability: number; boardColumn: string | null;
  marksQuoteSubmitted: boolean; sortOrder: number; isActive: boolean;
};
export type Source = { id: string; name: string; sortOrder: number; isActive: boolean };
export type Tag = { id: string; name: string; color: TagColor; sortOrder: number };
export type Lookups = { members: Member[]; stages: Stage[]; sources: Source[]; tags: Tag[] };

/** 担当者・ステータス・経路・タグ（1回の表示で1回だけ読む） */
export const getLookups = cache(async (): Promise<Lookups> => asCurrentUser(async (tx) => {
  const [members, stages, sources, tags] = await Promise.all([
    tx<Member[]>`
      select m.user_id id, p.display_name "name", p.title, m.role, m.is_active "isActive"
        from organization_members m join profiles p on p.id = m.user_id
       order by case m.role when 'admin' then 0 when 'manager' then 1 else 2 end, m.created_at`,
    tx<Stage[]>`
      select id, name, category, default_probability "defaultProbability", board_column "boardColumn",
             marks_quote_submitted "marksQuoteSubmitted", sort_order "sortOrder", is_active "isActive"
        from pipeline_stages order by sort_order, created_at`,
    tx<Source[]>`select id, name, sort_order "sortOrder", is_active "isActive" from inquiry_sources order by sort_order, created_at`,
    tx<Tag[]>`select id, name, color, sort_order "sortOrder" from customer_tags order by sort_order, created_at`,
  ]);
  return { members: [...members], stages: [...stages], sources: [...sources], tags: [...tags] };
}));

export function memberName(lookups: Lookups, id: string | null | undefined): string {
  if (!id) return "未割当";
  return lookups.members.find((m) => m.id === id)?.name ?? "（退職したメンバー）";
}
