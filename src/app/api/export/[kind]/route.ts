import { asCurrentUser, getCurrentUser } from "@/lib/auth";
import { parseCustomerFilters } from "@/lib/data/customers";
import { parseDealFilters } from "@/lib/data/deals";
import { parseInquiryFilters } from "@/lib/data/inquiries";
import { isDateString, toLocalDate } from "@/lib/domain/dates";
import { toCsv, type CsvValue } from "@/lib/domain/csv";
import {
  ACTIVITY_TYPE_LABEL, CUSTOMER_TYPE_LABEL, DEFAULT_PRIORITY_LABEL, INQUIRY_STATUS_LABEL, TASK_STATUS_LABEL,
  type CustomerType, type InquiryStatus, type Priority, type TaskStatus,
} from "@/lib/domain/labels";
import { formatDateTimeFull } from "@/lib/format";

const KINDS = { customers: "顧客", inquiries: "問い合わせ", deals: "案件", tasks: "タスク", sales: "売上", activities: "対応履歴" } as const;
type Kind = keyof typeof KINDS;

const like = (q: string | undefined) => (q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null);

/**
 * CSV 出力（UTF-8 BOM 付き・CRLF。Excel でそのまま開ける）。管理者・マネージャーのみ。
 * 一覧画面の絞り込み条件（URL）をそのまま引き継ぐ。セルの先頭が = + - @ のときは数式として実行されないようにする。
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(kind in KINDS)) return new Response("Not Found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("ログインしてください", { status: 401 });
  if (!user.isManager) return new Response("CSV の出力は管理者・マネージャーが行えます", { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const pl = user.settings.priorityLabels ?? DEFAULT_PRIORITY_LABEL;

  const { header, rows } = await asCurrentUser(async (tx): Promise<{ header: string[]; rows: CsvValue[][] }> => {
    const members = new Map((await tx<{ id: string; name: string }[]>`select m.user_id id, p.display_name "name" from organization_members m join profiles p on p.id = m.user_id`).map((m) => [m.id, m.name]));
    const who = (id: string | null) => (id ? (members.get(id) ?? "") : "");
    switch (kind as Kind) {
      case "customers": {
        const f = parseCustomerFilters(sp);
        const q = like(f.q);
        const list = await tx<{ number: number; type: CustomerType; company_name: string | null; name: string | null; department: string | null; position: string | null; phone: string | null; email: string | null; address: string | null; owner_id: string | null; rank: string | null; tags: string | null; total_sales: number; last_contact_at: Date | null; memo: string | null; created_at: Date }[]>`
          select c.number, c.type, c.company_name, c.name, c.department, c.position, c.phone, c.email, c.address, c.owner_id, c.rank,
                 (select string_agg(t.name, '、' order by t.sort_order) from customer_tag_relations r join customer_tags t on t.id = r.tag_id where r.customer_id = c.id) tags,
                 (select coalesce(sum(amount), 0) from sales where customer_id = c.id) total_sales, c.last_contact_at, c.memo, c.created_at
            from customers c
           where true
           ${q ? tx`and (coalesce(c.company_name, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(c.email, '') || ' ' || coalesce(c.phone, '')) ilike ${q}` : tx``}
           ${f.owner === "none" ? tx`and c.owner_id is null` : f.owner ? tx`and c.owner_id = ${f.owner}` : tx``}
           ${f.tag ? tx`and exists (select 1 from customer_tag_relations r where r.customer_id = c.id and r.tag_id = ${f.tag})` : tx``}
           ${f.rank ? tx`and c.rank = ${f.rank}` : tx``}
           ${f.type ? tx`and c.type = ${f.type}` : tx``}
           order by c.number`;
        return {
          header: ["顧客番号", "法人/個人", "会社名", "氏名", "部署", "役職", "電話番号", "メールアドレス", "住所", "担当者", "ランク", "タグ", "累計売上", "最終接触日時", "メモ", "登録日時"],
          rows: list.map((c) => [c.number, CUSTOMER_TYPE_LABEL[c.type], c.company_name, c.name, c.department, c.position, c.phone, c.email, c.address, who(c.owner_id), c.rank, c.tags, c.total_sales, fmt(c.last_contact_at), c.memo, fmt(c.created_at)]),
        };
      }
      case "inquiries": {
        const f = parseInquiryFilters(sp);
        const q = like(f.q);
        const list = await tx<{ number: number; received_at: Date; source: string | null; category: string | null; title: string; content: string | null; company: string | null; contact: string | null; phone: string | null; email: string | null; owner_id: string | null; priority: Priority; status: InquiryStatus; first_response_at: Date | null; last_activity_at: Date | null; next_action_on: string | null; deal: string | null }[]>`
          select i.number, i.received_at, s.name source, i.category, i.title, i.content, coalesce(c.company_name, i.company_name) company, coalesce(c.name, i.contact_name) contact,
                 i.phone, i.email, i.owner_id, i.priority, i.status, i.first_response_at, i.last_activity_at, i.next_action_on, d.title deal
            from inquiries i left join customers c on c.id = i.customer_id left join inquiry_sources s on s.id = i.source_id left join deals d on d.id = i.converted_deal_id
           where true
           ${q ? tx`and (i.title || ' ' || coalesce(i.content, '') || ' ' || coalesce(i.contact_name, '') || ' ' || coalesce(i.company_name, '') || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.name, '')) ilike ${q}` : tx``}
           ${f.status === "open" ? tx`and i.status in ('new', 'in_progress', 'on_hold')` : f.status ? tx`and i.status = ${f.status}` : tx``}
           ${f.owner === "none" ? tx`and i.owner_id is null` : f.owner ? tx`and i.owner_id = ${f.owner}` : tx``}
           ${f.source ? tx`and i.source_id = ${f.source}` : tx``}
           ${f.priority ? tx`and i.priority = ${f.priority}` : tx``}
           ${f.from ? tx`and i.received_at >= (${f.from}::date)::timestamp at time zone 'Asia/Tokyo'` : tx``}
           ${f.to ? tx`and i.received_at < ((${f.to}::date + 1)::timestamp at time zone 'Asia/Tokyo')` : tx``}
           order by i.received_at desc`;
        return {
          header: ["番号", "受付日時", "経路", "種別", "件名", "内容", "会社名", "氏名", "電話番号", "メールアドレス", "担当者", "優先度", "ステータス", "初回対応日時", "最終対応日時", "次回対応予定日", "案件"],
          rows: list.map((i) => [i.number, fmt(i.received_at), i.source, i.category, i.title, i.content, i.company, i.contact, i.phone, i.email, who(i.owner_id), pl[i.priority], INQUIRY_STATUS_LABEL[i.status], fmt(i.first_response_at), fmt(i.last_activity_at), i.next_action_on, i.deal]),
        };
      }
      case "deals": {
        const f = parseDealFilters(sp);
        const q = like(f.q);
        const list = await tx<{ number: number; title: string; customer: string; owner_id: string | null; deal_type: string | null; stage: string; probability: number; estimated_amount: number; expected_revenue: number; actual_amount: number | null; started_on: string | null; quote_submitted_on: string | null; expected_close_on: string | null; closed_on: string | null; lost_reason: string | null; source: string | null }[]>`
          select d.number, d.title, coalesce(c.company_name, c.name) customer, d.owner_id, d.deal_type, s.name stage, d.probability, d.estimated_amount, d.expected_revenue,
                 d.actual_amount, d.started_on, d.quote_submitted_on, d.expected_close_on, d.closed_on, d.lost_reason, src.name source
            from deals d join customers c on c.id = d.customer_id join pipeline_stages s on s.id = d.stage_id
            left join inquiries i on i.id = d.inquiry_id left join inquiry_sources src on src.id = i.source_id
           where true
           ${q ? tx`and (d.title || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.name, '')) ilike ${q}` : tx``}
           ${f.stage ? tx`and d.stage_id = ${f.stage}` : tx``}
           ${f.category === "closed_won" ? tx`and s.category in ('won', 'completed')` : f.category ? tx`and s.category = ${f.category}` : tx``}
           ${f.owner === "none" ? tx`and d.owner_id is null` : f.owner ? tx`and d.owner_id = ${f.owner}` : tx``}
           ${f.type ? tx`and d.deal_type = ${f.type}` : tx``}
           order by d.number`;
        return {
          header: ["案件番号", "案件名", "顧客", "担当者", "案件種別", "ステータス", "受注確度(%)", "見積金額", "受注見込金額", "受注金額", "開始日", "見積提出日", "受注予定日", "受注日・失注日", "失注理由", "問い合わせ経路"],
          rows: list.map((d) => [d.number, d.title, d.customer, who(d.owner_id), d.deal_type, d.stage, d.probability, d.estimated_amount, d.expected_revenue, d.actual_amount, d.started_on, d.quote_submitted_on, d.expected_close_on, d.closed_on, d.lost_reason, d.source]),
        };
      }
      case "tasks": {
        const list = await tx<{ title: string; description: string | null; assignee_id: string | null; status: TaskStatus; priority: Priority; start_on: string | null; due_on: string | null; completed_at: Date | null; customer: string | null; deal: string | null; inquiry: string | null; is_auto: boolean }[]>`
          select t.title, t.description, t.assignee_id, t.status, t.priority, t.start_on, t.due_on, t.completed_at, coalesce(c.company_name, c.name) customer, d.title deal, i.title inquiry, t.is_auto
            from tasks t left join customers c on c.id = t.customer_id left join deals d on d.id = t.deal_id left join inquiries i on i.id = t.inquiry_id
           order by t.due_on nulls last`;
        const today = toLocalDate(new Date());
        return {
          header: ["タイトル", "内容", "担当者", "ステータス", "優先度", "開始日", "期限", "期限超過", "完了日時", "顧客", "案件", "問い合わせ", "自動作成"],
          rows: list.map((t) => [t.title, t.description, who(t.assignee_id), TASK_STATUS_LABEL[t.status], pl[t.priority], t.start_on, t.due_on, t.status !== "done" && t.due_on && t.due_on < today ? "はい" : "", fmt(t.completed_at), t.customer, t.deal, t.inquiry, t.is_auto ? "はい" : ""]),
        };
      }
      case "sales": {
        const from = sp.from && isDateString(sp.from) ? sp.from : "1900-01-01";
        const to = sp.to && isDateString(sp.to) ? sp.to : "2999-12-31";
        const list = await tx<{ recognized_on: string; title: string; customer: string; owner_id: string | null; deal_type: string | null; amount: number }[]>`
          select s.recognized_on, d.title, coalesce(c.company_name, c.name) customer, s.owner_id, d.deal_type, s.amount
            from sales s join deals d on d.id = s.deal_id join customers c on c.id = s.customer_id
           where s.recognized_on between ${from}::date and ${to}::date order by s.recognized_on`;
        return { header: ["計上日", "案件", "顧客", "担当者", "案件種別", "金額"], rows: list.map((s) => [s.recognized_on, s.title, s.customer, who(s.owner_id), s.deal_type, s.amount]) };
      }
      case "activities": {
        const list = await tx<{ occurred_at: Date; activity_type: keyof typeof ACTIVITY_TYPE_LABEL; user_id: string | null; customer: string | null; deal: string | null; content: string; result: string | null }[]>`
          select a.occurred_at, a.activity_type, a.user_id, coalesce(c.company_name, c.name) customer, d.title deal, a.content, a.result
            from activities a left join customers c on c.id = a.customer_id left join deals d on d.id = a.deal_id order by a.occurred_at desc`;
        return { header: ["対応日時", "種別", "対応者", "顧客", "案件", "内容", "結果"], rows: list.map((a) => [fmt(a.occurred_at), ACTIVITY_TYPE_LABEL[a.activity_type], who(a.user_id), a.customer, a.deal, a.content, a.result]) };
      }
    }
  });

  const filename = `${KINDS[kind as Kind]}_${toLocalDate(new Date()).replace(/-/g, "")}.csv`;
  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

function fmt(d: Date | null): string {
  return d ? formatDateTimeFull(d) : "";
}
