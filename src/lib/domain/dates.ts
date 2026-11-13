/**
 * 日付の扱い（タイムゾーンを明示する純粋関数）。
 * 業務の「今日」「今月」は組織のタイムゾーン（既定 Asia/Tokyo）の暦日で決める。
 * 日付だけの値は 'YYYY-MM-DD' の文字列で扱い、Date に変換しない（端末やサーバーの時差でずれないように）。
 */

export const DEFAULT_TIMEZONE = "Asia/Tokyo";
export type DateString = string; // 'YYYY-MM-DD'

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(tz, f);
  }
  return f;
}

/** 日時が、そのタイムゾーンで何日か（'YYYY-MM-DD'） */
export function toLocalDate(value: Date, tz: string = DEFAULT_TIMEZONE): DateString {
  return formatter(tz).format(value);
}

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtcMs(date: DateString): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): DateString {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 日付に n 日足す（月末・年末・うるう年をまたいでも正しく） */
export function addDays(date: DateString, days: number): DateString {
  return fromUtcMs(toUtcMs(date) + days * 86_400_000);
}

/** b − a の日数（a が今日、b が期限なら「残り日数」。過ぎていれば負） */
export function diffDays(a: DateString, b: DateString): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** 月を n か月ずらした月の1日 */
export function addMonths(date: DateString, months: number): DateString {
  const [y, m] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

export function startOfMonth(date: DateString): DateString {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: DateString): DateString {
  return addDays(addMonths(date, 1), -1);
}

/** 週の始まり（月曜日） */
export function startOfWeek(date: DateString): DateString {
  const dow = new Date(toUtcMs(date)).getUTCDay(); // 0=日
  return addDays(date, -((dow + 6) % 7));
}

export function startOfYear(date: DateString): DateString {
  return `${date.slice(0, 4)}-01-01`;
}

/** 'YYYY-MM'（月別の集計のキー） */
export function monthKey(date: DateString): string {
  return date.slice(0, 7);
}

/** from から to までの月のキー（両端を含む） */
export function monthRange(from: DateString, to: DateString): string[] {
  const out: string[] = [];
  let cur = startOfMonth(from);
  const last = startOfMonth(to);
  while (cur <= last) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}

/** 期間（両端の日を含む） */
export type Period = { from: DateString; to: DateString };

export function inPeriod(date: DateString | null | undefined, period: Period): boolean {
  return !!date && date >= period.from && date <= period.to;
}

/** 日時が期間に入るか（組織のタイムゾーンの暦日で判定） */
export function inPeriodAt(value: Date | null | undefined, period: Period, tz: string = DEFAULT_TIMEZONE): boolean {
  return !!value && inPeriod(toLocalDate(value, tz), period);
}

export function monthPeriod(today: DateString): Period {
  return { from: startOfMonth(today), to: endOfMonth(today) };
}

/** 経過時間（時間・小数） */
export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

/** 分を「2時間14分」の形に */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const total = Math.round(minutes);
  if (total < 60) return `${total}分`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days}日${hours}時間`;
  return mins === 0 ? `${hours}時間` : `${hours}時間${mins}分`;
}
