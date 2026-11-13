import { notFound } from "next/navigation";
import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { DealForm } from "@/components/deals/deal-form";
import { requireUser } from "@/lib/auth";
import { getDeal } from "@/lib/data/deals";
import { getLookups } from "@/lib/data/lookups";
import type { DealInput } from "@/lib/validation";

export const metadata = { title: "案件を編集" };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [d, lookups] = await Promise.all([getDeal(id), getLookups()]);
  if (!d) notFound();
  const initial: DealInput = {
    title: d.title, customer_id: d.customerId, owner_id: d.ownerId ?? "", deal_type: d.dealType ?? "", stage_id: d.stageId,
    probability_manual: d.probabilityManual, probability: d.probability, estimated_amount: String(d.estimatedAmount),
    actual_amount: d.actualAmount === null ? "" : String(d.actualAmount), started_on: d.startedOn ?? "", quote_submitted_on: d.quoteSubmittedOn ?? "",
    expected_close_on: d.expectedCloseOn ?? "", expected_complete_on: d.expectedCompleteOn ?? "", closed_on: d.closedOn ?? "", revenue_on: d.revenueOn ?? "",
    next_follow_up_on: d.nextFollowUpOn ?? "", lost_reason: d.lostReason ?? "", memo: d.memo ?? "",
  };
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink href={`/deals/${d.id}`} label="案件の詳細" />
      <PageHeader title="案件を編集" description={`No.${d.number}　${d.title}`} />
      <DealForm id={d.id} initial={initial} initialCustomerLabel={d.customerName} updatedAt={d.updatedAt.toISOString()}
        options={{ members: lookups.members, stages: lookups.stages, dealTypes: user.settings.dealTypes }} />
    </div>
  );
}
