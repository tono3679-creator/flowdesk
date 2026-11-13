import "server-only";
import type { Tx } from "@/lib/db";
import type { AlertInput } from "@/lib/domain/alerts";
import type { DealFact, Facts, InquiryFact, SaleFact } from "@/lib/domain/metrics";

/**
 * 指標の計算に使う事実のデータ（RLS 付きで読むので、一般担当者は自分の範囲だけになる）。
 * since より後に受け付けた問い合わせ・作成または受注した案件・計上した売上を読む（進行中の案件は日付に関係なく読む）。
 */
export async function loadFacts(tx: Tx, since: Date): Promise<Facts> {
  const [inquiries, deals, sales] = await Promise.all([
    tx<InquiryFact[]>`
      select id, received_at "receivedAt", first_response_at "firstResponseAt", status, source_id "sourceId", owner_id "ownerId",
             converted_deal_id "convertedDealId"
        from inquiries where received_at >= ${since}`,
    tx<DealFact[]>`
      select d.id, d.owner_id "ownerId", d.customer_id "customerId", d.inquiry_id "inquiryId", d.stage_id "stageId", s.category,
             d.estimated_amount "estimatedAmount", d.actual_amount "actualAmount", d.expected_revenue "expectedRevenue",
             d.closed_on "closedOn", d.created_at "createdAt", i.received_at "inquiryReceivedAt", d.lost_reason "lostReason"
        from deals d join pipeline_stages s on s.id = d.stage_id
        left join inquiries i on i.id = d.inquiry_id
       where d.created_at >= ${since} or d.closed_on >= ${since}::date or s.category in ('open', 'hold')
          or d.inquiry_id in (select id from inquiries where received_at >= ${since})`,
    tx<SaleFact[]>`
      select deal_id "dealId", customer_id "customerId", owner_id "ownerId", amount, recognized_on "recognizedOn"
        from sales where recognized_on >= ${since}::date`,
  ]);
  return { inquiries: [...inquiries], deals: [...deals], sales: [...sales] };
}

/** アラートの判定に使う、まだ終わっていない問い合わせ・案件・タスク */
export async function loadAlertInput(tx: Tx): Promise<AlertInput> {
  const [inquiries, deals, tasks] = await Promise.all([
    tx<AlertInput["inquiries"]>`
      select id, title, status, priority, received_at "receivedAt", owner_id "ownerId", next_action_on "nextActionOn"
        from inquiries where status in ('new', 'in_progress', 'on_hold')`,
    tx<AlertInput["deals"]>`
      select d.id, d.title, s.category, d.owner_id "ownerId", d.quote_submitted_on "quoteSubmittedOn", d.last_contact_at "lastContactAt",
             d.created_at "createdAt", d.next_follow_up_on "nextFollowUpOn"
        from deals d join pipeline_stages s on s.id = d.stage_id where s.category = 'open'`,
    tx<AlertInput["tasks"]>`
      select id, title, status, priority, due_on "dueOn", assignee_id "assigneeId" from tasks where status <> 'done'`,
  ]);
  return { inquiries: [...inquiries], deals: [...deals], tasks: [...tasks] };
}
