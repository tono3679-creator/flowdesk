import { describe, expect, it } from "vitest";
import {
  averageDaysToWin, averageDealSize, averageFirstResponseMinutes, conversionRate, firstResponseMinutes, firstResponseRate, lossRate,
  lostReasonBreakdown, monthlySeries, ownerAnalysis, ratePercent, sourceAnalysis, summarize, winRate, type DealFact, type Facts, type InquiryFact,
} from "@/lib/domain/metrics";

const TZ = "Asia/Tokyo";
const at = (s: string) => new Date(s);

function inquiry(p: Partial<InquiryFact> & { receivedAt: Date }): InquiryFact {
  return { id: crypto.randomUUID(), firstResponseAt: null, status: "in_progress", sourceId: null, ownerId: null, convertedDealId: null, ...p };
}
function deal(p: Partial<DealFact>): DealFact {
  return {
    id: crypto.randomUUID(), ownerId: null, customerId: "c", inquiryId: null, stageId: "s", category: "open", estimatedAmount: 1_000_000,
    actualAmount: null, expectedRevenue: 0, closedOn: null, createdAt: at("2026-10-01T00:00:00Z"), inquiryReceivedAt: null, lostReason: null, ...p,
  };
}

describe("0件のときの率は null（画面では「—」）", () => {
  it("分母が0なら null。NaN や Infinity を出さない", () => {
    expect(ratePercent(0, 0)).toBeNull();
    expect(ratePercent(3, 0)).toBeNull();
    expect(conversionRate([])).toBeNull();
    expect(winRate(0, 0)).toBeNull();
    expect(lossRate(0, 0)).toBeNull();
    expect(averageFirstResponseMinutes([])).toBeNull();
    expect(averageDealSize([])).toBeNull();
    expect(averageDaysToWin([], TZ)).toBeNull();
  });
  it("問い合わせ0件の月の集計", () => {
    const s = summarize({ inquiries: [], deals: [], sales: [] }, { from: "2026-11-01", to: "2026-11-30" }, { tz: TZ, now: new Date(), firstResponseTargetHours: 24 });
    expect(s).toMatchObject({ inquiries: 0, conversionRate: null, winRate: null, lossRate: null, wonAmount: 0, avgFirstResponseMinutes: null, firstResponseRate: null });
  });
});

describe("案件化率", () => {
  it("案件化した件数 ÷ 問い合わせ件数", () => {
    const list = [
      inquiry({ receivedAt: at("2026-11-01T00:00:00Z"), status: "converted", convertedDealId: "d1" }),
      inquiry({ receivedAt: at("2026-11-02T00:00:00Z") }),
      inquiry({ receivedAt: at("2026-11-03T00:00:00Z") }),
      inquiry({ receivedAt: at("2026-11-04T00:00:00Z"), status: "not_needed" }),
    ];
    expect(conversionRate(list)).toBe(25);
  });
});

describe("受注率・失注率", () => {
  it("受注 ÷（受注＋失注）。進行中は数えない", () => {
    expect(winRate(3, 1)).toBe(75);
    expect(lossRate(3, 1)).toBe(25);
    expect(winRate(0, 4)).toBe(0);
    expect(winRate(2, 0)).toBe(100);
  });
  it("期間は受注日・失注日で判定し、受注＋完了を受注として数える", () => {
    const facts: Facts = {
      inquiries: [],
      deals: [
        deal({ category: "won", closedOn: "2026-11-05", actualAmount: 500_000 }),
        deal({ category: "completed", closedOn: "2026-11-30", actualAmount: null, estimatedAmount: 300_000 }),
        deal({ category: "lost", closedOn: "2026-11-10", lostReason: "価格" }),
        deal({ category: "lost", closedOn: "2026-10-31", lostReason: "価格" }), // 期間外
        deal({ category: "open" }),
      ],
      sales: [],
    };
    const s = summarize(facts, { from: "2026-11-01", to: "2026-11-30" }, { tz: TZ, now: new Date(), firstResponseTargetHours: 24 });
    expect(s.won).toBe(2);
    expect(s.lost).toBe(1);
    expect(s.winRate).toBeCloseTo(66.666, 2);
    expect(s.wonAmount).toBe(800_000);
    expect(s.avgDealSize).toBe(400_000);
    expect(lostReasonBreakdown(facts, { from: "2026-11-01", to: "2026-11-30" })).toEqual([{ reason: "価格", count: 1 }]);
  });
});

