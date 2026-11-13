import "server-only";
import { asCurrentUser, type CurrentUser } from "@/lib/auth";
import { addDays, addMonths, endOfMonth, monthPeriod, monthRange, startOfMonth, startOfYear, toLocalDate, type Period } from "@/lib/domain/dates";
import {
  lostReasonBreakdown, monthlySeries, ownerAnalysis, pipelineTotals, sourceAnalysis, summarize,
  type Facts, type MonthlyPoint, type OwnerRow, type PeriodSummary, type SourceRow,
} from "@/lib/domain/metrics";
import { loadFacts } from "./facts";
import { getLookups } from "./lookups";

export const RANGES = ["this_month", "last_month", "3m", "6m", "this_year", "12m"] as const;
export type RangeKey = (typeof RANGES)[number];
export const RANGE_LABEL: Record<RangeKey, string> = {
  this_month: "今月", last_month: "先月", "3m": "直近3か月", "6m": "直近6か月", this_year: "今年", "12m": "直近12か月",
};

export function periodOf(range: RangeKey, today: string): Period {
  const month = startOfMonth(today);
  switch (range) {
    case "this_month": return monthPeriod(today);
    case "last_month": return monthPeriod(addMonths(month, -1));
    case "3m": return { from: addMonths(month, -2), to: endOfMonth(today) };
    case "6m": return { from: addMonths(month, -5), to: endOfMonth(today) };
    case "this_year": return { from: startOfYear(today), to: endOfMonth(today) };
    case "12m": return { from: addMonths(month, -11), to: endOfMonth(today) };
  }
}

export type Analytics = {
  period: Period;
  summary: PeriodSummary;
  previous: PeriodSummary;
  /** 前の期間にもデータがあり、比べられるか（使い始めて間もない組織では比べない） */
  comparable: boolean;
  monthly: MonthlyPoint[];
  sources: SourceRow[];
  owners: OwnerRow[];
  lostReasons: { reason: string; count: number }[];
  pipeline: { column: string; count: number; expected: number }[];
  pipelineTotal: { count: number; expected: number; estimated: number };
};

/** 分析・レポートの元になる集計（計算はすべて src/lib/domain/metrics.ts の純粋関数） */
export async function getAnalytics(user: CurrentUser, period: Period, previous: Period): Promise<Analytics> {
  const tz = user.settings.timezone;
  const now = new Date();
  const today = toLocalDate(now, tz);
  // グラフは期間に関係なく最低6か月分を見せる
  const chartFrom = [period.from, addMonths(startOfMonth(today), -5)].sort()[0];
  const loadFrom = [chartFrom, previous.from].sort()[0];
  const [facts, lookups] = await Promise.all([
    asCurrentUser((tx) => loadFacts(tx, new Date(`${loadFrom}T00:00:00+09:00`))) as Promise<Facts>,
    getLookups(),
  ]);
  const opts = { tz, now, firstResponseTargetHours: user.settings.firstResponseTargetHours };
  const stageColumn = new Map(lookups.stages.map((s) => [s.id, s.boardColumn ?? s.name]));
  const pipeline = new Map<string, { column: string; count: number; expected: number }>();
  for (const s of lookups.stages.filter((x) => x.category === "open" && x.isActive)) {
    const col = s.boardColumn ?? s.name;
    if (!pipeline.has(col)) pipeline.set(col, { column: col, count: 0, expected: 0 });
  }
  for (const d of facts.deals.filter((x) => x.category === "open")) {
    const row = pipeline.get(stageColumn.get(d.stageId) ?? "");
    if (row) { row.count++; row.expected += d.expectedRevenue; }
  }
  const lastMonthEnd = period.to < today ? period.to : today;
  return {
    period,
    summary: summarize(facts, period, opts),
    previous: summarize(facts, previous, opts),
    comparable: facts.inquiries.some((i) => toLocalDate(i.receivedAt, tz) <= addDays(previous.from, 14)),
    monthly: monthlySeries(facts, monthRange(chartFrom, lastMonthEnd), tz),
    sources: sourceAnalysis(facts, period, lookups.sources, tz),
    owners: ownerAnalysis(facts, period, lookups.members.filter((m) => m.isActive), tz),
    lostReasons: lostReasonBreakdown(facts, period),
    pipeline: [...pipeline.values()],
    pipelineTotal: pipelineTotals(facts.deals),
  };
}

/** 比較用の前の期間（同じ長さだけ前にずらす） */
export function previousOf(range: RangeKey, today: string): Period {
  const p = periodOf(range, today);
  const months = range === "this_month" || range === "last_month" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;
  if (range === "this_year") return { from: addMonths(p.from, -12), to: endOfMonth(addMonths(startOfMonth(p.to), -12)) };
  return { from: addMonths(p.from, -months), to: endOfMonth(addMonths(startOfMonth(p.to), -months)) };
}


