import { describe, expect, it } from "vitest";
import {
  addDays, addMonths, diffDays, endOfMonth, hoursBetween, inPeriod, inPeriodAt, isDateString, monthRange, startOfWeek, toLocalDate,
} from "@/lib/domain/dates";

describe("タイムゾーン（日本時間の暦日）", () => {
  it("UTC 14:59 は同じ日、15:00 は日本時間の翌日", () => {
    expect(toLocalDate(new Date("2026-10-31T14:59:59Z"))).toBe("2026-10-31");
    expect(toLocalDate(new Date("2026-10-31T15:00:00Z"))).toBe("2026-11-01");
  });
  it("月末・年末をまたぐ境界", () => {
    expect(toLocalDate(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
    expect(toLocalDate(new Date("2026-12-31T14:59:59.999Z"))).toBe("2026-12-31");
  });
  it("別のタイムゾーンを指定できる", () => {
    expect(toLocalDate(new Date("2026-11-01T02:00:00Z"), "America/Los_Angeles")).toBe("2026-10-31");
  });
  it("期間の判定も日本時間（11月1日 0:30 JST は11月）", () => {
    const nov = { from: "2026-11-01", to: "2026-11-30" };
    expect(inPeriodAt(new Date("2026-10-31T15:30:00Z"), nov)).toBe(true);
    expect(inPeriodAt(new Date("2026-10-31T14:30:00Z"), nov)).toBe(false);
    expect(inPeriodAt(null, nov)).toBe(false);
  });
});

describe("日付の計算", () => {
  it("日付の妥当性", () => {
    expect(isDateString("2028-02-29")).toBe(true);
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2026-13-01")).toBe(false);
    expect(isDateString("2026/11/01")).toBe(false);
  });
  it("addDays：月末・うるう年", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("diffDays：期限との差（過ぎたら負）", () => {
    expect(diffDays("2026-11-13", "2026-11-13")).toBe(0);
    expect(diffDays("2026-11-13", "2026-11-10")).toBe(-3);
    expect(diffDays("2026-12-25", "2027-01-05")).toBe(11);
  });
  it("addMonths・endOfMonth", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-15", -2)).toBe("2025-11-01");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2026-12-01")).toBe("2026-12-31");
  });
  it("週の始まりは月曜日", () => {
    expect(startOfWeek("2026-11-13")).toBe("2026-11-09"); // 金曜 → 月曜
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09"); // 日曜 → 前の月曜
    expect(startOfWeek("2026-11-09")).toBe("2026-11-09");
  });
  it("monthRange・inPeriod（両端を含む）", () => {
    expect(monthRange("2026-10-15", "2027-01-03")).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
    const p = { from: "2026-11-01", to: "2026-11-30" };
    expect(inPeriod("2026-11-01", p)).toBe(true);
    expect(inPeriod("2026-11-30", p)).toBe(true);
    expect(inPeriod("2026-12-01", p)).toBe(false);
    expect(inPeriod(null, p)).toBe(false);
  });
  it("hoursBetween", () => {
    expect(hoursBetween(new Date("2026-11-12T09:00:00+09:00"), new Date("2026-11-13T09:00:00+09:00"))).toBe(24);
  });
});
