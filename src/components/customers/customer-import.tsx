"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelectField } from "@/components/common/select-field";
import { importCustomers } from "@/lib/actions/customers";
import { safeAction } from "@/lib/client/safe-action";
import { checkImportRows, type ImportRowResult } from "@/lib/customer-import";
import { applyMapping, CUSTOMER_IMPORT_FIELDS, guessMapping, parseCsv, toCsv, type ColumnMapping } from "@/lib/domain/csv";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 1000;

/** 文字コードを判定して読む（Excel で保存した Shift_JIS の CSV にも対応） */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  return new TextDecoder("shift_jis").decode(buf);
}

const SAMPLE = toCsv(
  ["法人/個人", "会社名", "氏名", "部署", "役職", "電話番号", "メールアドレス", "住所", "ランク", "タグ", "メモ"],
  [
    ["法人", "株式会社サンプル商事", "山田 太郎", "総務部", "部長", "03-1234-5678", "yamada@sample.example", "東京都千代田区1-1-1", "A", "既存顧客、紹介", "展示会で名刺交換"],
    ["個人", "", "佐藤 花子", "", "", "090-1234-5678", "hanako@sample.example", "", "", "見込み", ""],
  ],
);

type Step = "select" | "map" | "done";

/** 顧客の CSV 取り込み（ファイル選択 → 列の割り当てとプレビュー → 検証 → 取り込み → 結果） */
export function CustomerImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("select");
  const [fileName, setFileName] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [outcome, setOutcome] = useState<{ imported: number; skipped: number; results: ImportRowResult[] } | null>(null);

  const rows = useMemo(() => (mapping ? body.map((r) => applyMapping(r, mapping)) : []), [body, mapping]);
  const checks = useMemo(() => checkImportRows(rows, new Set()), [rows]);
  const okCount = checks.filter((c) => c.ok).length;

  const load = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) return toast.error("CSV ファイル（.csv）を選んでください");
    if (file.size > MAX_BYTES) return toast.error("ファイルが大きすぎます（2MB まで）");
    const table = parseCsv(await readText(file));
    if (table.length < 2) return toast.error("見出し行と、1行以上のデータが必要です");
    if (table.length - 1 > MAX_ROWS) return toast.error(`一度に取り込めるのは${MAX_ROWS}行までです`);
    setFileName(file.name);
    setHeader(table[0]);
    setBody(table.slice(1));
    setMapping(guessMapping(table[0]));
    setStep("map");
  };

  const submit = async () => {
    setBusy(true);
    const r = await safeAction(() => importCustomers(rows));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setOutcome(r.data ?? null);
    setStep("done");
    toast.success(`${r.data?.imported ?? 0}件の顧客を登録しました`);
    router.refresh();
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "顧客取り込みサンプル.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="取り込みの手順">
        {[["select", "1. ファイルを選ぶ"], ["map", "2. 列の割り当てと確認"], ["done", "3. 結果"]].map(([key, label]) => (
          <li key={key} aria-current={step === key ? "step" : undefined}
            className={cn("rounded-full border px-3 py-1", step === key ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {label}
          </li>
        ))}
      </ol>

      {step === "select" && (
        <Card>
          <CardContent className="grid gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void load(e.dataTransfer.files[0]); }}
              className={cn("flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center", dragging && "border-primary bg-primary/5")}
            >
              <FileSpreadsheet className="size-10 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">CSV ファイルをここにドロップ</p>
                <p className="text-sm text-muted-foreground">UTF-8・Shift_JIS（Excel で保存した CSV）に対応。2MB・{MAX_ROWS}行まで</p>
              </div>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file" onChange={(e) => void load(e.target.files?.[0])} />
              <Button onClick={() => inputRef.current?.click()}><Upload />ファイルを選ぶ</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>1行目は見出しにしてください。見出しの名前から列を自動で割り当てます。</span>
              <Button variant="ghost" size="sm" onClick={download}><Download />サンプル CSV</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "map" && mapping && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">列の割り当て</CardTitle>
              <CardDescription>{fileName}（{body.length}行）。取り込む項目と CSV の列を対応させてください</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CUSTOMER_IMPORT_FIELDS.map((f) => (
                <label key={f.key} className="grid gap-1 text-sm">
                  <span className="font-medium">{f.label}</span>
                  <SelectField
                    value={mapping[f.key] === null ? "" : String(mapping[f.key])} noneLabel="（取り込まない）" ariaLabel={`${f.label}に割り当てる列`}
                    onChange={(v) => setMapping({ ...mapping, [f.key]: v === "" ? null : Number(v) })}
                    options={header.map((h, i) => ({ value: String(i), label: `${i + 1}列目：${h || "（見出しなし）"}` }))}
                  />
                </label>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
              <div>
                <CardTitle className="text-base">プレビューと検証</CardTitle>
                <CardDescription>
                  <span className="text-success-strong">取り込める行 {okCount}件</span>
                  {checks.length - okCount > 0 && <span className="text-danger-strong">・エラー {checks.length - okCount}件（取り込みません）</span>}
                  。登録済みの顧客とのメール重複は、取り込み時に確認します。
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("select")} disabled={busy}>ファイルを選び直す</Button>
                <Button onClick={submit} disabled={busy || okCount === 0}>
                  {busy && <Loader2 className="animate-spin" aria-hidden />}
                  {okCount}件を取り込む
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[480px] overflow-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>行</TableHead>
                    <TableHead>判定</TableHead>
                    {CUSTOMER_IMPORT_FIELDS.filter((f) => mapping[f.key] !== null).map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 200).map((r, i) => (
                    <TableRow key={i} className={cn(!checks[i].ok && "bg-danger-soft/50")}>
                      <TableCell className="tabular text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="min-w-48">
                        {checks[i].ok ? <span className="inline-flex items-center gap-1 text-success-strong"><CheckCircle2 className="size-4" aria-hidden />OK</span>
                          : <span className="text-xs text-danger-strong"><XCircle className="mr-1 inline size-4" aria-hidden />{checks[i].errors.join("／")}</span>}
                      </TableCell>
                      {CUSTOMER_IMPORT_FIELDS.filter((f) => mapping[f.key] !== null).map((f) => (
                        <TableCell key={f.key} className="max-w-48 truncate">{r[f.key]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 200 && <p className="px-5 py-3 text-xs text-muted-foreground">先頭200行を表示しています（取り込みは全{rows.length}行が対象）</p>}
            </CardContent>
          </Card>
        </>
      )}

      {step === "done" && outcome && (
        <Card>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-8 text-success-strong" aria-hidden />
              <div>
                <p className="text-lg font-semibold">{outcome.imported}件を登録しました</p>
                <p className="text-sm text-muted-foreground">取り込まなかった行：{outcome.skipped}件</p>
              </div>
            </div>
            {outcome.results.some((r) => !r.ok) && (
              <ul className="grid gap-1 rounded-md border bg-danger-soft/40 p-3 text-sm">
                {outcome.results.filter((r) => !r.ok).slice(0, 50).map((r) => (
                  <li key={r.row}><span className="tabular font-medium">{r.row}行目</span>（{r.label}）：{r.errors.join("／")}</li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button asChild><Link href="/customers">顧客一覧へ</Link></Button>
              <Button variant="outline" onClick={() => { setStep("select"); setOutcome(null); }}>続けて取り込む</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
