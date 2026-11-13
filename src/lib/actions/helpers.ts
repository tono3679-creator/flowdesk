import "server-only";
import { z } from "zod";
import type { ActionResult } from "./result";
import { toFieldErrors, toUserMessage } from "./errors";

export const INVALID_INPUT = "入力内容を確認してください";

/** 入力を検証し、失敗したら項目別のエラーを返す */
export function validate<S extends z.ZodType>(schema: S, input: unknown): { ok: true; data: z.output<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, result: { ok: false, error: INVALID_INPUT, fieldErrors: toFieldErrors(parsed.error) } };
  return { ok: true, data: parsed.data };
}

/** DB の処理を実行し、例外を利用者向けのメッセージにする */
export async function run<T>(fn: () => Promise<T>, fallback?: string): Promise<{ ok: true; value: T } | { ok: false; result: ActionResult<never> }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, result: { ok: false, error: toUserMessage(e, fallback) } };
  }
}

export const uuidSchema = z.uuid();
