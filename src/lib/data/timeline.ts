import "server-only";
import type { Tx } from "@/lib/db";
import type { ActivityType, Priority, StageCategory, TaskStatus } from "@/lib/domain/labels";

export type TimelineScope = { customerId?: string; dealId?: string; inquiryId?: string };

export type TimelineEvent =
  | { kind: "inquiry"; id: string; at: Date; title: string; sourceName: string | null; content: string | null }
  | { kind: "activity"; id: string; at: Date; type: ActivityType; content: string; result: string | null; userId: string | null; nextActionOn: string | null; dealId: string | null; inquiryId: string | null; dealTitle: string | null }
  | { kind: "stage"; id: string; at: Date; dealId: string; dealTitle: string; from: string | null; to: string; category: StageCategory; userId: string | null };

/** 問い合わせ → 電話 → 商談 → 見積提出 → フォロー → 受注 のように、対応の流れを時系列で並べる（新しい順） */
export async function loadTimeline(tx: Tx, scope: TimelineScope): Promise<TimelineEvent[]> {
  const { customerId = null, dealId = null, inquiryId = null } = scope;
  const [inquiries, activities, stages] = await Promise.all([
    tx<{ id: string; at: Date; title: string; source_name: string | null; content: string | null }[]>`
      select i.id, i.received_at at, i.title, s.name source_name, i.content
        from inquiries i left join inquiry_sources s on s.id = i.source_id
       where (${customerId}::uuid is not null and i.customer_id = ${customerId})
          or (${dealId}::uuid is not null and i.converted_deal_id = ${dealId})
          or (${inquiryId}::uuid is not null and i.id = ${inquiryId})`,
    tx<{ id: string; at: Date; type: ActivityType; content: string; result: string | null; user_id: string | null; next_action_on: string | null; deal_id: string | null; inquiry_id: string | null; deal_title: string | null }[]>`
      select a.id, a.occurred_at at, a.activity_type type, a.content, a.result, a.user_id, a.next_action_on, a.deal_id, a.inquiry_id, d.title deal_title
        from activities a left join deals d on d.id = a.deal_id
       where (${customerId}::uuid is not null and a.customer_id = ${customerId})
          or (${dealId}::uuid is not null and a.deal_id = ${dealId})
          or (${inquiryId}::uuid is not null and a.inquiry_id = ${inquiryId})
       order by a.occurred_at desc limit 300`,
    tx<{ id: string; at: Date; deal_id: string; deal_title: string; from_name: string | null; to_name: string; category: StageCategory; changed_by: string | null }[]>`
      select h.id::text, h.changed_at at, h.deal_id, d.title deal_title, fs.name from_name, ts.name to_name, ts.category, h.changed_by
        from deal_stage_history h join deals d on d.id = h.deal_id
        join pipeline_stages ts on ts.id = h.to_stage_id left join pipeline_stages fs on fs.id = h.from_stage_id
       where (${customerId}::uuid is not null and d.customer_id = ${customerId})
          or (${dealId}::uuid is not null and h.deal_id = ${dealId})
       order by h.changed_at desc limit 200`,
  ]);
  const events: TimelineEvent[] = [
    ...inquiries.map((i) => ({ kind: "inquiry" as const, id: i.id, at: i.at, title: i.title, sourceName: i.source_name, content: i.content })),
    ...activities.map((a) => ({
      kind: "activity" as const, id: a.id, at: a.at, type: a.type, content: a.content, result: a.result, userId: a.user_id, nextActionOn: a.next_action_on,
      dealId: a.deal_id, inquiryId: a.inquiry_id, dealTitle: a.deal_title,
    })),
    ...stages.map((s) => ({
      kind: "stage" as const, id: `h${s.id}`, at: s.at, dealId: s.deal_id, dealTitle: s.deal_title, from: s.from_name, to: s.to_name, category: s.category, userId: s.changed_by,
    })),
  ];
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export type RelatedTask = { id: string; title: string; status: TaskStatus; priority: Priority; dueOn: string | null; assigneeId: string | null; isAuto: boolean };

export async function loadRelatedTasks(tx: Tx, scope: TimelineScope): Promise<RelatedTask[]> {
  const { customerId = null, dealId = null, inquiryId = null } = scope;
  return [...await tx<RelatedTask[]>`
    select id, title, status, priority, due_on "dueOn", assignee_id "assigneeId", is_auto "isAuto" from tasks
     where (${customerId}::uuid is not null and customer_id = ${customerId})
        or (${dealId}::uuid is not null and deal_id = ${dealId})
        or (${inquiryId}::uuid is not null and inquiry_id = ${inquiryId})
     order by (status = 'done'), due_on nulls last, created_at desc limit 100`];
}
