import { describe, expect, it } from "vitest";
import { applyMapping, escapeCell, guessMapping, parseCsv, parseCustomerType, splitTags, toCsv } from "@/lib/domain/csv";
import { checkImportRows } from "@/lib/customer-import";

describe("CSV 出力", () => {
  it("カンマ・改行・ダブルクォートを含む値だけ囲む", () => {
    expect(escapeCell("abc")).toBe("abc");
    expect(escapeCell("a,b")).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell("1行目\n2行目")).toBe('"1行目\n2行目"');
    expect(escapeCell(null)).toBe("");
    expect(escapeCell(1200)).toBe("1200");
  });

  it("数式として解釈される文字列は無害化する（CSV インジェクション対策）", () => {
    expect(escapeCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(escapeCell("+81")).toBe("'+81");
    expect(escapeCell("-1")).toBe("'-1");
    expect(escapeCell("@SUM")).toBe("'@SUM");
    // 数値の負数はそのまま（金額の列など）
    expect(escapeCell(-1)).toBe("-1");
  });

  it("BOM 付き・CRLF 区切り", () => {
    const csv = toCsv(["名前", "金額"], [["山田", 1000]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿名前,金額\r\n山田,1000\r\n");
  });

  it("出力したものを読み戻すと同じ値になる", () => {
    const rows = [["a,b", 'q"q', "改\n行", ""]];
    expect(parseCsv(toCsv(["h1", "h2", "h3", "h4"], rows))).toEqual([["h1", "h2", "h3", "h4"], ...rows]);
  });
});

describe("CSV 読み込み", () => {
  it("囲み・改行・空行・BOM・LF/CRLF 混在に対応する", () => {
    const text = '﻿会社名,メモ\r\n"株式会社A, 本社","1行目\n2行目"\n\n株式会社B,"""引用"""\r\n';
    expect(parseCsv(text)).toEqual([
      ["会社名", "メモ"],
      ["株式会社A, 本社", "1行目\n2行目"],
      ["株式会社B", '"引用"'],
    ]);
  });

  it("最終行に改行がなくても読む", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("顧客の取り込み", () => {
  it("見出しから項目を推測する（表記ゆれ・大文字小文字・空白）", () => {
    const m = guessMapping(["会社名", "担当者名", "TEL", "E-Mail", "備考", "謎の列"]);
    expect(m.company_name).toBe(0);
    expect(m.name).toBe(1);
    expect(m.phone).toBe(2);
    expect(m.email).toBe(3);
    expect(m.memo).toBe(4);
    expect(m.address).toBeNull();
  });

  it("割り当てに従って行を取り出す（範囲外は空文字）", () => {
    const m = guessMapping(["会社名", "メール"]);
    const row = applyMapping([" 株式会社A ", "a@example.com"], m);
    expect(row.company_name).toBe("株式会社A");
    expect(row.email).toBe("a@example.com");
    expect(row.phone).toBe("");
  });

  it("法人／個人の表記ゆれ", () => {
    expect(parseCustomerType("法人", "")).toBe("corporate");
    expect(parseCustomerType("個人", "株式会社A")).toBe("individual");
    expect(parseCustomerType("", "株式会社A")).toBe("corporate");
    expect(parseCustomerType("", "")).toBe("individual");
    expect(parseCustomerType("その他", "")).toBeNull();
  });

  it("タグの区切り（、 , ; | /）と重複", () => {
    expect(splitTags("VIP、要フォロー, VIP;紹介 / 新規")).toEqual(["VIP", "要フォロー", "紹介", "新規"]);
    expect(splitTags("")).toEqual([]);
  });

  it("行ごとの検証：必須・ランク・メールの重複", () => {
    const m = guessMapping(["区分", "会社名", "氏名", "メール", "ランク"]);
    const rows = [
      ["法人", "株式会社A", "", "a@example.com", "S"],
      ["法人", "", "山田", "", ""],
      ["個人", "", "佐藤", "A@example.com", ""],
      ["個人", "", "鈴木", "taken@example.com", "Z"],
      ["?", "", "高橋", "not-mail", ""],
    ].map((r) => applyMapping(r, m));
    const result = checkImportRows(rows, new Set(["taken@example.com"]));
    expect(result.map((r) => r.ok)).toEqual([true, false, false, false, false]);
    expect(result[1].errors).toContain("法人の場合は会社名を入力してください");
    expect(result[2].errors).toContain("ファイルの中で同じメールアドレスが重複しています");
    expect(result[3].errors).toEqual(expect.arrayContaining(["顧客ランクは S・A・B・C のいずれかです", "同じメールアドレスの顧客が既に登録されています"]));
    expect(result[4].errors).toEqual(expect.arrayContaining(["法人／個人は「法人」か「個人」で入力してください", "メールアドレスの形式が正しくありません"]));
  });
});
