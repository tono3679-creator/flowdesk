/**
 * 顧客の CSV 取り込みの検証（画面のプレビューとサーバーで同じものを使う）。
 */
import { parseCustomerType, type ImportRowInput } from "@/lib/domain/csv";
import { CUSTOMER_RANKS } from "@/lib/domain/labels";
import { customerSchema, type CustomerInput } from "@/lib/validation";

export type ImportRowResult = { row: number; ok: boolean; errors: string[]; label: string };

export function toCustomerInput(row: ImportRowInput) {
  const type = parseCustomerType(row.type, row.company_name);
  const rank = row.rank.trim().toUpperCase();
  const rankValid = (CUSTOMER_RANKS as readonly string[]).includes(rank);
  return {
    type,
    input: {
      type: type ?? "corporate",
      company_name: row.company_name, name: row.name, department: row.department, position: row.position, phone: row.phone, email: row.email,
      address: row.address, owner_id: "", rank: rankValid ? rank : "", memo: row.memo, tag_ids: [],
    } satisfies CustomerInput,
    rankInvalid: rank !== "" && !rankValid,
  };
}

/** 各行の検証結果。existingEmails は登録済みの顧客のメールアドレス（小文字） */
export function checkImportRows(rows: ImportRowInput[], existingEmails: Set<string>): ImportRowResult[] {
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const { type, input, rankInvalid } = toCustomerInput(row);
    const errors: string[] = [];
    if (!type) errors.push("法人／個人は「法人」か「個人」で入力してください");
    if (rankInvalid) errors.push("顧客ランクは S・A・B・C のいずれかです");
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) if (!errors.includes(issue.message)) errors.push(issue.message);
    }
    const email = row.email.trim().toLowerCase();
    if (email) {
      if (seen.has(email)) errors.push("ファイルの中で同じメールアドレスが重複しています");
      else if (existingEmails.has(email)) errors.push("同じメールアドレスの顧客が既に登録されています");
      seen.add(email);
    }
    return { row: i + 1, ok: errors.length === 0, errors, label: row.company_name || row.name || "（名前なし）" };
  });
}
