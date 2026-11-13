"use client";
/**
 * グラフの部品（Recharts）。
 * - 軸は1本だけ（単位の違う値は別のグラフにする）
 * - 系列色は --chart-1〜3 を順番に使う。2系列以上は凡例を出す
 * - 細い棒・先端だけ角丸・グリッドは控えめ。ホバーで値を表示
 */
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatNumber, formatPercent, formatYen, formatYenCompact } from "@/lib/format";

export type ValueKind = "count" | "yen" | "percent";
export type Series = { key: string; name: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recharts のデータは行ごとに形が違うため
type Row = Record<string, any>;

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
const AXIS = { tickLine: false, axisLine: false, fontSize: 12, stroke: "var(--muted-foreground)" } as const;

export function formatValue(v: number | null | undefined, kind: ValueKind): string {
  if (v === null || v === undefined) return "—";
  return kind === "yen" ? formatYen(v) : kind === "percent" ? formatPercent(v) : formatNumber(v, "件");
}
const tick = (kind: ValueKind) => (v: number) => (kind === "yen" ? formatYenCompact(v) : kind === "percent" ? `${v}%` : String(v));

const tooltipStyle = { borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)" };

/** 縦棒（月別など）。series が2つ以上なら並べて表示 */
export function ColumnChart({ data, x, series, kind, label, height = 260 }: {
  data: Row[]; x: string; series: Series[]; kind: ValueKind; label: string; height?: number;
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={x} {...AXIS} />
          <YAxis {...AXIS} width={kind === "yen" ? 64 : 36} allowDecimals={false} tickFormatter={tick(kind)} domain={kind === "percent" ? [0, 100] : undefined} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} formatter={(v) => formatValue(Number(v), kind)} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={series.length > 1 ? 18 : 28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 折れ線（率の推移など）。値が無い月（0件）は線を途切れさせる */
export function TrendLineChart({ data, x, series, kind, label, height = 260 }: {
  data: Row[]; x: string; series: Series[]; kind: ValueKind; label: string; height?: number;
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={x} {...AXIS} />
          <YAxis {...AXIS} width={kind === "yen" ? 64 : 40} tickFormatter={tick(kind)} domain={kind === "percent" ? [0, 100] : undefined} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatValue(v === null ? null : Number(v), kind)} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} activeDot={{ r: 5 }} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 横棒（経路別・担当者別など、名前の長い分類の比較）。値は棒の右に表示 */
export function RankingChart({ data, y, value, name, kind, label, highlight }: {
  data: Row[]; y: string; value: string; name: string; kind: ValueKind; label: string; highlight?: string;
}) {
  const height = Math.max(120, data.length * 34 + 16);
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" hide domain={kind === "percent" ? [0, 100] : [0, "auto"]} />
          <YAxis type="category" dataKey={y} {...AXIS} width={96} interval={0} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} formatter={(v) => formatValue(v === null ? null : Number(v), kind)} />
          <Bar dataKey={value} name={name} radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((row, i) => <Cell key={i} fill={highlight !== undefined && row[y] !== highlight ? "var(--chart-muted)" : COLORS[0]} />)}
            <LabelList dataKey={value} position="right" fontSize={12} fill="var(--foreground)"
              formatter={(v: unknown) => (v === null || v === undefined ? "—" : kind === "yen" ? formatYenCompact(Number(v)) : kind === "percent" ? `${Number(v).toFixed(1)}%` : `${v}件`)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
