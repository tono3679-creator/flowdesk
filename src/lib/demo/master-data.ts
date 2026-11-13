/**
 * デモ企業「株式会社NextWorks」（法人向け業務改善・Web制作会社・社員8名）の設定と、
 * 架空の顧客・問い合わせの文面。会社名・人名はすべて架空です。
 */
import type { ActivityType, OrgRole, Priority, StageCategory, TagColor } from "@/lib/domain/labels";

export const DEMO_COMPANY = { name: "株式会社NextWorks", industry: "法人向け業務改善・Web制作" };

export type StaffKey = "admin" | "manager" | "member" | "takahashi" | "tanaka" | "ito" | "watanabe" | "nakamura";

export type StaffProfile = {
  key: StaffKey;
  name: string;
  title: string;
  role: OrgRole;
  email: string;
  /** 問い合わせ・案件を受け持つ割合（重み） */
  share: number;
  /** 受注のしやすさ（0〜1） */
  winSkill: number;
  /** 初回対応までの時間（時間）の目安 [最短, 最長] */
  responseHours: [number, number];
  /** 受け持つ案件の金額の大きさ（倍率） */
  amountFactor: number;
};

/** 鈴木＝成績の良い担当者、田中＝受注率・初回対応が課題の担当者 */
export const STAFF: StaffProfile[] = [
  { key: "admin", name: "山田 健一", title: "代表取締役", role: "admin", email: "admin@flowdesk.example", share: 0.4, winSkill: 0.7, responseHours: [1, 6], amountFactor: 1.2 },
  { key: "manager", name: "佐藤 美咲", title: "営業部長", role: "manager", email: "manager@flowdesk.example", share: 1.0, winSkill: 0.55, responseHours: [0.5, 4], amountFactor: 1.1 },
  { key: "member", name: "鈴木 大輔", title: "営業", role: "member", email: "member@flowdesk.example", share: 2.4, winSkill: 0.75, responseHours: [0.3, 2.5], amountFactor: 1.45 },
  { key: "takahashi", name: "高橋 彩", title: "営業", role: "member", email: "takahashi@flowdesk.example", share: 2.0, winSkill: 0.5, responseHours: [0.5, 5], amountFactor: 1.0 },
  { key: "tanaka", name: "田中 翔太", title: "営業", role: "member", email: "tanaka@flowdesk.example", share: 2.0, winSkill: 0.18, responseHours: [4, 22], amountFactor: 0.8 },
  { key: "ito", name: "伊藤 真由", title: "インサイドセールス", role: "member", email: "ito@flowdesk.example", share: 1.6, winSkill: 0.42, responseHours: [0.2, 1.5], amountFactor: 0.85 },
  { key: "watanabe", name: "渡辺 拓也", title: "ディレクター", role: "member", email: "watanabe@flowdesk.example", share: 0.9, winSkill: 0.48, responseHours: [1, 8], amountFactor: 1.3 },
  { key: "nakamura", name: "中村 さくら", title: "カスタマーサクセス", role: "member", email: "nakamura@flowdesk.example", share: 0.8, winSkill: 0.5, responseHours: [0.5, 3], amountFactor: 0.9 },
];

export type StageKey = "hearing" | "prep" | "proposed" | "quote" | "review" | "won" | "working" | "completed" | "lost" | "hold";
export const STAGES: { key: StageKey; name: string; category: StageCategory; probability: number; column: string | null; marksQuote?: boolean }[] = [
  { key: "hearing", name: "ヒアリング", category: "open", probability: 20, column: "ヒアリング" },
  { key: "prep", name: "提案準備", category: "open", probability: 30, column: "提案" },
  { key: "proposed", name: "提案済み", category: "open", probability: 40, column: "提案" },
  { key: "quote", name: "見積提出", category: "open", probability: 60, column: "見積", marksQuote: true },
  { key: "review", name: "検討中", category: "open", probability: 80, column: "検討中" },
  { key: "won", name: "受注", category: "won", probability: 100, column: "受注" },
  { key: "working", name: "作業中", category: "won", probability: 100, column: "受注" },
  { key: "completed", name: "完了", category: "completed", probability: 100, column: "完了" },
  { key: "lost", name: "失注", category: "lost", probability: 0, column: "失注" },
  { key: "hold", name: "保留", category: "hold", probability: 10, column: null },
];

