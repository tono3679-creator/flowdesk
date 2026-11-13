import { describe, expect, it } from "vitest";
import { generateDemoData } from "@/lib/demo/generator";
import { expectedRevenue } from "@/lib/domain/money";
import { addDays, toLocalDate } from "@/lib/domain/dates";

const NOW = new Date("2026-11-13T10:00:00+09:00");
const ORG = "00000000-0000-4000-8000-000000000001";
const make = (seed = 20261113) => generateDemoData({ seed, now: NOW, organizationId: ORG, mode: { kind: "showcase", passwordHash: "x" } });

describe("デモデータ（株式会社NextWorks）", () => {
  const d = make();
  const today = toLocalDate(NOW, "Asia/Tokyo");

  it("同じシードなら同じデータになる", () => {
    const again = make();
    expect(again.inquiries.map((i) => [i.id, i.title, i.received_at.getTime()])).toEqual(d.inquiries.map((i) => [i.id, i.title, i.received_at.getTime()]));
    expect(again.deals.map((x) => x.estimated_amount)).toEqual(d.deals.map((x) => x.estimated_amount));
  });

  it("仕様の件数を満たす", () => {
    expect(d.profiles.length).toBe(8);
    expect(d.customers.length).toBeGreaterThanOrEqual(50);
    expect(d.inquiries.length).toBeGreaterThanOrEqual(100);
    expect(d.deals.length).toBeGreaterThanOrEqual(40);
    expect(d.tasks.length).toBeGreaterThanOrEqual(80);
    expect(d.activities.length).toBeGreaterThanOrEqual(150);
    expect(d.stages.length).toBe(10);
  });

  it("アラートの見どころ：期限超過タスク7件・24時間以上の未対応がある", () => {
    const overdue = d.tasks.filter((t) => t.status !== "done" && t.due_on !== null && t.due_on < today);
    expect(overdue.length).toBe(7);
    const late = d.inquiries.filter((i) => i.status === "new" && NOW.getTime() - i.received_at.getTime() > 24 * 3600_000);
    expect(late.length).toBeGreaterThan(0);
    // 一般担当者（鈴木）にも見せ場がある
    expect(overdue.some((t) => t.assignee_id === d.staff.member)).toBe(true);
  });

  it("未来の日時を作らない", () => {
    expect(d.inquiries.every((i) => i.received_at.getTime() <= NOW.getTime())).toBe(true);
    expect(d.activities.every((a) => a.occurred_at.getTime() <= NOW.getTime())).toBe(true);
    expect(d.deals.every((x) => !x.closed_on || x.closed_on <= today)).toBe(true);
  });

  it("関連の整合性：案件化した問い合わせと案件・受注と売上・確度", () => {
    const deals = new Map(d.deals.map((x) => [x.id, x]));
    const stages = new Map(d.stages.map((s) => [s.id, s]));
    for (const i of d.inquiries.filter((x) => x.status === "converted")) {
      expect(deals.get(i.converted_deal_id!)?.inquiry_id).toBe(i.id);
    }
    const won = d.deals.filter((x) => ["won", "completed"].includes(stages.get(x.stage_id)!.category));
    expect(new Set(d.sales.map((s) => s.deal_id))).toEqual(new Set(won.map((x) => x.id)));
    for (const x of d.deals) {
      const cat = stages.get(x.stage_id)!.category;
      if (cat === "won" || cat === "completed") expect(x.probability).toBe(100);
      if (cat === "lost") expect(x.probability).toBe(0);
      expect(expectedRevenue(x.estimated_amount, x.probability)).toBeGreaterThanOrEqual(0);
    }
  });

  it("半年分の期間に収まる", () => {
    const oldest = d.inquiries.reduce((m, i) => Math.min(m, i.received_at.getTime()), Infinity);
    expect(toLocalDate(new Date(oldest), "Asia/Tokyo") >= addDays(today, -190)).toBe(true);
  });
});
