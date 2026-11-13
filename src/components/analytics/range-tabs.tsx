import Link from "next/link";
import { RANGE_LABEL, RANGES, type RangeKey } from "@/lib/data/analytics";
import { cn } from "@/lib/utils";

/** 集計期間の切り替え（URL の range） */
export function RangeTabs({ current, basePath }: { current: RangeKey; basePath: string }) {
  return (
    <nav aria-label="集計期間" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-lg bg-muted p-1">
        {RANGES.map((r) => (
          <li key={r}>
            <Link href={`${basePath}?range=${r}`} aria-current={r === current ? "page" : undefined}
              className={cn("inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap", r === current ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {RANGE_LABEL[r]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
