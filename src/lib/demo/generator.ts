/**
 * デモデータの生成（決定的：同じ seed・同じ「今」なら同じデータ）。
 * 「今」から過去6か月分の、問い合わせ → 初回対応 → 案件化 → 商談 → 見積 → 受注／失注 → 作業 → 完了 の流れを作る。
 * 一括登録のときは自動更新のトリガーを止めるため（app_private.bulk_loading）、
 * 最終接触日・初回対応日時・確度・受注日・ステータス履歴・売上・採番はここで計算して揃える
 * （DB のトリガーと同じ結果になることを tests/db/consistency.test.ts で確かめている）。
 *
 * 分析が意味を持つよう、次の状況を必ず含める：
 *   未対応の問い合わせ（24時間超を含む）／高優先度／案件化済み／受注・失注／見積提出後のフォロー待ち／
 *   長期間接触のない案件／期限超過タスク／成績の良い担当者（鈴木）と受注率の低い担当者（田中）／経路ごとの受注率の差
 */
import { addDays, diffDays, toLocalDate, type DateString } from "@/lib/domain/dates";
import type { ActivityType, CustomerType, InquiryStatus, OrgRole, Priority, StageCategory, TaskStatus } from "@/lib/domain/labels";
import {
  COMPANY_BODY, COMPANY_PREFIX, DEAL_TYPES, DEMO_COMPANY, DEPARTMENTS, FIRST_RESPONSE_TYPES, GIVEN_NAMES, INQUIRY_CATEGORIES,
  LOST_REASON_WEIGHTS, POSITIONS, PREFECTURES, PRIORITY_WEIGHTS, SOURCES, STAFF, STAGES, SURNAMES, TAGS, TEMPLATES,
  type InquiryTemplate, type SourceKey, type StaffKey, type StageKey,
} from "./master-data";
import { Random } from "./random";

export const DEFAULT_DEMO_SEED = 20261113;
const TZ = "Asia/Tokyo";
const PERIOD_DAYS = 183;

export type DemoMode =
  | { kind: "demo"; expiresAt: Date }
  | { kind: "showcase"; passwordHash: string };

// ---- 行の型（DB の列と同じ名前） ----
export type UserRow = { id: string; email: string | null; encrypted_password: string | null; is_anonymous: boolean; created_at: Date };
export type OrganizationRow = { id: string; name: string; is_demo: boolean; demo_expires_at: Date | null; is_showcase: boolean; created_at: Date };
export type SettingsRow = {
  organization_id: string; industry: string; timezone: string; currency: string; unanswered_hours: number; quote_follow_days: number;
  no_contact_days: number; first_response_target_hours: number; inquiry_categories: string[]; deal_types: string[];
  priority_labels: Record<Priority, string>; auto_tasks: boolean;
};
export type ProfileRow = { id: string; display_name: string; title: string; created_at: Date };
export type MemberRow = { organization_id: string; user_id: string; role: OrgRole; is_active: boolean; created_at: Date };
export type StageRow = {
  id: string; organization_id: string; name: string; category: StageCategory; default_probability: number; board_column: string | null;
  marks_quote_submitted: boolean; sort_order: number; is_active: boolean;
};
export type SourceRow = { id: string; organization_id: string; name: string; sort_order: number; is_active: boolean };
export type TagRow = { id: string; organization_id: string; name: string; color: string; sort_order: number };
export type CustomerRow = {
  id: string; organization_id: string; number: number; type: CustomerType; company_name: string | null; name: string | null;
  department: string | null; position: string | null; phone: string | null; email: string | null; address: string | null;
  owner_id: string | null; rank: string | null; memo: string | null; last_contact_at: Date | null; created_by: string | null;
  created_at: Date; updated_at: Date;
};
export type TagRelationRow = { organization_id: string; customer_id: string; tag_id: string };
export type InquiryRow = {
  id: string; organization_id: string; number: number; customer_id: string | null; received_at: Date; source_id: string | null;
  category: string | null; title: string; content: string | null; contact_name: string | null; company_name: string | null;
  phone: string | null; email: string | null; owner_id: string | null; priority: Priority; status: InquiryStatus;
  next_action_on: DateString | null; first_response_at: Date | null; last_activity_at: Date | null; converted_deal_id: string | null;
  converted_at: Date | null; memo: string | null; created_by: string | null; created_at: Date; updated_at: Date;
};
export type DealRow = {
  id: string; organization_id: string; number: number; customer_id: string; inquiry_id: string | null; title: string;
  owner_id: string | null; deal_type: string | null; stage_id: string; probability: number; probability_manual: boolean;
  estimated_amount: number; actual_amount: number | null; started_on: DateString | null; quote_submitted_on: DateString | null;
  expected_close_on: DateString | null; expected_complete_on: DateString | null; closed_on: DateString | null;
  completed_on: DateString | null; revenue_on: DateString | null; lost_reason: string | null; last_contact_at: Date | null;
  next_follow_up_on: DateString | null; memo: string | null; created_by: string | null; created_at: Date; updated_at: Date;
};
export type HistoryRow = { organization_id: string; deal_id: string; from_stage_id: string | null; to_stage_id: string; changed_by: string | null; changed_at: Date };
export type TaskRow = {
  id: string; organization_id: string; title: string; description: string | null; assignee_id: string | null; customer_id: string | null;
  inquiry_id: string | null; deal_id: string | null; priority: Priority; status: TaskStatus; start_on: DateString | null;
  due_on: DateString | null; completed_at: Date | null; memo: string | null; is_auto: boolean; created_by: string | null;
  created_at: Date; updated_at: Date;
};
export type ActivityRow = {
  id: string; organization_id: string; customer_id: string | null; inquiry_id: string | null; deal_id: string | null; user_id: string | null;
  activity_type: ActivityType; occurred_at: Date; content: string; result: string | null; next_action_on: DateString | null;
  memo: string | null; created_at: Date; updated_at: Date;
};
export type SaleRow = { id: string; organization_id: string; deal_id: string; customer_id: string; owner_id: string | null; amount: number; recognized_on: DateString };
export type CounterRow = { organization_id: string; kind: string; value: number };

