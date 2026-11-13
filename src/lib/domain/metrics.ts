/**
 * 営業の指標（純粋関数。ダッシュボード・分析・レポートはすべてここで計算する）。
 * 0件のときの率は null（画面では「—」）。0除算で NaN や Infinity を出さない。
 *
 * 定義（docs/DESIGN.md と同じ）
 *   案件化率   = 期間内に受け付けた問い合わせのうち案件化した件数 ÷ 期間内の問い合わせ件数 × 100
 *   受注率     = 受注 ÷（受注＋失注）× 100（期間は受注日・失注日）
 *   失注率     = 失注 ÷（受注＋失注）× 100
 *   初回対応時間 = 受付から最初の対応履歴まで。初回対応率 = 基準時間内に初回対応した割合
 *   平均受注単価 = 受注金額合計 ÷ 受注件数
 *   平均受注期間 = 問い合わせ受付（なければ案件作成）から受注日までの日数の平均
 */
import { diffDays, inPeriod, inPeriodAt, hoursBetween, monthKey, toLocalDate, type DateString, type Period } from "./dates";
import { isWon, type InquiryStatus, type StageCategory } from "./labels";
import { sum, wonAmount } from "./money";

export type InquiryFact = {
  id: string;
  receivedAt: Date;
  firstResponseAt: Date | null;
  status: InquiryStatus;
  sourceId: string | null;
  ownerId: string | null;
  convertedDealId: string | null;
};

export type DealFact = {
  id: string;
  ownerId: string | null;
  customerId: string;
  inquiryId: string | null;
  stageId: string;
  category: StageCategory;
  estimatedAmount: number;
  actualAmount: number | null;
  expectedRevenue: number;
  closedOn: DateString | null;
  createdAt: Date;
  /** 元の問い合わせの受付日時（問い合わせから案件化したとき） */
  inquiryReceivedAt: Date | null;
  lostReason: string | null;
};

export type SaleFact = { dealId: string; customerId: string; ownerId: string | null; amount: number; recognizedOn: DateString };

