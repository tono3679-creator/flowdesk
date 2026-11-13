import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { DealForm } from "@/components/deals/deal-form";
import { requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/data/customers";
import { getLookups } from "@/lib/data/lookups";
import { toLocalDate } from "@/lib/domain/dates";
import type { DealInput } from "@/lib/validation";

export const metadata = { title: "案件を作成" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const user = await requireUser();
  const { customer } = await searchParams;
  const [lookups, c] = await Promise.all([getLookups(), customer ? getCustomer(customer, "2100-01-01") : Promise.resolve(null)]);
  const first = lookups.stages.find((s) => s.isActive && s.category === "open") ?? lookups.stages[0];
  const initial: DealInput = {
    title: "", customer_id: c?.customer.id ?? "", owner_id: user.userId, deal_type: "", stage_id: first?.id ?? "", probability_manual: false,
    probability: first?.defaultProbability ?? 0, estimated_amount: "", actual_amount: "", started_on: toLocalDate(new Date()), quote_submitted_on: "",
    expected_close_on: "", expected_complete_on: "", closed_on: "", revenue_on: "", next_follow_up_on: "", lost_reason: "", memo: "",
  };
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink href="/deals" label="案件一覧" />
      <PageHeader title="案件を作成" description="問い合わせから作る場合は、問い合わせ詳細の「案件化する」を使うと内容・履歴を引き継げます" />
      <DealForm id={null} initial={initial} initialCustomerLabel={c ? (c.customer.companyName ?? c.customer.name) : null}
        options={{ members: lookups.members, stages: lookups.stages, dealTypes: user.settings.dealTypes }} />
    </div>
  );
}
