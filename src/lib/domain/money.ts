/** 金額の計算（円・整数）。DB の生成列 deals.expected_revenue と同じ式 */

/** 受注見込金額 = 見積金額 × 受注確度 ÷ 100（円未満は四捨五入。金額・確度が範囲外なら 0 として扱う） */
export function expectedRevenue(estimatedAmount: number, probability: number): number {
  if (!Number.isFinite(estimatedAmount) || !Number.isFinite(probability)) return 0;
  const amount = Math.max(0, Math.trunc(estimatedAmount));
  const p = Math.min(100, Math.max(0, Math.trunc(probability)));
  // 整数で計算してから割る（浮動小数点の誤差を避ける）。正の数なので Math.round は四捨五入と同じ
  return Math.round((amount * p) / 100);
}

/** ステータスを変えたときの確度（DB のトリガー deal_stage_rules と同じ考え方） */
export function probabilityFor(
  category: "open" | "won" | "completed" | "lost" | "hold",
  stageDefault: number,
  current: { probability: number; manual: boolean },
): number {
  if (category === "won" || category === "completed") return 100;
  if (category === "lost") return 0;
  return current.manual ? current.probability : stageDefault;
}

/** 売上として数える金額（受注金額が空なら見積金額） */
export function wonAmount(deal: { actualAmount: number | null; estimatedAmount: number }): number {
  return deal.actualAmount ?? deal.estimatedAmount;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
