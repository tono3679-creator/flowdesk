import { describe, expect, it } from "vitest";
import {
  buildTodayList, countByKind, DEFAULT_ALERT_RULES, detectAlerts, isDormant, isOverdue, isUnanswered, needsQuoteFollow, type AlertInput,
} from "@/lib/domain/alerts";

const TZ = "Asia/Tokyo";
const NOW = new Date("2026-11-13T10:00:00+09:00");
const TODAY = "2026-11-13";
const empty: AlertInput = { inquiries: [], deals: [], tasks: [] };

describe("未対応（24時間）", () => {
  it("ちょうど24時間で対象。23時間59分は対象外", () => {
    expect(isUnanswered({ status: "new", receivedAt: new Date("2026-11-12T10:00:00+09:00") }, NOW, 24)).toBe(true);
    expect(isUnanswered({ status: "new", receivedAt: new Date("2026-11-12T10:01:00+09:00") }, NOW, 24)).toBe(false);
  });
  it("対応中・保留などは対象外", () => {
    expect(isUnanswered({ status: "in_progress", receivedAt: new Date("2026-11-01T10:00:00+09:00") }, NOW, 24)).toBe(false);
    expect(isUnanswered({ status: "on_hold", receivedAt: new Date("2026-11-01T10:00:00+09:00") }, NOW, 24)).toBe(false);
  });
});

describe("見積フォロー（7日）", () => {
  it("見積提出から7日で対象。6日は対象外。受注・失注・保留は対象外", () => {
    expect(needsQuoteFollow({ category: "open", quoteSubmittedOn: "2026-11-06" }, TODAY, 7)).toBe(true);
    expect(needsQuoteFollow({ category: "open", quoteSubmittedOn: "2026-11-07" }, TODAY, 7)).toBe(false);
    expect(needsQuoteFollow({ category: "won", quoteSubmittedOn: "2026-10-01" }, TODAY, 7)).toBe(false);
    expect(needsQuoteFollow({ category: "hold", quoteSubmittedOn: "2026-10-01" }, TODAY, 7)).toBe(false);
    expect(needsQuoteFollow({ category: "open", quoteSubmittedOn: null }, TODAY, 7)).toBe(false);
  });
});

describe("長期未接触（30日）", () => {
  it("最終接触から30日で対象（日本時間の日付で数える）", () => {
    expect(isDormant({ category: "open", lastContactAt: new Date("2026-10-14T23:30:00+09:00"), createdAt: new Date("2026-09-01") }, TODAY, 30, TZ)).toBe(true);
    expect(isDormant({ category: "open", lastContactAt: new Date("2026-10-15T00:30:00+09:00"), createdAt: new Date("2026-09-01") }, TODAY, 30, TZ)).toBe(false);
  });
  it("接触が一度もなければ作成日から数える", () => {
    expect(isDormant({ category: "open", lastContactAt: null, createdAt: new Date("2026-10-01T09:00:00+09:00") }, TODAY, 30, TZ)).toBe(true);
    expect(isDormant({ category: "open", lastContactAt: null, createdAt: new Date("2026-11-01T09:00:00+09:00") }, TODAY, 30, TZ)).toBe(false);
  });
});

describe("タスクの期限超過", () => {
  it("期限日の当日中は期限内、翌日から超過。完了済みは対象外", () => {
    expect(isOverdue({ status: "todo", dueOn: "2026-11-13" }, TODAY)).toBe(false);
    expect(isOverdue({ status: "todo", dueOn: "2026-11-12" }, TODAY)).toBe(true);
    expect(isOverdue({ status: "done", dueOn: "2026-11-01" }, TODAY)).toBe(false);
    expect(isOverdue({ status: "doing", dueOn: null }, TODAY)).toBe(false);
  });
  it("日本時間 23:59 はまだ当日（UTC では翌日になっていても）", () => {
    const late = new Date("2026-11-13T23:59:00+09:00");
    const alerts = detectAlerts({ ...empty, tasks: [{ id: "t", title: "t", status: "todo", priority: "medium", dueOn: "2026-11-13", assigneeId: null }] }, DEFAULT_ALERT_RULES, late, TZ);
    expect(alerts).toHaveLength(0);
    const next = new Date("2026-11-14T00:00:00+09:00");
    expect(detectAlerts({ ...empty, tasks: [{ id: "t", title: "t", status: "todo", priority: "medium", dueOn: "2026-11-13", assigneeId: null }] }, DEFAULT_ALERT_RULES, next, TZ)).toHaveLength(1);
  });
});