describe("初回対応時間", () => {
  it("受付から最初の対応までの分。未対応は平均に入れない", () => {
    const a = inquiry({ receivedAt: at("2026-11-01T09:00:00+09:00"), firstResponseAt: at("2026-11-01T10:30:00+09:00") });
    const b = inquiry({ receivedAt: at("2026-11-01T09:00:00+09:00"), firstResponseAt: at("2026-11-01T09:30:00+09:00") });
    const c = inquiry({ receivedAt: at("2026-11-01T09:00:00+09:00") });
    expect(firstResponseMinutes(a)).toBe(90);
    expect(firstResponseMinutes(c)).toBeNull();
    expect(averageFirstResponseMinutes([a, b, c])).toBe(60);
  });
  it("初回対応率：基準時間ちょうどは達成。基準時間が経っていない未対応は分母に入れない", () => {
    const now = at("2026-11-13T12:00:00+09:00");
    const onTime = inquiry({ receivedAt: at("2026-11-10T09:00:00+09:00"), firstResponseAt: at("2026-11-11T09:00:00+09:00") }); // ちょうど24時間
    const late = inquiry({ receivedAt: at("2026-11-10T09:00:00+09:00"), firstResponseAt: at("2026-11-11T09:01:00+09:00") });
    const unansweredOld = inquiry({ receivedAt: at("2026-11-10T09:00:00+09:00") });
    const unansweredNew = inquiry({ receivedAt: at("2026-11-13T09:00:00+09:00") });
    expect(firstResponseRate([onTime, late, unansweredOld, unansweredNew], 24, now)).toBeCloseTo(33.333, 2);
    expect(firstResponseRate([unansweredNew], 24, now)).toBeNull();
  });
  it("対応日時が受付より前になっていても負の値にしない", () => {
    expect(firstResponseMinutes(inquiry({ receivedAt: at("2026-11-01T10:00:00Z"), firstResponseAt: at("2026-11-01T09:00:00Z") }))).toBe(0);
  });
});

describe("平均受注期間", () => {
  it("問い合わせ受付日（なければ案件作成日）から受注日まで（日本時間の日付で数える）", () => {
    const won = [
      deal({ closedOn: "2026-11-10", inquiryReceivedAt: at("2026-10-31T15:30:00Z") }), // JST 11/1 → 9日
      deal({ closedOn: "2026-11-21", createdAt: at("2026-11-01T01:00:00Z") }), // 20日
    ];
    expect(averageDaysToWin(won, TZ)).toBe(14.5);
  });
});

describe("月別の推移（日付の境界）", () => {
  it("10月31日 23:30（日本時間）の問い合わせは10月、11月1日 0:30 は11月", () => {
    const facts: Facts = {
      inquiries: [
        inquiry({ receivedAt: at("2026-10-31T14:30:00Z") }),
        inquiry({ receivedAt: at("2026-10-31T15:30:00Z"), status: "converted", convertedDealId: "x" }),
      ],
      deals: [deal({ category: "won", closedOn: "2026-11-01", actualAmount: 100 })],
      sales: [{ dealId: "x", customerId: "c", ownerId: null, amount: 100, recognizedOn: "2026-11-30" }],
    };
    const [oct, nov] = monthlySeries(facts, ["2026-10", "2026-11"], TZ);
    expect(oct).toMatchObject({ inquiries: 1, converted: 0, conversionRate: 0, won: 0, winRate: null });
    expect(nov).toMatchObject({ inquiries: 1, converted: 1, conversionRate: 100, won: 1, wonAmount: 100, sales: 100, winRate: 100 });
  });
});

