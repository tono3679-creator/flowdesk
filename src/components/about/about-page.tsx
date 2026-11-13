import Link from "next/link";
import {
  AlarmClock, ArrowRight, BarChart3, BellRing, Briefcase, CheckCircle2, ClipboardList, FileClock, FileSpreadsheet, GitMerge, Inbox,
  KanbanSquare, LayoutDashboard, Lock, MessageSquareWarning, PhoneOff, ShieldCheck, Smartphone, TimerOff, UserCog, Users, XCircle, type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

const PROBLEMS = [
  { icon: MessageSquareWarning, text: "電話・メール・LINE・フォームに問い合わせが散らばり、誰が対応したか分からない" },
  { icon: TimerOff, text: "折り返しを忘れて、気づいたときには他社に決まっていた" },
  { icon: FileClock, text: "見積を出したあと、フォローの連絡をしないまま放置してしまう" },
  { icon: FileSpreadsheet, text: "Excel・付箋・個人のメモで管理していて、担当者が休むと状況が追えない" },
  { icon: BarChart3, text: "どの集客経路が売上につながっているのか、数字で説明できない" },
  { icon: ClipboardList, text: "月末の報告資料づくりに、毎月まる1日以上かかっている" },
];

const BEFORE_AFTER = [
  ["問い合わせはメール・電話メモ・LINEにバラバラ", "すべて1つの一覧に。経路・担当者・ステータスで絞り込み"],
  ["対応漏れは「気づいた人が気づいたとき」", "24時間未対応・見積から7日・30日未接触を自動で通知"],
  ["案件化のたびに顧客情報を入力し直す", "ワンクリックで案件化。顧客・内容・履歴を引き継ぎ"],
  ["案件の状況は担当者に聞かないと分からない", "案件ボードで全員の案件と受注見込金額がひと目で分かる"],
  ["月次報告は Excel で集計して手作業で作成", "レポート・分析は自動で集計。CSV でも出力"],
];

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: LayoutDashboard, title: "ダッシュボード", text: "今月の問い合わせ・案件化率・受注率・受注見込金額など10の指標と、「今日やること」を優先度順に表示。" },
  { icon: Inbox, title: "問い合わせ管理", text: "受付日時・経路・内容・担当者・優先度を記録。未対応のまま24時間を過ぎると赤く警告します。" },
  { icon: GitMerge, title: "ワンクリック案件化", text: "顧客・問い合わせ内容・担当者・対応履歴を引き継いで案件を作成。次のタスクも自動で作ります。" },
  { icon: KanbanSquare, title: "案件ボード（Kanban）", text: "ヒアリング→提案→見積→検討中→受注→完了。ドラッグで移動すると確度も自動で変わり保存されます。" },
  { icon: BellRing, title: "対応漏れアラート", text: "未対応・見積フォロー・長期未接触・期限超過・フォロー予定日を自動で検出。条件は設定で変更できます。" },
  { icon: Users, title: "顧客管理", text: "問い合わせ・案件・対応履歴・累計売上を顧客ごとにタイムラインで表示。CSV で一括取り込みも。" },
  { icon: BarChart3, title: "営業分析・レポート", text: "経路別・担当者別・月別の分析と、日次・週次・月次・年間レポート。印刷・PDF 保存にも対応。" },
  { icon: UserCog, title: "役割ごとの権限", text: "管理者・マネージャー・一般担当者。担当者は自分の担当分だけを、マネージャーはチーム全体を見られます。" },
];

const ALERTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: TimerOff, title: "24時間以上 未対応", text: "問い合わせから24時間以上未対応です" },
  { icon: FileClock, title: "見積提出から7日", text: "見積提出から7日経過しています。フォローを推奨します。" },
  { icon: PhoneOff, title: "30日以上 未接触", text: "30日以上顧客との接触がありません。" },
  { icon: AlarmClock, title: "タスクの期限超過", text: "期限を3日過ぎています" },
];

