"use client";
import { ColumnChart } from "@/components/charts/charts";

export type TrendPoint = { label: string; inquiries: number; converted: number; wonAmount: number };

/** 月別の問い合わせ・案件化件数と、受注金額（単位が違うので別のグラフにする） */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-1 text-sm font-medium text-muted-foreground">問い合わせ・案件化（件）</h3>
        <ColumnChart data={data} x="label" kind="count" label="月別の問い合わせ件数と案件化件数"
          series={[{ key: "inquiries", name: "問い合わせ" }, { key: "converted", name: "案件化" }]} />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium text-muted-foreground">受注金額（円）</h3>
        <ColumnChart data={data} x="label" kind="yen" label="月別の受注金額" series={[{ key: "wonAmount", name: "受注金額" }]} />
      </div>
    </div>
  );
}
