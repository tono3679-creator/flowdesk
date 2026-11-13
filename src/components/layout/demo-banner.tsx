"use client";
import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { switchDemoPersona } from "@/lib/actions/session";
import type { OrgRole } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";
import { DEMO_PERSONA_LIST } from "./demo-personas";

/** デモ環境であることを常に表示し、社員（役割）をワンタップで切り替えられるようにする */
export function DemoBanner({ role }: { role: OrgRole }) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-warning-soft px-4 py-2 text-xs text-warning-strong sm:px-6" role="note">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-3.5" aria-hidden />
        デモ環境
      </span>
      <span className="text-keep hidden md:inline">会社・人物・顧客はすべて架空です。データはあなた専用で、24時間後に自動で削除されます。</span>
      <div className="ml-auto flex items-center gap-1" role="group" aria-label="体験する役割">
        <span className="mr-1 hidden sm:inline">役割を切り替え：</span>
        {DEMO_PERSONA_LIST.map((p) => (
          <button
            key={p.persona}
            type="button"
            disabled={pending || p.persona === role}
            aria-pressed={p.persona === role}
            onClick={() => startTransition(() => switchDemoPersona(p.persona, `/${pathname.split("/")[1] ?? "dashboard"}`))}
            className={cn(
              "rounded-full border px-2.5 py-0.5 font-medium transition-colors disabled:cursor-default",
              p.persona === role ? "border-warning-strong bg-warning-strong text-white" : "border-warning/40 bg-card text-foreground hover:bg-accent disabled:opacity-50",
            )}
          >
            {p.short}
          </button>
        ))}
      </div>
    </div>
  );
}
