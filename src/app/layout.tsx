import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FlowDesk｜問い合わせ・案件管理システム", template: "%s | FlowDesk" },
  description: "問い合わせを一元管理し、対応漏れを防ぎ、受注につなげる。中小企業向けの問い合わせ・案件・タスク管理システム。",
};

export const viewport: Viewport = {
  themeColor: "#1f3340",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // ページは毎回サーバーで描画する（ログイン状態で内容が変わり、CSP の nonce をスクリプトに付けるため）
  await connection();
  return (
    <html lang="ja">
      <body>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
