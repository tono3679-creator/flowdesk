"use client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/** フォームの区切り（見出し付きのまとまり） */
export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-keep mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}

/** 画面下の保存ボタン（スマホでは下に固定） */
export function FormActions({ busy, submitLabel, onCancel }: { busy: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>キャンセル</Button>
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {submitLabel}
      </Button>
    </div>
  );
}

/** サーバーから返ってきた項目別エラーを react-hook-form に反映する */
export function applyFieldErrors(
  fieldErrors: Record<string, string> | undefined,
  setError: (name: never, error: { type: string; message: string }) => void,
) {
  for (const [name, message] of Object.entries(fieldErrors ?? {})) setError(name as never, { type: "server", message });
}
