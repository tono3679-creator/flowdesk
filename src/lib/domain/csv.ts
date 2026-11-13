/**
 * CSV の読み書き（純粋関数）。
 *   出力：UTF-8（BOM 付き・Excel で文字化けしない）、CRLF、必要なときだけ "" で囲む。
 *   数式として解釈される値（= + - @ で始まる文字列）は先頭に ' を付けて無害化する（CSV インジェクション対策）。
 *   入力：RFC 4180（"" で囲んだ項目の中の改行・カンマ・"" に対応）。BOM は取り除く。
 */

export type CsvValue = string | number | boolean | null | undefined;

const FORMULA = /^[=+\-@\t\r]/;

export function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((r) => r.map(escapeCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** CSV の文字列を行の配列にする（空行は除く） */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** 顧客の取り込みで割り当てられる項目 */
export const CUSTOMER_IMPORT_FIELDS = [
  { key: "type", label: "法人／個人", aliases: ["法人/個人", "区分", "種別", "type"] },
  { key: "company_name", label: "会社名", aliases: ["会社", "企業名", "法人名", "社名", "company", "company_name"] },
  { key: "name", label: "氏名", aliases: ["担当者名", "名前", "お名前", "name", "contact"] },
  { key: "department", label: "部署", aliases: ["部署名", "所属", "department"] },
  { key: "position", label: "役職", aliases: ["肩書", "position", "title"] },
  { key: "phone", label: "電話番号", aliases: ["電話", "tel", "phone", "携帯"] },
  { key: "email", label: "メールアドレス", aliases: ["メール", "e-mail", "email", "mail"] },
  { key: "address", label: "住所", aliases: ["所在地", "address"] },
  { key: "rank", label: "顧客ランク", aliases: ["ランク", "rank"] },
  { key: "tags", label: "タグ", aliases: ["tag", "tags", "分類"] },
  { key: "memo", label: "メモ", aliases: ["備考", "memo", "note", "notes"] },
] as const;
export type CustomerImportField = (typeof CUSTOMER_IMPORT_FIELDS)[number]["key"];
export type ColumnMapping = Record<CustomerImportField, number | null>;

const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_　]/g, "");

/** 見出しの名前から、項目の割り当てを推測する */
export function guessMapping(header: string[]): ColumnMapping {
  const mapping = Object.fromEntries(CUSTOMER_IMPORT_FIELDS.map((f) => [f.key, null])) as ColumnMapping;
  const used = new Set<number>();
  for (const field of CUSTOMER_IMPORT_FIELDS) {
    const names = [field.label, ...field.aliases].map(normalize);
    const index = header.findIndex((h, i) => !used.has(i) && names.includes(normalize(h)));
    if (index >= 0) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  return mapping;
}

export type ImportRowInput = Record<CustomerImportField, string>;

/** 割り当てに従って1行を取り出す（列が無い・範囲外は空文字） */
export function applyMapping(row: string[], mapping: ColumnMapping): ImportRowInput {
  const out = {} as ImportRowInput;
  for (const field of CUSTOMER_IMPORT_FIELDS) {
    const index = mapping[field.key];
    out[field.key] = index === null || index === undefined ? "" : (row[index] ?? "").trim();
  }
  return out;
}

/** 「法人」「個人」などの表記ゆれを区分にする（空なら会社名の有無で決める） */
export function parseCustomerType(value: string, companyName: string): "corporate" | "individual" | null {
  const v = normalize(value);
  if (v === "") return companyName.trim() ? "corporate" : "individual";
  if (["法人", "corporate", "会社", "企業", "b2b"].includes(v)) return "corporate";
  if (["個人", "individual", "personal", "b2c"].includes(v)) return "individual";
  return null;
}

/** タグの欄（「VIP、要フォロー」など）を分ける */
export function splitTags(value: string): string[] {
  return [...new Set(value.split(/[,、;；|/／]/).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
}