export type SourceKey = "web" | "phone" | "email" | "line" | "referral" | "sns" | "visit" | "other";
/** weight＝問い合わせの多さ、convert＝案件化しやすさ、win＝受注しやすさ（経路分析の差が出るように） */
export const SOURCES: { key: SourceKey; name: string; weight: number; convert: number; win: number }[] = [
  { key: "web", name: "Webフォーム", weight: 34, convert: 0.5, win: 0.85 },
  { key: "phone", name: "電話", weight: 17, convert: 0.55, win: 1.0 },
  { key: "email", name: "メール", weight: 14, convert: 0.45, win: 0.9 },
  { key: "line", name: "LINE", weight: 6, convert: 0.4, win: 0.8 },
  { key: "referral", name: "紹介", weight: 11, convert: 0.8, win: 1.55 },
  { key: "sns", name: "SNS", weight: 11, convert: 0.3, win: 0.45 },
  { key: "visit", name: "来店", weight: 3, convert: 0.6, win: 1.1 },
  { key: "other", name: "その他", weight: 4, convert: 0.25, win: 0.7 },
];

export const TAGS: { key: string; name: string; color: TagColor }[] = [
  { key: "new", name: "新規", color: "blue" },
  { key: "existing", name: "既存顧客", color: "green" },
  { key: "vip", name: "VIP", color: "violet" },
  { key: "prospect", name: "見込み顧客", color: "teal" },
  { key: "dormant", name: "休眠", color: "slate" },
  { key: "follow", name: "要フォロー", color: "amber" },
];

export const INQUIRY_CATEGORIES = ["Webサイト制作", "業務システム開発", "業務改善コンサル", "保守・運用", "見積依頼", "資料請求", "その他"];
export const DEAL_TYPES = ["Web制作", "システム開発", "業務改善支援", "保守・運用", "その他"];

export type InquiryTemplate = {
  category: string;
  dealType: string | null;
  /** 見積金額の範囲（円） */
  amount: [number, number];
  weight: number;
  /** 案件化しやすさの補正 */
  convert: number;
  titles: string[];
  contents: string[];
};

export const TEMPLATES: InquiryTemplate[] = [
  {
    category: "Webサイト制作", dealType: "Web制作", amount: [800_000, 3_200_000], weight: 30, convert: 1,
    titles: ["コーポレートサイトのリニューアル", "採用サイトの新規制作", "サービスサイトの制作相談", "Webサイトのスマホ対応", "ECサイト立ち上げの相談", "LP制作の依頼"],
    contents: [
      "現在のサイトが古く、スマートフォンで見づらいとの声が増えています。リニューアルの費用感とスケジュールを伺えますか。",
      "来春の採用に向けて採用サイトを作りたいと考えています。社員インタビューの撮影も含めてご相談したいです。",
      "新しいサービスの紹介ページを作りたいです。原稿はこちらで用意できます。概算のお見積りをお願いします。",
      "問い合わせフォームからの反応が少なく、導線の見直しも含めて相談したいです。",
    ],
  },
  {
    category: "業務システム開発", dealType: "システム開発", amount: [2_000_000, 8_500_000], weight: 18, convert: 0.9,
    titles: ["受発注管理システムの開発相談", "Excel管理からのシステム化", "社内ポータルの構築", "予約管理の仕組みづくり", "在庫管理システムの刷新"],
    contents: [
      "受注をExcelとメールで管理しており、転記ミスが多発しています。クラウドで共有できる仕組みを検討しています。",
      "複数拠点でスプレッドシートを使い分けていて、最新の情報が分かりません。一元管理したいです。",
      "既存のシステムが古く保守が切れるため、作り直しを検討しています。要件の整理から相談可能でしょうか。",
    ],
  },
  {
    category: "業務改善コンサル", dealType: "業務改善支援", amount: [300_000, 1_600_000], weight: 14, convert: 1,
    titles: ["業務フロー見直しの相談", "問い合わせ対応の効率化", "ペーパーレス化の進め方", "営業管理の仕組みづくり", "RPA導入の相談"],
    contents: [
      "担当者ごとにやり方が違い、引き継ぎがうまくいきません。業務フローの整理から支援いただけますか。",
      "紙の申請書が多く、承認に時間がかかっています。ペーパーレス化の進め方を相談したいです。",
      "問い合わせの対応漏れが続いており、仕組みで防ぎたいと考えています。",
    ],
  },
  {
    category: "保守・運用", dealType: "保守・運用", amount: [60_000, 600_000], weight: 12, convert: 1.1,
    titles: ["サイト保守契約の相談", "サーバー移転の依頼", "定期更新の代行依頼", "SSL証明書の更新対応", "表示不具合の修正依頼"],
    contents: [
      "制作会社と連絡が取れなくなり、サイトの保守をお願いできる会社を探しています。",
      "月に数回のお知らせ更新を代行していただきたいです。月額の費用を教えてください。",
      "サーバーの契約更新に合わせて移転を検討しています。作業範囲と費用感を知りたいです。",
    ],
  },
  {
    category: "見積依頼", dealType: null, amount: [400_000, 2_500_000], weight: 12, convert: 1.15,
    titles: ["見積のお願い", "概算見積の依頼", "相見積のお願い", "予算内でできる範囲の確認"],
    contents: [
      "社内で予算取りをするため、概算のお見積りをいただきたいです。仕様書を添付します。",
      "他社さんにも相談していますが、比較のためお見積りをお願いできますか。",
      "予算は100万円前後を想定しています。この範囲でどこまで対応可能か教えてください。",
    ],
  },
  {
    category: "資料請求", dealType: null, amount: [300_000, 1_200_000], weight: 8, convert: 0.45,
    titles: ["サービス資料の送付依頼", "事例資料の請求", "料金表の送付依頼"],
    contents: ["社内の検討用にサービス資料と料金表を送っていただけますか。", "同業種の導入事例があれば資料をいただきたいです。"],
  },
  {
    category: "その他", dealType: null, amount: [200_000, 800_000], weight: 6, convert: 0.25,
    titles: ["打ち合わせのお願い", "セミナー内容についての質問", "協業のご提案", "営業のご案内"],
    contents: ["一度お話を伺いたく、オンラインでの打ち合わせをお願いできますか。", "先日のセミナーで紹介されていた内容について質問があります。", "弊社サービスのご案内です。"],
  },
];