describe("アラートの検出と並び順", () => {
  const input: AlertInput = {
    inquiries: [
      { id: "i1", title: "LP制作", status: "new", priority: "high", receivedAt: new Date("2026-11-11T10:00:00+09:00"), ownerId: "u1", nextActionOn: null },
      { id: "i2", title: "相談", status: "new", priority: "low", receivedAt: new Date("2026-11-12T08:00:00+09:00"), ownerId: null, nextActionOn: null },
      { id: "i3", title: "見積依頼", status: "in_progress", priority: "medium", receivedAt: new Date("2026-11-01T10:00:00+09:00"), ownerId: "u1", nextActionOn: "2026-11-10" },
    ],
    deals: [
      { id: "d1", title: "システム開発", category: "open", ownerId: "u1", quoteSubmittedOn: "2026-11-04", lastContactAt: new Date("2026-11-05T10:00:00+09:00"), createdAt: new Date("2026-10-01"), nextFollowUpOn: null },
      { id: "d2", title: "保守契約", category: "open", ownerId: "u2", quoteSubmittedOn: null, lastContactAt: new Date("2026-09-30T10:00:00+09:00"), createdAt: new Date("2026-09-01"), nextFollowUpOn: "2026-11-13" },
      { id: "d3", title: "受注済み", category: "won", ownerId: "u2", quoteSubmittedOn: "2026-10-01", lastContactAt: null, createdAt: new Date("2026-08-01"), nextFollowUpOn: "2026-10-01" },
    ],
    tasks: [
      { id: "t1", title: "提案書", status: "todo", priority: "urgent", dueOn: "2026-11-10", assigneeId: "u1" },
      { id: "t2", title: "資料送付", status: "doing", priority: "low", dueOn: "2026-11-13", assigneeId: "u1" },
      { id: "t3", title: "完了済み", status: "done", priority: "high", dueOn: "2026-11-01", assigneeId: "u1" },
    ],
  };

  it("仕様どおりの文言で検出する", () => {
    const alerts = detectAlerts(input, DEFAULT_ALERT_RULES, NOW, TZ);
    const msg = (id: string, kind: string) => alerts.find((a) => a.targetId === id && a.kind === kind)?.message;
    expect(msg("i1", "unanswered")).toBe("問い合わせから24時間以上未対応です（受付から2日）");
    expect(msg("i2", "unanswered")).toBe("問い合わせから24時間以上未対応です（受付から26時間）");
    expect(msg("d1", "quote_follow")).toBe("見積提出から9日経過しています。フォローを推奨します。");
    expect(msg("d2", "no_contact")).toBe("30日以上顧客との接触がありません（最終接触から44日）。");
    expect(msg("t1", "task_overdue")).toBe("期限を3日過ぎています");
    expect(msg("i3", "follow_up_due")).toBe("次回対応予定日を3日過ぎています");
    expect(msg("d2", "follow_up_due")).toBe("今日が次回フォロー日です");
    expect(alerts.some((a) => a.targetId === "d3" || a.targetId === "t3" || a.targetId === "t2")).toBe(false);
    expect(countByKind(alerts)).toMatchObject({ unanswered: 2, quote_follow: 1, no_contact: 1, task_overdue: 1, follow_up_due: 2 });
  });

  it("重要度の高い順 → 遅れの大きい順に並ぶ（優先度が高い未対応・期限超過は「至急」）", () => {
    const alerts = detectAlerts(input, DEFAULT_ALERT_RULES, NOW, TZ);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts.slice(0, 2).map((a) => a.targetId).sort()).toEqual(["i1", "t1"]);
    for (let i = 1; i < alerts.length; i++) {
      const order = { critical: 0, high: 1, medium: 2 };
      expect(order[alerts[i - 1].severity]).toBeLessThanOrEqual(order[alerts[i].severity]);
    }
  });

  it("条件の時間・日数を変えると結果が変わる", () => {
    const strict = detectAlerts(input, { unansweredHours: 48, quoteFollowDays: 10, noContactDays: 60 }, NOW, TZ);
    expect(countByKind(strict)).toMatchObject({ unanswered: 1, quote_follow: 0, no_contact: 0 });
  });

  it("今日やること：アラートに今日が期限のタスクを加える", () => {
    const today = buildTodayList(input, DEFAULT_ALERT_RULES, NOW, TZ);
    expect(today.find((a) => a.targetId === "t2")).toMatchObject({ kind: "task_due_today", message: "今日が期限です" });
    expect(today.length).toBe(detectAlerts(input, DEFAULT_ALERT_RULES, NOW, TZ).length + 1);
  });
});
