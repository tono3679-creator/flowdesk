import { describe, expect, it } from "vitest";
import { expectedRevenue, probabilityFor, sum, wonAmount } from "@/lib/domain/money";

describe("受注見込金額 = 見積金額 × 受注確度", () => {
  it("基本の計算", () => {
    expect(expectedRevenue(1_000_000, 60)).toBe(600_000);
    expect(expectedRevenue(1_234_567, 30)).toBe(370_370); // 370,370.1 → 四捨五入
    expect(expectedRevenue(999, 50)).toBe(500); // 499.5 → 500（四捨五入）
  });
  it("0円・0%・100%", () => {
    expect(expectedRevenue(0, 80)).toBe(0);
    expect(expectedRevenue(5_000_000, 0)).toBe(0);
    expect(expectedRevenue(5_000_000, 100)).toBe(5_000_000);
  });
  it("範囲外・不正な値は安全側に丸める", () => {
    expect(expectedRevenue(1_000, 150)).toBe(1_000);
    expect(expectedRevenue(1_000, -10)).toBe(0);
    expect(expectedRevenue(-500, 50)).toBe(0);
    expect(expectedRevenue(Number.NaN, 50)).toBe(0);
    expect(expectedRevenue(1_000, Number.POSITIVE_INFINITY)).toBe(0);
  });
  it("大きな金額でも誤差が出ない（DB の round(estimated_amount * probability / 100.0) と同じ）", () => {
    expect(expectedRevenue(99_999_999_999, 33)).toBe(Math.round((99_999_999_999 * 33) / 100));
    expect(expectedRevenue(12_345_678, 45)).toBe(5_555_555);
  });
});

describe("ステータスを変えたときの確度", () => {
  it("受注・完了は100%、失注は0%", () => {
    expect(probabilityFor("won", 100, { probability: 40, manual: true })).toBe(100);
    expect(probabilityFor("completed", 100, { probability: 40, manual: false })).toBe(100);
    expect(probabilityFor("lost", 0, { probability: 70, manual: true })).toBe(0);
  });
  it("手動で決めた確度は保つ。そうでなければステータスの既定値", () => {
    expect(probabilityFor("open", 60, { probability: 45, manual: true })).toBe(45);
    expect(probabilityFor("open", 60, { probability: 45, manual: false })).toBe(60);
    expect(probabilityFor("hold", 10, { probability: 45, manual: false })).toBe(10);
  });
});

describe("受注金額", () => {
  it("受注金額が空なら見積金額", () => {
    expect(wonAmount({ actualAmount: null, estimatedAmount: 800_000 })).toBe(800_000);
    expect(wonAmount({ actualAmount: 750_000, estimatedAmount: 800_000 })).toBe(750_000);
    expect(wonAmount({ actualAmount: 0, estimatedAmount: 800_000 })).toBe(0);
  });
  it("合計", () => {
    expect(sum([])).toBe(0);
    expect(sum([1, 2, 3])).toBe(6);
  });
});