export type DemoDataset = {
  organizationId: string;
  staff: Record<StaffKey, string>;
  users: UserRow[];
  organization: OrganizationRow;
  settings: SettingsRow;
  profiles: ProfileRow[];
  members: MemberRow[];
  stages: StageRow[];
  sources: SourceRow[];
  tags: TagRow[];
  customers: CustomerRow[];
  tagRelations: TagRelationRow[];
  inquiries: InquiryRow[];
  deals: DealRow[];
  history: HistoryRow[];
  tasks: TaskRow[];
  activities: ActivityRow[];
  sales: SaleRow[];
  counters: CounterRow[];
};

/** 日本時間の 'YYYY-MM-DD' と時刻から Date */
function jst(date: DateString, hour: number, minute = 0): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`);
}
const HOUR = 3_600_000;
const DAY = 86_400_000;
const roundTo = (value: number, unit: number) => Math.max(unit, Math.round(value / unit) * unit);

export function generateDemoData(opts: { seed: number; now: Date; organizationId: string; mode: DemoMode }): DemoDataset {
  const rng = new Random(opts.seed);
  const ids = new Random(opts.seed ^ 0x5eed); // ID 用（生成の順番が変わっても本体の乱数がずれないように別にする）
  const uuid = () => (opts.mode.kind === "demo" ? crypto.randomUUID() : ids.uuid());
  const now = opts.now;
  const today = toLocalDate(now, TZ);
  const start = addDays(today, -PERIOD_DAYS);
  const org = opts.organizationId;

  // ---- 組織・社員 ----
  const staff = Object.fromEntries(STAFF.map((s) => [s.key, uuid()])) as Record<StaffKey, string>;
  const orgCreated = jst(addDays(start, -400), 10);
  const users: UserRow[] = STAFF.map((s) => ({
    id: staff[s.key],
    email: opts.mode.kind === "showcase" ? s.email : null,
    encrypted_password: opts.mode.kind === "showcase" ? opts.mode.passwordHash : null,
    is_anonymous: opts.mode.kind === "demo",
    created_at: orgCreated,
  }));
  const organization: OrganizationRow = {
    id: org, name: DEMO_COMPANY.name, is_demo: opts.mode.kind === "demo",
    demo_expires_at: opts.mode.kind === "demo" ? opts.mode.expiresAt : null, is_showcase: opts.mode.kind === "showcase", created_at: orgCreated,
  };
  const settings: SettingsRow = {
    organization_id: org, industry: DEMO_COMPANY.industry, timezone: TZ, currency: "JPY", unanswered_hours: 24, quote_follow_days: 7,
    no_contact_days: 30, first_response_target_hours: 24, inquiry_categories: INQUIRY_CATEGORIES, deal_types: DEAL_TYPES,
    priority_labels: { low: "低", medium: "中", high: "高", urgent: "緊急" }, auto_tasks: true,
  };
  const profiles: ProfileRow[] = STAFF.map((s) => ({ id: staff[s.key], display_name: s.name, title: s.title, created_at: orgCreated }));
  const members: MemberRow[] = STAFF.map((s, i) => ({ organization_id: org, user_id: staff[s.key], role: s.role, is_active: true, created_at: new Date(orgCreated.getTime() + i * 1000) }));

  const stageId = Object.fromEntries(STAGES.map((s) => [s.key, uuid()])) as Record<StageKey, string>;
  const stages: StageRow[] = STAGES.map((s, i) => ({
    id: stageId[s.key], organization_id: org, name: s.name, category: s.category, default_probability: s.probability,
    board_column: s.column, marks_quote_submitted: !!s.marksQuote, sort_order: (i + 1) * 10, is_active: true,
  }));
  const stageOf = (key: StageKey) => STAGES.find((s) => s.key === key)!;
  const sourceId = Object.fromEntries(SOURCES.map((s) => [s.key, uuid()])) as Record<SourceKey, string>;
  const sources: SourceRow[] = SOURCES.map((s, i) => ({ id: sourceId[s.key], organization_id: org, name: s.name, sort_order: (i + 1) * 10, is_active: true }));
  const tagId = Object.fromEntries(TAGS.map((t) => [t.key, uuid()])) as Record<string, string>;
  const tags: TagRow[] = TAGS.map((t, i) => ({ id: tagId[t.key], organization_id: org, name: t.name, color: t.color, sort_order: (i + 1) * 10 }));

  const salesStaff = STAFF.filter((s) => s.share > 0);
  const winAcc = Object.fromEntries(STAFF.map((s, i) => [s.key, s.key === "tanaka" ? 0 : 0.35 + (i % 3) * 0.2])) as Record<StaffKey, number>;
  const pickOwner = () => rng.weighted(salesStaff, (s) => s.share);

  // ---- 顧客 ----
  const customers: CustomerRow[] = [];
  const usedCompanyNames = new Set<string>();
  const personName = () => `${rng.pick(SURNAMES)} ${rng.pick(GIVEN_NAMES)}`;
  const phone = () => `0${rng.pick(["3", "45", "44", "48", "47", "42"])}-${rng.int(1000, 9999)}-${rng.int(1000, 9999)}`;
  const companyName = () => {
    for (let i = 0; i < 50; i++) {
      const body = rng.pick(COMPANY_BODY);
      const name = rng.chance(0.6) ? `株式会社${rng.pick(COMPANY_PREFIX)}${body.word}` : `${rng.pick(COMPANY_PREFIX)}${body.word}株式会社`;
      if (!usedCompanyNames.has(name)) {
        usedCompanyNames.add(name);
        return name;
      }
    }
    return `株式会社${rng.pick(COMPANY_PREFIX)}${customers.length + 1}`;
  };
  const makeCustomer = (createdAt: Date, ownerKey: StaffKey | null, forceType?: CustomerType): CustomerRow => {
    const type: CustomerType = forceType ?? (rng.chance(0.88) ? "corporate" : "individual");
    const name = personName();
    const domain = `example-${customers.length + 1}.jp`;
    const row: CustomerRow = {
      id: uuid(), organization_id: org, number: customers.length + 1, type,
      company_name: type === "corporate" ? companyName() : null,
      name, department: type === "corporate" ? rng.pick(DEPARTMENTS) : null, position: type === "corporate" ? rng.pick(POSITIONS) : null,
      phone: phone(), email: type === "corporate" ? `${["info", "sales", "contact", "admin"][rng.int(0, 3)]}@${domain}` : `user${customers.length + 1}@example.com`,
      address: `${rng.pick(PREFECTURES)}${rng.int(1, 5)}-${rng.int(1, 20)}-${rng.int(1, 15)}`,
      owner_id: ownerKey ? staff[ownerKey] : null, rank: null, memo: null, last_contact_at: null,
      created_by: ownerKey ? staff[ownerKey] : staff.admin, created_at: createdAt, updated_at: createdAt,
    };
    customers.push(row);
    return row;
  };
  // 既存の取引先（期間より前から付き合いがある）
  for (let i = 0; i < 24; i++) makeCustomer(jst(addDays(start, -rng.int(60, 700)), 10), pickOwner().key);

  // ---- 問い合わせ・案件・タスク・対応履歴 ----
  const inquiries: InquiryRow[] = [];
  const deals: DealRow[] = [];
  const history: HistoryRow[] = [];
  const tasks: TaskRow[] = [];
  const activities: ActivityRow[] = [];

  const addActivity = (a: Omit<ActivityRow, "id" | "organization_id" | "created_at" | "updated_at" | "memo" | "result" | "next_action_on"> & Partial<Pick<ActivityRow, "result" | "next_action_on" | "memo">>) => {
    if (a.occurred_at.getTime() > now.getTime()) return null;
    const row: ActivityRow = {
      id: uuid(), organization_id: org, result: null, next_action_on: null, memo: null, ...a,
      created_at: a.occurred_at, updated_at: a.occurred_at,
    };
    activities.push(row);
    return row;
  };
  const addTask = (t: Omit<TaskRow, "id" | "organization_id" | "completed_at" | "created_at" | "updated_at" | "memo" | "description" | "start_on" | "is_auto">
    & Partial<Pick<TaskRow, "description" | "start_on" | "memo" | "is_auto">> & { createdAt: Date; doneAt?: Date | null }) => {
    const { createdAt, doneAt, ...rest } = t;
    if (createdAt.getTime() > now.getTime()) return null;
    const row: TaskRow = {
      id: uuid(), organization_id: org, description: null, start_on: null, memo: null, is_auto: false, ...rest,
      completed_at: rest.status === "done" ? (doneAt ?? createdAt) : null, created_at: createdAt, updated_at: doneAt ?? createdAt,
    };
    tasks.push(row);
    return row;
  };

  const businessTime = (date: DateString) => jst(date, rng.int(9, 18), rng.int(0, 59));
  const pickTemplate = () => rng.weighted(TEMPLATES, (t) => t.weight);
  const responseDelayHours = (owner: (typeof STAFF)[number]) => {
    const [lo, hi] = owner.responseHours;
    return lo + (hi - lo) * Math.pow(rng.next(), 1.6);
  };

  /** 案件の流れを「今」まで進める */
  const runDeal = (deal: DealRow, ownerKey: StaffKey, template: InquiryTemplate, sourceWin: number, createdAt: Date) => {
    const owner = STAFF.find((s) => s.key === ownerKey)!;
    const ownerId = staff[ownerKey];
    const winP = Math.min(0.85, owner.winSkill * sourceWin * 0.62);
    // 結果：受注・失注・停滞（途中で動かなくなる）・保留。
    // 受注は担当者ごとに確率を積み上げて1を超えたら受注にする（件数が少なくても担当者ごとの受注率が目安どおりになるように）
    winAcc[ownerKey] += winP;
    const isWin = winAcc[ownerKey] >= 1;
    if (isWin) winAcc[ownerKey] -= 1;
    const outcome: "won" | "lost" | "stall" | "hold" = isWin ? "won" : rng.chance(0.1) ? "hold" : rng.chance(owner.key === "tanaka" ? 0.35 : 0.22) ? "stall" : "lost";
    const lostAt = rng.int(1, 4); // この段階のあとに失注
    const stallAt = rng.int(2, 4);
    const flow: StageKey[] = ["hearing", "prep", "proposed", "quote", "review"];
    let t = createdAt.getTime();
    let current: StageKey = "hearing";
    let lastTouch = createdAt;
    const touch = (d: Date) => {
      if (d.getTime() <= now.getTime() && d.getTime() > lastTouch.getTime()) lastTouch = d;
    };
    const move = (to: StageKey, at: number) => {
      history.push({ organization_id: org, deal_id: deal.id, from_stage_id: current === to ? null : stageId[current], to_stage_id: stageId[to], changed_by: ownerId, changed_at: new Date(at) });
      current = to;
    };
    history.push({ organization_id: org, deal_id: deal.id, from_stage_id: null, to_stage_id: stageId.hearing, changed_by: ownerId, changed_at: createdAt });

    // ヒアリング
    const hearingAt = new Date(t + rng.int(1, 5) * DAY + rng.int(-3, 3) * HOUR);
    const hearing = addActivity({
      customer_id: deal.customer_id, inquiry_id: deal.inquiry_id, deal_id: deal.id, user_id: ownerId,
      activity_type: rng.pick(["online_meeting", "visit", "meeting"] as ActivityType[]), occurred_at: hearingAt,
      content: `ヒアリングを実施。現状の課題・予算・導入時期を確認しました。（${template.category}）`,
      result: rng.pick(["要件を整理して提案へ", "提案書の作成に進む", "関係者を交えて再度打ち合わせ"]),
    });
    if (hearing) touch(hearing.occurred_at);
    addTask({
      title: `ヒアリングの日程調整：${deal.title}`, assignee_id: ownerId, customer_id: deal.customer_id, inquiry_id: deal.inquiry_id, deal_id: deal.id,
      priority: "high", status: hearingAt.getTime() <= now.getTime() ? "done" : "todo", due_on: toLocalDate(new Date(createdAt.getTime() + 2 * DAY), TZ),
      start_on: toLocalDate(createdAt, TZ), is_auto: !!deal.inquiry_id, created_by: ownerId, createdAt, doneAt: hearingAt.getTime() <= now.getTime() ? hearingAt : null,
    });

    let stopped = false;
    for (let i = 1; i < flow.length; i++) {
      if (outcome === "lost" && i - 1 === lostAt) break;
      if ((outcome === "stall" || outcome === "hold") && i === stallAt) {
        stopped = true;
        break;
      }
      const step = flow[i];
      const durationDays = step === "prep" ? rng.int(2, 8) : step === "proposed" ? rng.int(3, 9) : step === "quote" ? rng.int(2, 8) : rng.int(2, 6);
      const at = Math.max(t + durationDays * DAY, hearingAt.getTime() + HOUR);
      if (at > now.getTime()) {
        stopped = true;
        break;
      }
      t = at;
      move(step, t);
      if (step === "proposed") {
        const a = addActivity({
          customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id, user_id: ownerId, activity_type: rng.chance(0.6) ? "meeting" : "online_meeting",
          occurred_at: new Date(t), content: "提案書をもとに打ち合わせ。進め方とスケジュール案を説明しました。", result: rng.pick(["前向きに検討いただける", "社内で共有いただく", "見積の提出を依頼された"]),
        });
        if (a) touch(a.occurred_at);
        addTask({
          title: `提案書の作成：${deal.title}`, assignee_id: ownerId, customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id,
          priority: "medium", status: "done", due_on: toLocalDate(new Date(t), TZ), created_by: ownerId, createdAt: new Date(t - 4 * DAY), doneAt: new Date(t - DAY),
        });
      }
      if (step === "quote") {
        deal.quote_submitted_on = toLocalDate(new Date(t), TZ);
        const a = addActivity({
          customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id, user_id: ownerId, activity_type: "quote", occurred_at: new Date(t),
          content: `見積書（${deal.estimated_amount.toLocaleString("ja-JP")}円）を提出しました。`, result: "回答待ち",
        });
        if (a) touch(a.occurred_at);
        // 見積フォローのタスク（自動作成と同じ形）
        const due = addDays(deal.quote_submitted_on, 7);
        const followed = outcome !== "stall" && t + rng.int(5, 8) * DAY <= now.getTime();
        addTask({
          title: `見積フォロー：${deal.title}`, description: "見積提出から7日後のフォローです。検討状況を確認し、次回の予定を対応履歴に残してください。",
          assignee_id: ownerId, customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id, priority: "high",
          status: followed ? "done" : "todo", due_on: due, is_auto: true, created_by: ownerId, createdAt: new Date(t), doneAt: followed ? new Date(Math.min(now.getTime() - HOUR, t + rng.int(5, 8) * DAY)) : null,
        });
      }
      if (step === "review") {
        const followAt = new Date(t + rng.int(1, 4) * DAY);
        const a = addActivity({
          customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id, user_id: ownerId, activity_type: rng.pick(["call", "email"] as ActivityType[]),
          occurred_at: followAt, content: "検討状況を確認。決裁者の承認待ちとのこと。", result: rng.pick(["来週中に回答予定", "追加の質問に回答する", "条件の調整を相談中"]),
        });
        if (a) touch(a.occurred_at);
      }
    }

    deal.stage_id = stageId[current];
    if (!stopped && outcome === "won") {
      const wonAt = t + rng.int(3, 14) * DAY;
      if (wonAt <= now.getTime()) {
        move("won", wonAt);
        deal.closed_on = toLocalDate(new Date(wonAt), TZ);
        deal.actual_amount = roundTo(deal.estimated_amount * rng.float(0.85, 1.0), 10_000);
        const a = addActivity({
          customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id, user_id: ownerId, activity_type: "meeting", occurred_at: new Date(wonAt),
          content: "ご発注の連絡をいただき、契約内容を確認しました。", result: "受注",
        });
        if (a) touch(a.occurred_at);
        addTask({
          title: `キックオフの準備：${deal.title}`, assignee_id: ownerId, customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id,
          priority: "medium", status: wonAt + 5 * DAY <= now.getTime() ? "done" : "doing", due_on: toLocalDate(new Date(wonAt + 5 * DAY), TZ),
          created_by: ownerId, createdAt: new Date(wonAt), doneAt: wonAt + 5 * DAY <= now.getTime() ? new Date(wonAt + 4 * DAY) : null,
        });
        const workAt = wonAt + rng.int(3, 10) * DAY;
        if (workAt <= now.getTime() && template.dealType !== "保守・運用") {
          move("working", workAt);
          const doneAt = workAt + (template.dealType === "システム開発" ? rng.int(40, 90) : rng.int(15, 50)) * DAY;
          if (doneAt <= now.getTime()) {
            move("completed", doneAt);
            deal.completed_on = toLocalDate(new Date(doneAt), TZ);
            const a2 = addActivity({
              customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id, user_id: ownerId, activity_type: "visit", occurred_at: new Date(doneAt),
              content: "納品・検収が完了しました。運用面のご要望を伺いました。", result: "完了",
            });
            if (a2) touch(a2.occurred_at);
          } else {
            deal.expected_complete_on = toLocalDate(new Date(doneAt), TZ);
          }
        } else if (template.dealType === "保守・運用" && workAt <= now.getTime()) {
          move("completed", workAt);
          deal.completed_on = toLocalDate(new Date(workAt), TZ);
        }
      } else {
        stopped = true;
      }
    } else if (!stopped && outcome === "lost") {
      const lostAtTime = t + rng.int(3, 15) * DAY;
      if (lostAtTime <= now.getTime()) {
        move("lost", lostAtTime);
        deal.closed_on = toLocalDate(new Date(lostAtTime), TZ);
        deal.lost_reason = rng.weighted(LOST_REASON_WEIGHTS, (r) => r.weight).value;
        const a = addActivity({
          customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id, user_id: ownerId, activity_type: rng.pick(["call", "email"] as ActivityType[]),
          occurred_at: new Date(lostAtTime), content: `今回は見送りとのご連絡（理由：${deal.lost_reason}）。`, result: "失注",
        });
        if (a) touch(a.occurred_at);
      } else {
        stopped = true;
      }
    }
    if (outcome === "hold") {
      const holdAt = t + rng.int(2, 10) * DAY;
      if (holdAt <= now.getTime()) {
        move("hold", holdAt);
        deal.memo = `${deal.memo ?? ""}\n\n先方の予算確定まで保留。`.trim();
      }
    }

    // 長く止まったままの案件は「連絡が途絶えた」で失注にしておく（何か月も前の見積が残り続けないように）
    if (outcome === "stall" && stageOf(current).category === "open" && now.getTime() - lastTouch.getTime() > 75 * DAY) {
      const lostAtTime = lastTouch.getTime() + rng.int(40, 60) * DAY;
      move("lost", lostAtTime);
      deal.closed_on = toLocalDate(new Date(lostAtTime), TZ);
      deal.lost_reason = "連絡が途絶えた";
    }
    deal.stage_id = stageId[current];
    const stage = stageOf(current);
    deal.probability = stage.probability;
    if (stage.category === "open" && rng.chance(0.12)) {
      deal.probability_manual = true;
      deal.probability = Math.min(95, Math.max(5, stage.probability + rng.pick([-10, 10, 15, -15])));
    }
    // 進行中で停滞していない案件：直近のフォローと次回予定
    if (stage.category === "open") {
      if (outcome !== "stall") {
        const recent = new Date(Math.max(lastTouch.getTime() + DAY, now.getTime() - rng.int(1, 9) * DAY - rng.int(0, 8) * HOUR));
        if (recent.getTime() < now.getTime() && rng.chance(0.75)) {
          const a = addActivity({
            customer_id: deal.customer_id, inquiry_id: null, deal_id: deal.id, user_id: ownerId, activity_type: rng.pick(["call", "email", "online_meeting"] as ActivityType[]),
            occurred_at: recent, content: "進捗の確認と次回の打ち合わせ日程を調整しました。", result: "継続",
          });
          if (a) touch(a.occurred_at);
        }
        const r = rng.next();
        deal.next_follow_up_on = r < 0.12 ? today : r < 0.2 ? addDays(today, -rng.int(1, 4)) : addDays(today, rng.int(1, 14));
      } else if (rng.chance(0.5)) {
        // 停滞した案件：フォロー予定を入れたまま忘れている
        deal.next_follow_up_on = addDays(toLocalDate(lastTouch, TZ), rng.int(7, 14));
      }
      deal.expected_close_on = addDays(today, rng.int(7, 60));
    }
    deal.updated_at = new Date(Math.max(deal.created_at.getTime(), ...history.filter((h) => h.deal_id === deal.id).map((h) => h.changed_at.getTime())));
  };

  const newDeal = (fields: { customerId: string; inquiryId: string | null; title: string; ownerKey: StaffKey; template: InquiryTemplate; createdAt: Date }): DealRow => {
    const factor = STAFF.find((s) => s.key === fields.ownerKey)?.amountFactor ?? 1;
    const amount = roundTo(rng.float(fields.template.amount[0], fields.template.amount[1]) * factor, fields.template.amount[1] > 1_000_000 ? 50_000 : 10_000);
    const deal: DealRow = {
      id: uuid(), organization_id: org, number: deals.length + 1, customer_id: fields.customerId, inquiry_id: fields.inquiryId,
      title: fields.title, owner_id: staff[fields.ownerKey], deal_type: fields.template.dealType ?? rng.pick(DEAL_TYPES.slice(0, 4)),
      stage_id: stageId.hearing, probability: 20, probability_manual: false, estimated_amount: amount, actual_amount: null,
      started_on: toLocalDate(fields.createdAt, TZ), quote_submitted_on: null, expected_close_on: null, expected_complete_on: null,
      closed_on: null, completed_on: null, revenue_on: null, lost_reason: null, last_contact_at: null, next_follow_up_on: null,
      memo: null, created_by: staff[fields.ownerKey], created_at: fields.createdAt, updated_at: fields.createdAt,
    };
    deals.push(deal);
    return deal;
  };

  // 日ごとに問い合わせを作る（後半ほど少し増える・土日は少ない）
  for (let day = 0; day <= PERIOD_DAYS; day++) {
    const date = addDays(start, day);
    const dow = new Date(`${date}T12:00:00+09:00`).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const rate = (0.75 + 0.55 * (day / PERIOD_DAYS)) * (weekend ? 0.25 : 1.15);
    const count = Math.floor(rate) + (rng.chance(rate - Math.floor(rate)) ? 1 : 0);
    for (let k = 0; k < count; k++) {
      const receivedAt = businessTime(date);
      if (receivedAt.getTime() > now.getTime() - 30 * 60_000) continue;
      const source = rng.weighted(SOURCES, (s) => s.weight);
      const template = source.key === "referral" && rng.chance(0.5) ? TEMPLATES[1] : pickTemplate();
      const ownerProfile = template.category === "保守・運用" && rng.chance(0.5) ? STAFF.find((s) => s.key === "nakamura")! : pickOwner();
      const ownerKey = ownerProfile.key;
      const priority = source.key === "referral" && rng.chance(0.4) ? "high" : rng.weighted(PRIORITY_WEIGHTS, (p) => p.weight).value;
      // 顧客：既存の顧客からの問い合わせ／初めての問い合わせ
      let customer: CustomerRow | null = null;
      const existing = customers.filter((c) => c.created_at < receivedAt);
      if (existing.length > 0 && rng.chance(source.key === "referral" ? 0.3 : 0.38)) customer = rng.pick(existing);
      const isNewContact = !customer;
      const contactType: CustomerType = rng.chance(0.9) ? "corporate" : "individual";
      const contact = customer
        ? { name: customer.name, company: customer.company_name, phone: customer.phone, email: customer.email }
        : { name: personName(), company: contactType === "corporate" ? companyName() : null, phone: phone(), email: `contact${inquiries.length + 1}@example.jp` };
      if (isNewContact && rng.chance(0.25)) {
        // 受付と同時に顧客登録したケース
        customer = makeCustomer(receivedAt, ownerKey, contactType);
        customer.name = contact.name;
        customer.company_name = contact.company ?? (customer.type === "corporate" ? customer.company_name : null);
        customer.phone = contact.phone;
        customer.email = contact.email;
      }
      const title = rng.pick(template.titles);
      const inq: InquiryRow = {
        id: uuid(), organization_id: org, number: inquiries.length + 1, customer_id: customer?.id ?? null, received_at: receivedAt,
        source_id: sourceId[source.key], category: template.category, title, content: rng.pick(template.contents),
        contact_name: contact.name, company_name: contact.company, phone: contact.phone, email: contact.email,
        owner_id: staff[ownerKey], priority, status: "new", next_action_on: null, first_response_at: null, last_activity_at: null,
        converted_deal_id: null, converted_at: null, memo: null, created_by: rng.chance(0.4) ? staff.ito : staff[ownerKey],
        created_at: receivedAt, updated_at: receivedAt,
      };
      inquiries.push(inq);

      // 初回対応
      let delay = responseDelayHours(ownerProfile);
      const ageHours = (now.getTime() - receivedAt.getTime()) / HOUR;
      if (receivedAt.getTime() + delay * HOUR > now.getTime() && ageHours > 20) delay = ageHours * rng.float(0.2, 0.8);
      const firstAt = new Date(receivedAt.getTime() + delay * HOUR);
      if (firstAt.getTime() > now.getTime()) continue; // まだ未対応
      const first = addActivity({
        customer_id: customer?.id ?? null, inquiry_id: inq.id, deal_id: null, user_id: staff[ownerKey], activity_type: rng.pick(FIRST_RESPONSE_TYPES),
        occurred_at: firstAt, content: "お問い合わせのお礼とともに、詳細をヒアリングしました。", result: rng.pick(["打ち合わせの日程を調整", "資料を送付", "要件を確認中", "社内で検討するとのこと"]),
      })!;
      inq.first_response_at = first.occurred_at;
      inq.last_activity_at = first.occurred_at;
      inq.status = "in_progress";

      // 案件化するか
      const convertP = Math.min(0.92, source.convert * template.convert * (ownerKey === "tanaka" ? 0.85 : 1));
      const convertAt = new Date(firstAt.getTime() + rng.int(6, 96) * HOUR);
      if (template.category !== "その他" || rng.chance(0.3)) {
        if (rng.chance(convertP) && convertAt.getTime() <= now.getTime()) {
          if (!customer) {
            customer = makeCustomer(convertAt, ownerKey, contact.company ? "corporate" : "individual");
            customer.name = contact.name;
            if (contact.company) customer.company_name = contact.company;
            customer.phone = contact.phone;
            customer.email = contact.email;
            inq.customer_id = customer.id;
            first.customer_id = customer.id;
          }
          const companyLabel = (customer.company_name ?? customer.name ?? "").replace(/株式会社/g, "").trim();
          const deal = newDeal({ customerId: customer.id, inquiryId: inq.id, title: `${companyLabel} ${title}`.slice(0, 100), ownerKey, template, createdAt: convertAt });
          inq.status = "converted";
          inq.converted_deal_id = deal.id;
          inq.converted_at = convertAt;
          inq.updated_at = convertAt;
          first.deal_id = deal.id; // 案件化で対応履歴を引き継ぐ
          runDeal(deal, ownerKey, template, source.win, convertAt);
          continue;
        }
      }
      // 案件化しなかった問い合わせ
      const age = (now.getTime() - firstAt.getTime()) / DAY;
      if (template.category === "その他" && rng.chance(0.5)) {
        inq.status = "not_needed";
      } else if (template.category === "資料請求" && age > 3) {
        inq.status = rng.chance(0.7) ? "closed" : "on_hold";
        addTask({
          title: `資料の送付：${contact.company ?? contact.name}`, assignee_id: staff[ownerKey], customer_id: customer?.id ?? null, inquiry_id: inq.id, deal_id: null,
          priority: "medium", status: "done", due_on: toLocalDate(new Date(firstAt.getTime() + DAY), TZ), created_by: staff[ownerKey], createdAt: firstAt,
          doneAt: new Date(firstAt.getTime() + 6 * HOUR),
        });
      } else if (age > 10) {
        inq.status = rng.chance(0.65) ? "closed" : rng.chance(0.5) ? "on_hold" : "not_needed";
        if (inq.status === "on_hold") inq.next_action_on = addDays(today, rng.int(-3, 30));
      } else {
        inq.status = "in_progress";
        inq.next_action_on = addDays(today, rng.int(-2, 7));
        addTask({
          title: `折り返しの連絡：${contact.company ?? contact.name}`, assignee_id: staff[ownerKey], customer_id: customer?.id ?? null, inquiry_id: inq.id, deal_id: null,
          priority: inq.priority === "urgent" ? "urgent" : "medium", status: "todo", due_on: inq.next_action_on, created_by: staff[ownerKey], createdAt: firstAt,
        });
      }
    }
  }

  // 未対応の問い合わせ（必ず含める：24時間を超えたもの3件・受付直後2件・未割当1件）
  const unanswered: { hoursAgo: number; priority: Priority; owner: StaffKey | null; template: number; source: SourceKey }[] = [
    { hoursAgo: 52, priority: "high", owner: "tanaka", template: 0, source: "web" },
    { hoursAgo: 31, priority: "urgent", owner: "tanaka", template: 3, source: "phone" },
    { hoursAgo: 27, priority: "medium", owner: "member", template: 4, source: "email" },
    { hoursAgo: 5, priority: "high", owner: null, template: 1, source: "web" },
    { hoursAgo: 1.5, priority: "medium", owner: "member", template: 2, source: "sns" },
  ];
  for (const u of unanswered) {
    const template = TEMPLATES[u.template];
    const receivedAt = new Date(now.getTime() - u.hoursAgo * HOUR);
    const company = companyName();
    inquiries.push({
      id: uuid(), organization_id: org, number: inquiries.length + 1, customer_id: null, received_at: receivedAt, source_id: sourceId[u.source],
      category: template.category, title: rng.pick(template.titles), content: rng.pick(template.contents), contact_name: personName(), company_name: company,
      phone: phone(), email: `info@new-${inquiries.length + 1}.example.jp`, owner_id: u.owner ? staff[u.owner] : null, priority: u.priority, status: "new",
      next_action_on: null, first_response_at: null, last_activity_at: null, converted_deal_id: null, converted_at: null, memo: null,
      created_by: staff.ito, created_at: receivedAt, updated_at: receivedAt,
    });
  }
  // 受付から時間が経っていない（20時間以内）未対応はそのまま。それ以外の未対応は上の5件だけにする
  for (const inq of inquiries) {
    if (inq.status === "new" && now.getTime() - inq.received_at.getTime() > 20 * HOUR && !unanswered.some((u) => Math.abs(now.getTime() - u.hoursAgo * HOUR - inq.received_at.getTime()) < 1000)) {
      inq.status = "in_progress";
    }
  }
  inquiries.sort((a, b) => a.received_at.getTime() - b.received_at.getTime());
  inquiries.forEach((inq, i) => (inq.number = i + 1));

  // 既存の取引先からの直接の案件（問い合わせを経由しない）
  const existingCustomers = customers.slice(0, 24);
  for (let i = 0; i < 9; i++) {
    const c = existingCustomers[i * 2];
    const ownerKey = (c.owner_id ? STAFF.find((s) => staff[s.key] === c.owner_id)?.key : null) ?? "manager";
    const template = TEMPLATES[rng.pick([0, 1, 3, 3])];
    const createdAt = businessTime(addDays(start, rng.int(5, PERIOD_DAYS - 20)));
    const companyLabel = (c.company_name ?? c.name ?? "").replace(/株式会社/g, "").trim();
    const deal = newDeal({ customerId: c.id, inquiryId: null, title: `${companyLabel} ${template.dealType === "保守・運用" ? "保守契約の更新" : "追加開発のご相談"}`, ownerKey, template, createdAt });
    deal.deal_type = template.dealType === "保守・運用" ? "保守・運用" : "その他";
    runDeal(deal, ownerKey, template, 1.3, createdAt);
  }
  deals.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  deals.forEach((d, i) => (d.number = i + 1));

  // 既存の取引先には、期間より前の接触を1件残す（長く連絡していない顧客が分かるように）
  for (const c of existingCustomers) {
    addActivity({
      customer_id: c.id, inquiry_id: null, deal_id: null, user_id: c.owner_id, activity_type: rng.pick(["visit", "meeting", "call"] as ActivityType[]),
      occurred_at: new Date(c.created_at.getTime() + rng.int(10, 50) * DAY), content: "定例の訪問。運用状況と今後の計画を伺いました。", result: "継続取引",
    });
  }

  // 一般のタスク（社内）と、今日・今週が期限のタスク
  const generic = ["週次の営業会議の資料作成", "問い合わせフォームの文言見直し", "導入事例の原稿確認", "展示会の出展準備", "提案テンプレートの更新", "月次の売上報告"];
  for (let i = 0; i < 14; i++) {
    const assignee = pickOwner().key;
    const due = addDays(today, rng.int(-40, 12));
    const createdAt = jst(addDays(due, -rng.int(3, 14)), 9);
    const done = due < today ? true : rng.chance(0.15);
    addTask({
      title: rng.pick(generic), assignee_id: staff[assignee], customer_id: null, inquiry_id: null, deal_id: null, priority: rng.pick(["low", "medium", "medium", "high"] as Priority[]),
      status: done ? "done" : rng.pick(["todo", "doing"] as TaskStatus[]), due_on: due, created_by: staff.manager, createdAt,
      doneAt: done ? new Date(Math.min(now.getTime() - HOUR, jst(due, 17).getTime())) : null,
    });
  }
  const openDeals = deals.filter((d) => stageOf(STAGES.find((s) => stageId[s.key] === d.stage_id)!.key).category === "open");
  const todayTitles = ["見積の再提出", "打ち合わせ資料の準備", "契約書のドラフト送付", "デモ環境の準備", "決裁者への説明資料"];
  openDeals.slice(0, 8).forEach((d, i) => {
    addTask({
      title: `${todayTitles[i % todayTitles.length]}：${d.title}`.slice(0, 100), assignee_id: d.owner_id, customer_id: d.customer_id, inquiry_id: null, deal_id: d.id,
      priority: i % 3 === 0 ? "high" : "medium", status: i % 4 === 0 ? "doing" : "todo", due_on: i < 4 ? today : addDays(today, rng.int(1, 5)),
      created_by: d.owner_id, createdAt: new Date(now.getTime() - rng.int(1, 5) * DAY),
    });
  });

  // 期限超過のタスク（7件）：期限が過ぎていて完了していないものを、進行中の案件のタスクから選んで残す
  // （うち1件は一般担当者のデモで見えるように、あとで担当者「member」に必ず作る）
  const overdueTarget = 6;
  const pastDue = tasks.filter((t) => t.due_on && t.due_on < today);
  const candidates = pastDue.filter((t) => (t.deal_id !== null && openDeals.some((d) => d.id === t.deal_id)) || (!t.deal_id && !t.inquiry_id));
  const keepOpen = new Set(candidates.sort((a, b) => (b.due_on as string).localeCompare(a.due_on as string)).slice(0, overdueTarget).map((t) => t.id));
  for (const t of pastDue) {
    if (keepOpen.has(t.id)) {
      t.status = rng.chance(0.5) ? "todo" : "doing";
      t.completed_at = null;
      t.updated_at = t.created_at;
    } else if (t.status !== "done") {
      t.status = "done";
      t.completed_at = new Date(Math.min(now.getTime() - HOUR, jst(t.due_on as string, 18).getTime()));
      t.updated_at = t.completed_at;
    }
  }
  if (keepOpen.size < overdueTarget) {
    for (let i = keepOpen.size; i < overdueTarget; i++) {
      const d = openDeals[(i * 3) % Math.max(1, openDeals.length)];
      const due = addDays(today, -rng.int(1, 9));
      addTask({
        title: `ご提案内容の再確認：${d?.title ?? "社内タスク"}`.slice(0, 100), assignee_id: d?.owner_id ?? staff.tanaka, customer_id: d?.customer_id ?? null, inquiry_id: null,
        deal_id: d?.id ?? null, priority: i % 2 === 0 ? "high" : "medium", status: "todo", due_on: due, created_by: staff.manager, createdAt: jst(addDays(due, -5), 10),
      });
    }
  }

  // 一般担当者として体験したときにも「今日やること」「期限超過」が見えるように
  const memberDeal = openDeals.find((d) => d.owner_id === staff.member);
  addTask({
    title: `議事録の共有：${memberDeal?.title ?? "週次の営業会議"}`.slice(0, 100), assignee_id: staff.member, customer_id: memberDeal?.customer_id ?? null, inquiry_id: null,
    deal_id: memberDeal?.id ?? null, priority: "high", status: "todo", due_on: addDays(today, -2), created_by: staff.member, createdAt: jst(addDays(today, -6), 10),
  });
  addTask({
    title: "週次の営業会議の資料作成", assignee_id: staff.member, customer_id: null, inquiry_id: null, deal_id: null, priority: "medium", status: "doing",
    due_on: today, created_by: staff.manager, createdAt: jst(addDays(today, -3), 10),
  });

  // ---- 導出する値（最終接触日・売上・ランク・タグ）----
  const lastActivity = (pred: (a: ActivityRow) => boolean) =>
    activities.filter(pred).reduce<Date | null>((m, a) => (!m || a.occurred_at > m ? a.occurred_at : m), null);
  const firstActivity = (pred: (a: ActivityRow) => boolean) =>
    activities.filter(pred).reduce<Date | null>((m, a) => (!m || a.occurred_at < m ? a.occurred_at : m), null);
  for (const c of customers) {
    c.last_contact_at = lastActivity((a) => a.customer_id === c.id);
    c.updated_at = new Date(Math.max(c.created_at.getTime(), c.last_contact_at?.getTime() ?? 0));
  }
  for (const d of deals) d.last_contact_at = lastActivity((a) => a.deal_id === d.id);
  for (const inq of inquiries) {
    inq.first_response_at = firstActivity((a) => a.inquiry_id === inq.id);
    inq.last_activity_at = lastActivity((a) => a.inquiry_id === inq.id);
  }
  // 対応履歴の顧客を、問い合わせ・案件の顧客に揃える（トリガー fill_customer と同じ）
  for (const a of activities) {
    if (a.customer_id) continue;
    a.customer_id = (a.deal_id && deals.find((d) => d.id === a.deal_id)?.customer_id) || (a.inquiry_id && inquiries.find((i) => i.id === a.inquiry_id)?.customer_id) || null;
  }
  for (const t of tasks) {
    if (t.customer_id) continue;
    t.customer_id = (t.deal_id && deals.find((d) => d.id === t.deal_id)?.customer_id) || (t.inquiry_id && inquiries.find((i) => i.id === t.inquiry_id)?.customer_id) || null;
  }

  const categoryOf = (d: DealRow) => STAGES.find((s) => stageId[s.key] === d.stage_id)!.category;
  const sales: SaleRow[] = deals
    .filter((d) => categoryOf(d) === "won" || categoryOf(d) === "completed")
    .map((d) => ({
      id: uuid(), organization_id: org, deal_id: d.id, customer_id: d.customer_id, owner_id: d.owner_id,
      amount: d.actual_amount ?? d.estimated_amount, recognized_on: (d.revenue_on ?? d.completed_on ?? d.closed_on) as DateString,
    }));

  const revenueByCustomer = new Map<string, number>();
  for (const s of sales) revenueByCustomer.set(s.customer_id, (revenueByCustomer.get(s.customer_id) ?? 0) + s.amount);
  const ranked = [...revenueByCustomer.entries()].sort((a, b) => b[1] - a[1]);
  const vip = new Set(ranked.slice(0, 5).map(([id]) => id));
  const tagRelations: TagRelationRow[] = [];
  const tag = (customerId: string, key: string) => tagRelations.push({ organization_id: org, customer_id: customerId, tag_id: tagId[key] });
  for (const c of customers) {
    const revenue = revenueByCustomer.get(c.id) ?? 0;
    c.rank = revenue >= 3_000_000 ? "S" : revenue >= 1_000_000 ? "A" : revenue > 0 ? "B" : c.created_at < jst(start, 0) ? "B" : "C";
    const open = deals.some((d) => d.customer_id === c.id && categoryOf(d) === "open");
    const dormantDays = c.last_contact_at ? diffDays(toLocalDate(c.last_contact_at, TZ), today) : 999;
    if (vip.has(c.id)) tag(c.id, "vip");
    if (revenue > 0 || c.created_at < jst(start, 0)) tag(c.id, "existing");
    else if (diffDays(toLocalDate(c.created_at, TZ), today) <= 60) tag(c.id, "new");
    if (open) tag(c.id, "prospect");
    if (dormantDays >= 90 && !open) tag(c.id, "dormant");
    if (open && dormantDays >= 30) tag(c.id, "follow");
    if (vip.has(c.id)) c.memo = "主要取引先。決裁は経営企画室経由。";
  }

  const counters: CounterRow[] = [
    { organization_id: org, kind: "customers", value: customers.length },
    { organization_id: org, kind: "inquiries", value: inquiries.length },
    { organization_id: org, kind: "deals", value: deals.length },
  ];

  // 確度の整合（受注は100%・失注は0%。受注見込金額は DB の生成列が計算する）
  for (const d of deals) {
    const cat = categoryOf(d);
    if (cat === "won" || cat === "completed") d.probability = 100;
    if (cat === "lost") d.probability = 0;
    if (cat !== "open") d.probability_manual = false;
  }

  return {
    organizationId: org, staff, users, organization, settings, profiles, members, stages, sources, tags, customers, tagRelations,
    inquiries, deals, history: history.sort((a, b) => a.changed_at.getTime() - b.changed_at.getTime()), tasks, activities, sales, counters,
  };
}
