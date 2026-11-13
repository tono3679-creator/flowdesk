"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Briefcase, Building2, Inbox, ListTodo, Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrgRole } from "@/lib/domain/labels";
import { SidebarBody, type NavBadges } from "./sidebar";
import { UserMenu } from "./user-menu";

/** 上部のバー：グローバル検索・クイック作成（＋ 新規）・アラート・ユーザーメニュー */
export function Header({
  displayName, title, role, organizationName, isDemo, badges,
}: { displayName: string; title: string | null; role: OrgRole; organizationName: string; isDemo: boolean; badges: NavBadges }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  };
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:gap-3 sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="メニューを開く">
          <Menu />
        </Button>
        <SheetContent side="left" aria-describedby={undefined} className="w-64 p-0">
          <SheetTitle className="sr-only">メインメニュー</SheetTitle>
          <SidebarBody organizationName={organizationName} role={role} badges={badges} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <form role="search" onSubmit={submit} className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="顧客・会社・問い合わせ・案件を検索"
          aria-label="全体を検索"
          className="h-9 pl-9"
        />
      </form>
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="brand" size="sm" aria-label="新規作成">
              <Plus aria-hidden />
              <span className="hidden sm:inline">新規</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">すぐに登録する</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/inquiries/new"><Inbox />問い合わせ</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/customers/new"><Building2 />顧客</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/deals/new"><Briefcase />案件</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/tasks/new"><ListTodo />タスク</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" asChild className="relative">
          <Link href="/alerts" aria-label={`対応漏れアラート ${badges.alerts} 件`}>
            <BellRing />
            {badges.alerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4.5 rounded-full bg-destructive px-1 text-center text-[10px] leading-4.5 font-bold text-white tabular">
                {badges.alerts > 99 ? "99+" : badges.alerts}
              </span>
            )}
          </Link>
        </Button>
        <UserMenu displayName={displayName} title={title} role={role} isDemo={isDemo} />
      </div>
    </header>
  );
}
