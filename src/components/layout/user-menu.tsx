"use client";
import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { Check, Info, LogOut, RotateCcw, UserRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resetDemo, signOut, switchDemoPersona } from "@/lib/actions/session";
import { ROLE_LABEL, type OrgRole } from "@/lib/domain/labels";
import { DEMO_PERSONA_LIST } from "./demo-personas";

function firstSegment(pathname: string): string {
  return `/${pathname.split("/")[1] ?? "dashboard"}`;
}

export function UserMenu({ displayName, title, role, isDemo }: { displayName: string; title: string | null; role: OrgRole; isDemo: boolean }) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:px-2" aria-label="ユーザーメニュー">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{displayName.slice(0, 1)}</span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-medium">{displayName}</span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[role]}{title ? `・${title}` : ""}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div>{displayName}</div>
          <div className="text-xs font-normal text-muted-foreground">{ROLE_LABEL[role]}{title ? `・${title}` : ""}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isDemo && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">別の社員に切り替える</DropdownMenuLabel>
            {DEMO_PERSONA_LIST.map((p) => (
              <DropdownMenuItem key={p.persona} disabled={pending || p.persona === role} onSelect={() => startTransition(() => switchDemoPersona(p.persona, firstSegment(pathname)))}>
                {p.persona === role ? <Check /> : <UserRound />}
                {p.name}（{ROLE_LABEL[p.persona]}）
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => startTransition(async () => {
                toast.loading("デモデータを初期化しています…");
                await resetDemo();
              })}
            >
              <RotateCcw />
              デモデータを初期化
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild><Link href="/about"><Info />このシステムについて</Link></DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => startTransition(() => signOut())}>
          <LogOut />
          {isDemo ? "デモを終了する" : "ログアウト"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