/** 公開の紹介ページ（ポートフォリオとして第三者に見せる） */
export function AboutPage({ loggedIn }: { loggedIn: boolean }) {
  const cta = loggedIn
    ? <Button size="lg" asChild><Link href="/dashboard">ダッシュボードへ<ArrowRight /></Link></Button>
    : <Button size="lg" asChild><Link href="/login">デモを体験する（登録不要）<ArrowRight /></Link></Button>;
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="FlowDesk トップ"><Logo /></Link>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#features" className="hidden rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground sm:inline">機能</a>
            <a href="#effect" className="hidden rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground sm:inline">導入効果</a>
            <Button size="sm" asChild><Link href={loggedIn ? "/dashboard" : "/login"}>{loggedIn ? "アプリを開く" : "デモを見る"}</Link></Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-brand">中小企業向け 問い合わせ・案件・タスク管理システム</p>
              <h1 className="mt-3 text-[1.65rem] leading-tight font-bold text-white sm:text-[2.6rem]">
                <span className="inline-block">問い合わせを一元管理し、</span>
                <span className="inline-block">対応漏れを防ぎ、</span>
                <span className="inline-block">受注につなげる。</span>
              </h1>
              <p className="text-keep mt-5 max-w-xl leading-relaxed text-sidebar-muted">
                FlowDesk は、Web制作会社・工務店・士業・修理業など、問い合わせから仕事が始まる会社のための業務システムです。
                問い合わせの受付から案件化・見積・受注・売上までを1つにつなげ、「やるべきこと」を自動で知らせます。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {cta}
                <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
                  <a href="#features">機能を見る</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-sidebar-muted">デモは架空の会社「株式会社NextWorks」のデータです。管理者・マネージャー・一般担当者の3つの役割で操作できます。</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl" aria-hidden>
              <div className="text-xs font-semibold text-sidebar-muted">今日やること</div>
              <ul className="mt-3 grid gap-2">
                {[
                  ["至急", "bg-red-500/90", "問い合わせから24時間以上未対応です", "LP制作の依頼"],
                  ["要対応", "bg-amber-500/90", "見積提出から8日経過しています。フォローを推奨します。", "受発注管理システムの開発"],
                  ["要対応", "bg-amber-500/90", "期限を2日過ぎています", "提案書の作成"],
                  ["確認", "bg-sky-500/90", "30日以上顧客との接触がありません。", "保守契約の更新"],
                ].map(([sev, tone, msg, title]) => (
                  <li key={msg} className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                    <span className={`mt-0.5 shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${tone}`}>{sev}</span>
                    <div className="min-w-0"><div className="truncate text-sm font-medium text-white">{title}</div><div className="text-xs text-sidebar-muted">{msg}</div></div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[["案件化率", "42.7%"], ["受注率", "38.5%"], ["受注見込", "2,251万円"]].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-white/5 px-2 py-2"><div className="text-[10px] text-sidebar-muted">{l}</div><div className="text-sm font-bold text-white tabular">{v}</div></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Section id="problems" eyebrow="課題" title="こんなことで困っていませんか？">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 rounded-xl border bg-card p-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-danger-strong" aria-hidden />
                <span className="text-keep text-sm leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
          <p className="text-keep mt-6 text-center text-sm text-muted-foreground">
            少人数の会社ほど、ひとつの問い合わせの取りこぼしが売上に直結します。原因は人ではなく「仕組みがないこと」です。
          </p>
        </Section>

        <Section id="before-after" eyebrow="Before / After" title="FlowDesk で、こう変わります" muted>
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="hidden grid-cols-2 border-b bg-muted/60 text-sm font-semibold sm:grid">
              <div className="flex items-center gap-2 px-5 py-3 text-muted-foreground"><XCircle className="size-4" aria-hidden />導入前</div>
              <div className="flex items-center gap-2 border-l px-5 py-3 text-success-strong"><CheckCircle2 className="size-4" aria-hidden />導入後</div>
            </div>
            <ul className="divide-y">
              {BEFORE_AFTER.map(([before, after]) => (
                <li key={before} className="grid sm:grid-cols-2">
                  <div className="flex gap-2 px-5 py-3.5 text-sm text-muted-foreground"><XCircle className="mt-0.5 size-4 shrink-0 sm:hidden" aria-label="導入前" />{before}</div>
                  <div className="flex gap-2 px-5 pb-3.5 text-sm font-medium sm:border-l sm:py-3.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-strong" aria-label="導入後" />{after}</div>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="features" eyebrow="機能" title="問い合わせから売上まで、1つにつながる">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl border bg-card p-5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-brand"><Icon className="size-5" aria-hidden /></div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="text-keep mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="alerts" eyebrow="差別化ポイント①" title="対応漏れを、システムが先に見つける" muted>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <p className="text-keep leading-relaxed text-muted-foreground">
              一覧を眺めて探すのではなく、条件に当てはまるものを毎回自動で検出し、ダッシュボードの「今日やること」に重要度の高い順で並べます。
              対応履歴を記録すれば自動で消えるので、「やった・やっていない」の確認も不要です。判定の基準（時間・日数）は会社ごとに変えられます。
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ALERTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-danger-strong" aria-hidden />{title}</div>
                  <p className="mt-1.5 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger-strong">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="sources" eyebrow="差別化ポイント②" title="どの経路が「売上」につながっているかが分かる">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
            <p className="text-keep leading-relaxed text-muted-foreground">
              問い合わせの件数だけを見ると「Webフォームが一番」に見えても、受注金額でみると「紹介」が上回ることがあります。
              FlowDesk は経路ごとに 問い合わせ → 案件化 → 受注 → 受注金額 をつなげて集計し、1件あたりの受注金額まで示します。
              広告費や営業の時間をどこにかけるべきかを、数字で判断できます。
            </p>
            <div className="overflow-hidden rounded-xl border bg-card text-sm">
              <div className="grid grid-cols-4 bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground"><span>経路</span><span className="text-right">問い合わせ</span><span className="text-right">受注率</span><span className="text-right">受注金額</span></div>
              {[["紹介", "19件", "21.1%", "1,912万円"], ["メール", "25件", "12.0%", "612万円"], ["Webフォーム", "59件", "8.5%", "395万円"], ["電話", "23件", "13.0%", "382万円"]].map((r) => (
                <div key={r[0]} className="grid grid-cols-4 border-t px-4 py-2.5 tabular"><span className="font-medium">{r[0]}</span><span className="text-right">{r[1]}</span><span className="text-right">{r[2]}</span><span className="text-right font-semibold">{r[3]}</span></div>
              ))}
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">デモデータの例（直近6か月）</p>
            </div>
          </div>
        </Section>

        <Section id="effect" eyebrow="導入効果（想定）" title="管理と報告の時間を、月20時間削減" muted>
          <div className="grid gap-4 sm:grid-cols-3">
            {[["導入前", "月 30時間", "問い合わせの確認・転記、進捗の聞き取り、Excel での集計と報告資料づくり"], ["導入後", "月 10時間", "一覧とアラートを見て対応するだけ。集計とレポートは自動"], ["削減できる時間", "年 240時間", "月20時間 × 12か月。営業活動やお客様対応に使える時間に"]].map(([label, value, text], i) => (
              <div key={label} className={`rounded-xl border p-5 ${i === 2 ? "border-brand/40 bg-accent" : "bg-card"}`}>
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className={`mt-1 text-3xl font-bold tabular ${i === 2 ? "text-brand" : ""}`}>{value}</div>
                <p className="text-keep mt-2 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          <p className="text-keep mt-4 text-xs text-muted-foreground">
            ※ 従業員8名・月20〜30件の問い合わせがある会社を想定した試算です。実際の効果は業務内容・運用方法によって異なり、効果を保証するものではありません。
          </p>
        </Section>

        <Section id="tech" eyebrow="つくり" title="安心して使える設計">
          <ul className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Lock, title: "会社ごとにデータを分離", text: "すべてのデータに組織IDを持たせ、データベースの行レベルセキュリティ（RLS）で他社のデータには一切アクセスできません。" },
              { icon: ShieldCheck, title: "役割に応じた権限", text: "画面・サーバー・データベースの3段階で権限を確認。一般担当者は自分の担当分だけを扱えます。" },
              { icon: Smartphone, title: "スマホでも使える", text: "外出先でも問い合わせの確認・対応の記録ができるよう、スマートフォンの画面幅に合わせて表示します。" },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl border bg-card p-5">
                <Icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="text-keep mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-muted-foreground">Next.js（App Router）・TypeScript・Tailwind CSS・shadcn/ui・PostgreSQL（RLS）・Recharts・Zod</p>
        </Section>

        <section className="bg-sidebar">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center sm:px-6">
            <Briefcase className="size-8 text-brand" aria-hidden />
            <h2 className="text-keep text-2xl font-bold text-white">実際の画面を、そのまま触ってみてください</h2>
            <p className="text-keep max-w-xl text-sm text-sidebar-muted">登録は不要です。あなた専用のデモ環境（24時間で自動削除）が作られ、自由に登録・編集・案件化・ドラッグ操作を試せます。</p>
            {cta}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <Logo tagline={false} />
          <p>ポートフォリオ作品です。デモに登場する会社・人物・データはすべて架空のものです。</p>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, eyebrow, title, muted, children }: { id: string; eyebrow: string; title: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className={muted ? "border-y bg-muted/40" : ""} aria-labelledby={`${id}-title`}>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <p className="text-center text-sm font-semibold text-brand">{eyebrow}</p>
        <h2 id={`${id}-title`} className="text-keep mt-2 mb-8 text-center text-xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}
