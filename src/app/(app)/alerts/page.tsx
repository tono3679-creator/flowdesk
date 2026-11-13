import Link from "next/link";
import { AlarmClock, CalendarClock, FileClock, PartyPopper, PhoneOff, Settings, TimerOff } from "lucide-react";
import { AlertList } from "@/components/alerts/alert-list";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { loadAlertInput } from "@/lib/data/facts";
import { getLookups, memberName } from "@/lib/data/lookups";
import { ALERT_KIND_LABEL, countByKind, detectAlerts, type AlertKind } from "@/lib/domain/alerts";
import { cn } from "@/lib/utils";

export const metadata = { title: "対応漏れアラート" };

const KINDS: { kind: AlertKind; icon: typeof TimerOff }[] = [
  { kind: "unanswered", icon: TimerOff },
  { kind: "quote_follow", icon: FileClock },
  { kind: "no_contact", icon: PhoneOff },
  { kind: "task_overdue", icon: AlarmClock },
  { kind: "follow_up_due", icon: CalendarClock },
];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ kind?: string; owner?: string }> }) {
  const user = await requireUser();
  const { kind, owner } = await searchParams;
  const [input, lookups] = await Promise.all([asCurrentUser((tx) => loadAlertInput(tx)), getLookups()]);
  const all = detectAlerts(input, user.settings, new Date(), user.settings.timezone);
  const counts = countByKind(all);
  const selected = KINDS.some((k) => k.kind === kind) ? (kind as AlertKind) : null;
  const mine = owner === "me";
  const alerts = all.filter((a) => (!selected || a.kind === selected) && (!mine || a.ownerId === user.userId));
  const rules = user.settings;
  const describe: Record<AlertKind, string> = {
    unanswered: `受付から${rules.unansweredHours}時間、対応履歴がない`,
    quote_follow: `見積提出から${rules.quoteFollowDays}日、まだ結論が出ていない`,
    no_contact: `${rules.noContactDays}日以上、顧客と接触していない進行中の案件`,
    task_overdue: "期限を過ぎた未完了のタスク",
    follow_up_due: "次回対応日・フォロー日が来た（過ぎた）もの",
    task_due_today: "今日が期限のタスク",
  };
  const href = (k: AlertKind | null, onlyMine = mine) => {
    const q = new URLSearchParams();
    if (k) q.set("kind", k);
    if (onlyMine) q.set("owner", "me");
    return `/alerts${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="対応漏れアラート"
        description="条件に当てはまる問い合わせ・案件・タスクを自動で見つけます。対応すると自動で消えます"
        actions={
          <>
            <Button variant="outline" asChild><Link href={href(selected, !mine)}>{mine ? "全員のアラート" : "自分の担当だけ"}</Link></Button>
            {user.role === "admin" && <Button variant="outline" asChild><Link href="/settings?tab=alerts"><Settings />条件を変更</Link></Button>}
          </>
        }
      />
      <section aria-label="種類別の件数" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KINDS.map(({ kind: k, icon: Icon }) => (
          <Link key={k} href={href(selected === k ? null : k)} aria-current={selected === k ? "true" : undefined}
            className={cn("rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40", selected === k && "border-primary ring-2 ring-primary/20")}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{ALERT_KIND_LABEL[k]}</span>
              <Icon className={cn("size-4", counts[k] > 0 ? "text-danger-strong" : "text-muted-foreground")} aria-hidden />
            </div>
            <div className={cn("mt-1 text-2xl font-bold tabular", counts[k] > 0 ? "text-foreground" : "text-muted-foreground")}>{counts[k]}<span className="ml-0.5 text-sm font-normal">件</span></div>
            <p className="text-keep mt-0.5 text-xs text-muted-foreground">{describe[k]}</p>
          </Link>
        ))}
      </section>
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">{selected ? ALERT_KIND_LABEL[selected] : "すべてのアラート"}（{alerts.length}件）</h2>
          {selected && <Link href={href(null)} className="text-sm text-brand hover:underline">すべて表示</Link>}
        </div>
        {alerts.length === 0
          ? <EmptyState icon={PartyPopper} title="対応漏れはありません" description="新しく条件に当てはまるものが出たら、こことダッシュボードに表示されます。" />
          : <AlertList alerts={alerts} ownerName={(id) => memberName(lookups, id)} />}
      </Card>
    </div>
  );
}
