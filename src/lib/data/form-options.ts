import "server-only";
import type { CurrentUser } from "@/lib/auth";
import type { Lookups } from "@/lib/data/lookups";

/** 問い合わせフォームに渡す選択肢 */
export function inquiryFormOptions(user: CurrentUser, lookups: Lookups) {
  return {
    members: lookups.members.map((m) => ({ id: m.id, name: m.name, isActive: m.isActive })),
    sources: lookups.sources.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive })),
    categories: user.settings.inquiryCategories,
    priorityLabels: user.settings.priorityLabels,
    currentUserId: user.userId,
    role: user.role,
  };
}