/** 架空の会社名を作るための語（実在の会社と重ならないよう、ひらがな・一般名詞の組み合わせ） */
export const COMPANY_PREFIX = [
  "あおば", "さくら", "ひかり", "みどり", "つばさ", "ことぶき", "はやて", "かがやき", "みらい", "あさひ", "そよかぜ", "しらかば",
  "なぎさ", "やまびこ", "こはる", "いろは", "すずらん", "ほしぞら", "わかば", "ゆうなぎ", "あかね", "みなも", "はるか", "ときわ",
];
export const COMPANY_BODY = [
  { word: "設備", industry: "建設・設備" }, { word: "工務店", industry: "建設・設備" }, { word: "不動産", industry: "不動産" },
  { word: "ホーム", industry: "不動産" }, { word: "精工", industry: "製造" }, { word: "製作所", industry: "製造" },
  { word: "メンテナンス", industry: "修理・メンテナンス" }, { word: "クリーンサービス", industry: "清掃" },
  { word: "会計事務所", industry: "士業" }, { word: "法律事務所", industry: "士業" }, { word: "キャリア", industry: "人材" },
  { word: "保険サービス", industry: "保険代理店" }, { word: "コンサルティング", industry: "コンサルティング" },
  { word: "商事", industry: "卸売" }, { word: "物流", industry: "物流" }, { word: "フーズ", industry: "飲食" },
  { word: "クリニック", industry: "医療" }, { word: "広告企画", industry: "広告代理店" }, { word: "トレーディング", industry: "卸売" },
];
export const SURNAMES = [
  "青木", "石井", "上田", "遠藤", "大野", "小川", "加藤", "木村", "小林", "斎藤", "坂本", "清水", "杉山", "高木", "竹内", "千葉",
  "中島", "西村", "野口", "橋本", "長谷川", "原田", "平野", "福田", "藤井", "前田", "松本", "宮崎", "村上", "森", "安田", "吉田",
];
export const GIVEN_NAMES = [
  "誠", "浩二", "直樹", "和也", "隆", "健太", "亮", "智子", "陽子", "恵", "由美", "麻衣", "美穂", "千尋", "裕子", "拓海", "優", "葵", "陸", "結衣",
];
export const DEPARTMENTS = ["総務部", "営業部", "経営企画室", "管理部", "情報システム部", "人事部", "広報室", "代表"];
export const POSITIONS = ["部長", "課長", "主任", "担当", "代表取締役", "取締役", "マネージャー", null];
export const PREFECTURES = [
  "東京都千代田区", "東京都港区", "東京都品川区", "神奈川県横浜市", "神奈川県川崎市", "埼玉県さいたま市", "千葉県船橋市", "東京都立川市",
];

export const PRIORITY_WEIGHTS: { value: Priority; weight: number }[] = [
  { value: "low", weight: 15 }, { value: "medium", weight: 55 }, { value: "high", weight: 23 }, { value: "urgent", weight: 7 },
];

export const FIRST_RESPONSE_TYPES: ActivityType[] = ["call", "email", "email", "call", "line"];

export const LOST_REASON_WEIGHTS = [
  { value: "価格", weight: 30 }, { value: "競合に決定", weight: 25 }, { value: "予算不足", weight: 15 },
  { value: "時期が合わない", weight: 12 }, { value: "要件が合わない", weight: 8 }, { value: "連絡が途絶えた", weight: 10 },
];