describe("問い合わせ経路の分析", () => {
  it("経路ごとに 問い合わせ → 案件化 → 受注 → 受注金額 をつなげる", () => {
    const won = deal({ id: "d1", category: "won", closedOn: "2026-12-10", actualAmount: 2_000_000 });
    const lost = deal({ id: "d2", category: "lost", closedOn: "2026-11-20" });
    const facts: Facts = {
      inquiries: [
        inquiry({ receivedAt: at("2026-11-02T00:00:00Z"), sourceId: "ref", status: "converted", convertedDealId: "d1" }),
        inquiry({ receivedAt: at("2026-11-03T00:00:00Z"), sourceId: "ref" }),
        inquiry({ receivedAt: at("2026-11-04T00:00:00Z"), sourceId: "web", status: "converted", convertedDealId: "d2" }),
        inquiry({ receivedAt: at("2026-11-05T00:00:00Z"), sourceId: "web" }),
        inquiry({ receivedAt: at("2026-11-06T00:00:00Z"), sourceId: "web" }),
        inquiry({ receivedAt: at("2026-11-07T00:00:00Z"), sourceId: null }),
      ],
      deals: [won, lost],
      sales: [],
    };
    const rows = sourceAnalysis(facts, { from: "2026-11-01", to: "2026-11-30" }, [{ id: "ref", name: "紹介" }, { id: "web", name: "Webフォーム" }, { id: "line", name: "LINE" }], TZ);
    const ref = rows.find((r) => r.name === "紹介")!;
    const web = rows.find((r) => r.name === "Webフォーム")!;
    expect(ref).toMatchObject({ inquiries: 2, converted: 1, conversionRate: 50, won: 1, inquiryWinRate: 50, winRate: 100, wonAmount: 2_000_000, revenuePerInquiry: 1_000_000 });
    expect(web).toMatchObject({ inquiries: 3, converted: 1, won: 0, lost: 1, winRate: 0, wonAmount: 0 });
    expect(rows.find((r) => r.name === "LINE")).toMatchObject({ inquiries: 0, conversionRate: null, inquiryWinRate: null, revenuePerInquiry: null });
    expect(rows.find((r) => r.name === "未設定")?.inquiries).toBe(1);
    expect(rows[0].name).toBe("紹介"); // 受注金額の多い順
  });
});

describe("担当者別", () => {
  it("受注・失注・受注率・進行中の見込", () => {
    const facts: Facts = {
      inquiries: [inquiry({ receivedAt: at("2026-11-02T00:00:00Z"), ownerId: "a", firstResponseAt: at("2026-11-02T01:00:00Z") })],
      deals: [
        deal({ ownerId: "a", category: "won", closedOn: "2026-11-10", actualAmount: 1_000 }),
        deal({ ownerId: "a", category: "lost", closedOn: "2026-11-11" }),
        deal({ ownerId: "a", category: "open", expectedRevenue: 300 }),
        deal({ ownerId: null, category: "open", expectedRevenue: 50 }),
      ],
      sales: [],
    };
    const rows = ownerAnalysis(facts, { from: "2026-11-01", to: "2026-11-30" }, [{ id: "a", name: "鈴木" }, { id: "b", name: "田中" }], TZ);
    expect(rows.find((r) => r.ownerId === "a")).toMatchObject({ inquiries: 1, won: 1, lost: 1, winRate: 50, wonAmount: 1_000, openDeals: 1, pipeline: 300, avgFirstResponseMinutes: 60 });
    expect(rows.find((r) => r.ownerId === "b")).toMatchObject({ won: 0, winRate: null, avgFirstResponseMinutes: null });
    expect(rows.find((r) => r.ownerId === null)).toMatchObject({ name: "未割当", pipeline: 50 });
  });
});
