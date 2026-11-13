import "server-only";
import { asCurrentUser, type CurrentUser } from "@/lib/auth";
import { buildTodayList, detectAlerts, type Alert } from "@/lib/domain/alerts";
import { addMonths, monthPeriod, monthRange, startOfMonth, toLocalDate, type Period } from "@/lib/domain/dates";
import { closedIn, monthlySeries, pipelineTotals, summarize, winRate, type MonthlyPoint } from "@/lib/domain/metrics";
import { loadAlertInput, loadFacts } from "./facts";

export type DashboardKpis = {
  inquiriesThisMonth: number;
  inquiriesLastMonth: number;
  unanswered: number;
  unansweredOverdue: number;
  openDeals: number;
  convertedThisMonth: number;
  conversionRateThisMonth: number | null;
  winRateThisMonth: number | null;
  winRate3Months: number | null;
  wonAmountThisMonth: number;
  wonCountThisMonth: number;
  pipelineExpected: number;
  pipelineEstimated: number;
  overdueTasks: number;
  avgFirstResponseMinutes: number | null;
  avgFirstResponseLastMonth: number | null;
};

export type StageSummary = { column: string; count: number; expected: number; estimated: number };

export type Dashboard = {
  kpis: DashboardKpis;
  today: Alert[];
  alerts: Alert[];
  monthly: MonthlyPoint[];
  pipeline: StageSummary[];
  recentInquiries: { id: string; number: number; title: string; company: string | null; contact: string | null; status: string; priority: string; receivedAt: Date; ownerId: string | null }[];
  period: Period;
};

export async function getDashboard(user: CurrentUser): Promise<Dashboard> {
  const now = new Date();
  const tz = user.settings.timezone;
  const today = toLocalDate(now, tz);
  const period = monthPeriod(today);
  const lastMonth = monthPeriod(addMonths(today, -1));
  const sinceDate = addMonths(startOfMonth(today), -5);
  const since = new Date(`${sinceDate}T00:00:00+09:00`);
  return asCurrentUser(async (tx) => {
    const [facts, alertInput, stages, recent] = await Promise.all([
      loadFacts(tx, since),
      loadAlertInput(tx),
      tx<{ column: string | null; category: string; count: number; expected: number; estimated: number; sort: number }[]>`
        select coalesce(s.board_column, s.name) "column", s.category, count(d.id)::int count,
               coalesce(sum(d.expected_revenue), 0)::bigint expected, coalesce(sum(d.estimated_amount), 0)::bigint estimated, min(s.sort_order) sort
          from pipeline_stages s left join deals d on d.stage_id = s.id
         where s.category = 'open' and s.is_active
         group by coalesce(s.board_column, s.name), s.category order by sort`,
      tx<Dashboard["recentInquiries"]>`
        select i.id, i.number, i.title, coalesce(i.company_name, c.company_name) company, coalesce(i.contact_name, c.name) contact,
               i.status, i.priority, i.received_at "receivedAt", i.owner_id "ownerId"
          from inquiries i left join customers c on c.id = i.customer_id
         order by i.received_at desc limit 6`,
    ]);
    const opts = { tz, now, firstResponseTargetHours: user.settings.firstResponseTargetHours };
    const month = summarize(facts, period, opts);
    const last = summarize(facts, lastMonth, opts);
    const threeMonths = closedIn(facts.deals, { from: addMonths(startOfMonth(today), -2), to: period.to });
    const alerts = detectAlerts(alertInput, user.settings, now, tz);
    const pipeline = pipelineTotals(facts.deals);
    return {
      kpis: {
        inquiriesThisMonth: month.inquiries,
        inquiriesLastMonth: last.inquiries,
        unanswered: alertInput.inquiries.filter((i) => i.status === "new").length,
        unansweredOverdue: alerts.filter((a) => a.kind === "unanswered").length,
        openDeals: pipeline.count,
        convertedThisMonth: month.converted,
        conversionRateThisMonth: month.conversionRate,
        winRateThisMonth: month.winRate,
        winRate3Months: winRate(threeMonths.won.length, threeMonths.lost.length),
        wonAmountThisMonth: month.wonAmount,
        wonCountThisMonth: month.won,
        pipelineExpected: pipeline.expected,
        pipelineEstimated: pipeline.estimated,
        overdueTasks: alerts.filter((a) => a.kind === "task_overdue").length,
        avgFirstResponseMinutes: month.avgFirstResponseMinutes,
        avgFirstResponseLastMonth: last.avgFirstResponseMinutes,
      },
      today: buildTodayList(alertInput, user.settings, now, tz),
      alerts,
      monthly: monthlySeries(facts, monthRange(sinceDate, today), tz),
      pipeline: stages.map((s) => ({ column: s.column ?? "", count: s.count, expected: s.expected, estimated: s.estimated })),
      recentInquiries: [...recent],
      period,
    };
  });
}

