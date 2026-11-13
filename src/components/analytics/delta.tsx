import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** 前の期間との比較（上がったのが良いか悪いかは better で指定） */
export function Delta({ current, previous, kind, better = "up" }: { current: number | null; previous: number | null; kind: "count" | "yen" | "percent" | "minutes"; better?: "up" | "down" }) {
  if (current === null || previous === null) return <span className="text-muted-foreground">前期間 —</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Minus className="size-3" aria-hidden />前期間と同じ</span>;
  const good = better === "up" ? diff > 0 : diff < 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  const text = kind === "percent" ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}pt`
    : kind === "yen" ? (previous > 0 ? `${diff > 0 ? "+" : ""}${((diff / previous) * 100).toFixed(0)}%` : "")
    : kind === "minutes" ? `${diff > 0 ? "+" : "−"}${Math.round(Math.abs(diff) / 60 * 10) / 10}時間`
    : `${diff > 0 ? "+" : ""}${diff}件`;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-success-strong" : "text-danger-strong")}>
      <Icon className="size-3" aria-hidden />前期間比 {text}
    </span>
  );
}
