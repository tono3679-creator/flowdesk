import type { DemoPersona } from "@/lib/demo/sandbox";

/** デモで体験できる社員（src/lib/demo/master-data.ts の STAFF と同じ人） */
export const DEMO_PERSONA_LIST: { persona: DemoPersona; name: string; short: string }[] = [
  { persona: "admin", name: "山田 健一", short: "管理者" },
  { persona: "manager", name: "佐藤 美咲", short: "マネージャー" },
  { persona: "member", name: "鈴木 大輔", short: "担当者" },
];
