import Link from "next/link";
import { KanbanSquare, List } from "lucide-react";
import { cn } from "@/lib/utils";

/** 案件の「一覧」「ボード」の切り替え */
export function DealViewTabs({ current }: { current: "list" | "board" }) {
  const item = (active: boolean) => cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium", active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground");
  return (
    <nav aria-label="表示の切り替え" className="inline-flex rounded-lg bg-muted p-1">
      <Link href="/deals" className={item(current === "list")} aria-current={current === "list" ? "page" : undefined}><List className="size-4" aria-hidden />一覧</Link>
      <Link href="/deals/board" className={item(current === "board")} aria-current={current === "board" ? "page" : undefined}><KanbanSquare className="size-4" aria-hidden />ボード</Link>
    </nav>
  );
}
