import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, ChartPie, GitMerge, Inbox } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { getCurrentUser } from "@/lib/auth";
import { LoginPanel } from "./login-panel";

export const metadata = { title: "ログイン" };

const FEATURES = [
  { icon: Inbox, title: "問い合わせを一か所に", text: "電話・メール・LINE・Webフォーム。経路を問わず登録し、担当者を決めて追いかけます。" },
  { icon: BellRing, title: "対応漏れを自動で検出", text: "24時間未対応・見積から7日・30日接触なし・期限超過を毎回自動で判定します。" },
  { icon: GitMerge, title: "ワンクリックで案件化", text: "顧客・内容・担当者・対応履歴を引き継いで案件へ。見積から受注までを Kanban で。" },
  { icon: ChartPie, title: "売上につながる経路が分かる", text: "経路ごとに 案件化 → 受注 → 受注金額 をつなげて、どこに力を入れるべきかを示します。" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex lg:flex-col">
        <Link href="/" aria-label="紹介ページへ"><Logo inverted /></Link>
        <div className="my-auto max-w-lg">
          <p className="text-sm font-medium text-brand">中小企業向け 問い合わせ・案件管理システム</p>
          <h1 className="text-keep mt-3 text-4xl leading-tight font-bold text-white">
            問い合わせを、
            <br />
            取りこぼさず受注へ。
          </h1>
          <p className="text-keep mt-4 text-base text-sidebar-muted">
            メール・電話メモ・LINE・Excel に散らばった問い合わせと案件を一元管理。対応漏れを防ぎ、受注につなげる業務改善システムです。
          </p>
          <ul className="mt-10 grid gap-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
                  <f.icon className="size-5 text-white" aria-hidden />
                </div>
                <div>
                  <div className="font-semibold text-white">{f.title}</div>
                  <div className="text-keep text-sm text-sidebar-muted">{f.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sidebar-muted">表示されるデータはすべて架空のデモデータです。</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" aria-label="紹介ページへ" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          <LoginPanel />
          <p className="mt-8 text-center text-sm">
            <Link href="/" className="text-brand underline-offset-4 hover:underline">このシステムについて（導入効果・機能の紹介）</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