/** 割合（%）。分母が0なら null */
export function ratePercent(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function average(values: number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length;
}

export function isConverted(inq: Pick<InquiryFact, "status" | "convertedDealId">): boolean {
  return inq.status === "converted" || inq.convertedDealId !== null;
}

/** 案件化率（%） */
export function conversionRate(inquiries: Pick<InquiryFact, "status" | "convertedDealId">[]): number | null {
  return ratePercent(inquiries.filter(isConverted).length, inquiries.length);
}

/** 受注率（%）：受注 ÷（受注＋失注） */
export function winRate(won: number, lost: number): number | null {
  return ratePercent(won, won + lost);
}

/** 失注率（%）：失注 ÷（受注＋失注） */
export function lossRate(won: number, lost: number): number | null {
  return ratePercent(lost, won + lost);
}

/** 初回対応までの分（未対応・不正な値は null） */
export function firstResponseMinutes(inq: Pick<InquiryFact, "receivedAt" | "firstResponseAt">): number | null {
  if (!inq.firstResponseAt) return null;
  return Math.max(0, (inq.firstResponseAt.getTime() - inq.receivedAt.getTime()) / 60_000);
}

/** 平均初回対応時間（分）。対応済みの問い合わせだけで平均する */
export function averageFirstResponseMinutes(inquiries: Pick<InquiryFact, "receivedAt" | "firstResponseAt">[]): number | null {
  return average(inquiries.map(firstResponseMinutes).filter((v): v is number => v !== null));
}

/**
 * 初回対応率（%）：基準時間内に初回対応できた割合。
 * 受付から基準時間が経っていない未対応の問い合わせは、まだ判定できないので分母に入れない。
 */
export function firstResponseRate(
  inquiries: Pick<InquiryFact, "receivedAt" | "firstResponseAt">[], targetHours: number, now: Date,
): number | null {
  let judged = 0;
  let onTime = 0;
  for (const inq of inquiries) {
    const minutes = firstResponseMinutes(inq);
    if (minutes === null) {
      if (hoursBetween(inq.receivedAt, now) >= targetHours) judged++;
      continue;
    }
    judged++;
    if (minutes <= targetHours * 60) onTime++;
  }
  return ratePercent(onTime, judged);
}

/** 平均受注単価 */
export function averageDealSize(won: Pick<DealFact, "actualAmount" | "estimatedAmount">[]): number | null {
  if (won.length === 0) return null;
  return Math.round(sum(won.map(wonAmount)) / won.length);
}

/** 平均受注期間（日） */
export function averageDaysToWin(won: Pick<DealFact, "closedOn" | "createdAt" | "inquiryReceivedAt">[], tz: string): number | null {
  const days = won
    .filter((d) => d.closedOn)
    .map((d) => Math.max(0, diffDays(toLocalDate(d.inquiryReceivedAt ?? d.createdAt, tz), d.closedOn as string)));
  return average(days);
}

/** 期間内に受注・失注した案件 */
export function closedIn(deals: DealFact[], period: Period) {
  const won = deals.filter((d) => isWon(d.category) && inPeriod(d.closedOn, period));
  const lost = deals.filter((d) => d.category === "lost" && inPeriod(d.closedOn, period));
  return { won, lost };
}

export type PeriodSummary = {
  inquiries: number;
  unanswered: number;
  converted: number;
  conversionRate: number | null;
  won: number;
  lost: number;
  winRate: number | null;
  lossRate: number | null;
  wonAmount: number;
  sales: number;
  avgFirstResponseMinutes: number | null;
  firstResponseRate: number | null;
  avgDealSize: number | null;
  avgDaysToWin: number | null;
};

export type Facts = { inquiries: InquiryFact[]; deals: DealFact[]; sales: SaleFact[] };

/** 期間の集計（レポート・分析・ダッシュボードで共通） */
export function summarize(facts: Facts, period: Period, opts: { tz: string; now: Date; firstResponseTargetHours: number }): PeriodSummary {
  const cohort = facts.inquiries.filter((i) => inPeriodAt(i.receivedAt, period, opts.tz));
  const { won, lost } = closedIn(facts.deals, period);
  return {
    inquiries: cohort.length,
    unanswered: cohort.filter((i) => i.status === "new").length,
    converted: cohort.filter(isConverted).length,
    conversionRate: conversionRate(cohort),
    won: won.length,
    lost: lost.length,
    winRate: winRate(won.length, lost.length),
    lossRate: lossRate(won.length, lost.length),
    wonAmount: sum(won.map(wonAmount)),
    sales: sum(facts.sales.filter((s) => inPeriod(s.recognizedOn, period)).map((s) => s.amount)),
    avgFirstResponseMinutes: averageFirstResponseMinutes(cohort),
    firstResponseRate: firstResponseRate(cohort, opts.firstResponseTargetHours, opts.now),
    avgDealSize: averageDealSize(won),
    avgDaysToWin: averageDaysToWin(won, opts.tz),
  };
}

export type MonthlyPoint = {
  month: string;
  inquiries: number;
  converted: number;
  conversionRate: number | null;
  won: number;
  lost: number;
  winRate: number | null;
  wonAmount: number;
  sales: number;
};

/** 月別の推移（months は 'YYYY-MM' の並び） */
export function monthlySeries(facts: Facts, months: string[], tz: string): MonthlyPoint[] {
  const rows = new Map<string, MonthlyPoint>(months.map((m) => [m, {
    month: m, inquiries: 0, converted: 0, conversionRate: null, won: 0, lost: 0, winRate: null, wonAmount: 0, sales: 0,
  }]));
  for (const inq of facts.inquiries) {
    const row = rows.get(monthKey(toLocalDate(inq.receivedAt, tz)));
    if (!row) continue;
    row.inquiries++;
    if (isConverted(inq)) row.converted++;
  }
  for (const d of facts.deals) {
    if (!d.closedOn) continue;
    const row = rows.get(monthKey(d.closedOn));
    if (!row) continue;
    if (isWon(d.category)) {
      row.won++;
      row.wonAmount += wonAmount(d);
    } else if (d.category === "lost") {
      row.lost++;
    }
  }
  for (const s of facts.sales) {
    const row = rows.get(monthKey(s.recognizedOn));
    if (row) row.sales += s.amount;
  }
  for (const row of rows.values()) {
    row.conversionRate = ratePercent(row.converted, row.inquiries);
    row.winRate = winRate(row.won, row.lost);
  }
  return [...rows.values()];
}

export type SourceRow = {
  sourceId: string | null;
  name: string;
  inquiries: number;
  converted: number;
  conversionRate: number | null;
  won: number;
  lost: number;
  /** 問い合わせからの受注率（受注件数 ÷ 問い合わせ件数）＝ その経路の問い合わせが受注になった割合 */
  inquiryWinRate: number | null;
  /** 商談の受注率（受注 ÷ 受注＋失注） */
  winRate: number | null;
  wonAmount: number;
  /** 問い合わせ1件あたりの受注金額 */
  revenuePerInquiry: number | null;
};

/**
 * 問い合わせ経路の分析：期間内に受け付けた問い合わせを経路ごとに、案件化 → 受注 → 受注金額までつなげる。
 * 「どの経路の問い合わせが売上になっているか」を見るための表（受注日は期間外でもよい）。
 */
export function sourceAnalysis(facts: Facts, period: Period, sources: { id: string; name: string }[], tz: string): SourceRow[] {
  const dealById = new Map(facts.deals.map((d) => [d.id, d]));
  const dealByInquiry = new Map(facts.deals.filter((d) => d.inquiryId).map((d) => [d.inquiryId as string, d]));
  const names = new Map(sources.map((s) => [s.id, s.name]));
  const rows = new Map<string, SourceRow>();
  const keyOf = (id: string | null) => id ?? "__none";
  for (const s of sources) rows.set(s.id, emptySource(s.id, s.name));
  for (const inq of facts.inquiries) {
    if (!inPeriodAt(inq.receivedAt, period, tz)) continue;
    const key = keyOf(inq.sourceId);
    if (!rows.has(key)) rows.set(key, emptySource(inq.sourceId, inq.sourceId ? (names.get(inq.sourceId) ?? "（削除された経路）") : "未設定"));
    const row = rows.get(key) as SourceRow;
    row.inquiries++;
    if (isConverted(inq)) row.converted++;
    const deal = (inq.convertedDealId && dealById.get(inq.convertedDealId)) || dealByInquiry.get(inq.id);
    if (deal && isWon(deal.category)) {
      row.won++;
      row.wonAmount += wonAmount(deal);
    } else if (deal && deal.category === "lost") {
      row.lost++;
    }
  }
  for (const row of rows.values()) {
    row.conversionRate = ratePercent(row.converted, row.inquiries);
    row.inquiryWinRate = ratePercent(row.won, row.inquiries);
    row.winRate = winRate(row.won, row.lost);
    row.revenuePerInquiry = row.inquiries > 0 ? Math.round(row.wonAmount / row.inquiries) : null;
  }
  return [...rows.values()].sort((a, b) => b.wonAmount - a.wonAmount || b.inquiries - a.inquiries);
}

function emptySource(sourceId: string | null, name: string): SourceRow {
  return { sourceId, name, inquiries: 0, converted: 0, conversionRate: null, won: 0, lost: 0, inquiryWinRate: null, winRate: null, wonAmount: 0, revenuePerInquiry: null };
}

export type OwnerRow = {
  ownerId: string | null;
  name: string;
  inquiries: number;
  avgFirstResponseMinutes: number | null;
  won: number;
  lost: number;
  winRate: number | null;
  wonAmount: number;
  openDeals: number;
  pipeline: number;
};

/** 担当者別：受注件数・受注率・受注金額（期間内）と、いま抱えている見込（進行中の案件） */
export function ownerAnalysis(facts: Facts, period: Period, members: { id: string; name: string }[], tz: string): OwnerRow[] {
  const rows = new Map<string, OwnerRow>();
  const get = (id: string | null) => {
    const key = id ?? "__none";
    if (!rows.has(key)) {
      rows.set(key, {
        ownerId: id, name: id ? (members.find((m) => m.id === id)?.name ?? "（退職したメンバー）") : "未割当",
        inquiries: 0, avgFirstResponseMinutes: null, won: 0, lost: 0, winRate: null, wonAmount: 0, openDeals: 0, pipeline: 0,
      });
    }
    return rows.get(key) as OwnerRow;
  };
  for (const m of members) get(m.id);
  const responses = new Map<string, number[]>();
  for (const inq of facts.inquiries) {
    if (!inPeriodAt(inq.receivedAt, period, tz)) continue;
    get(inq.ownerId).inquiries++;
    const minutes = firstResponseMinutes(inq);
    if (minutes !== null) {
      const key = inq.ownerId ?? "__none";
      responses.set(key, [...(responses.get(key) ?? []), minutes]);
    }
  }
  const { won, lost } = closedIn(facts.deals, period);
  for (const d of won) {
    const row = get(d.ownerId);
    row.won++;
    row.wonAmount += wonAmount(d);
  }
  for (const d of lost) get(d.ownerId).lost++;
  for (const d of facts.deals) {
    if (d.category !== "open") continue;
    const row = get(d.ownerId);
    row.openDeals++;
    row.pipeline += d.expectedRevenue;
  }
  for (const [key, row] of rows) {
    row.winRate = winRate(row.won, row.lost);
    row.avgFirstResponseMinutes = average(responses.get(key) ?? []);
  }
  return [...rows.values()]
    .filter((r) => r.ownerId !== null || r.inquiries + r.won + r.lost + r.openDeals > 0)
    .sort((a, b) => b.wonAmount - a.wonAmount || b.pipeline - a.pipeline);
}

/** 失注理由の内訳（期間内に失注した案件） */
export function lostReasonBreakdown(facts: Facts, period: Period): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of closedIn(facts.deals, period).lost) {
    const reason = d.lostReason?.trim() || "未入力";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

/** 進行中の案件の見込（受注見込金額の合計・件数） */
export function pipelineTotals(deals: Pick<DealFact, "category" | "expectedRevenue" | "estimatedAmount">[]) {
  const open = deals.filter((d) => d.category === "open");
  return { count: open.length, expected: sum(open.map((d) => d.expectedRevenue)), estimated: sum(open.map((d) => d.estimatedAmount)) };
}

/** 売上の集計（キーごと） */
export function groupSales<K extends string>(sales: SaleFact[], period: Period, key: (s: SaleFact) => K): Map<K, { amount: number; count: number }> {
  const out = new Map<K, { amount: number; count: number }>();
  for (const s of sales) {
    if (!inPeriod(s.recognizedOn, period)) continue;
    const k = key(s);
    const cur = out.get(k) ?? { amount: 0, count: 0 };
    cur.amount += s.amount;
    cur.count++;
    out.set(k, cur);
  }
  return out;
}
