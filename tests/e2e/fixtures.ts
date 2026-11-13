import { test as base, expect, type Page } from "@playwright/test";

export { expect };

// 公開環境に対して実行したときは、テストで作ったデモ組織を画面の「デモを終了する」で片付ける
// （ローカルでは片付けない。失敗したときに画面を残して調べられるように）。全テストに自動で付く
export const test = base.extend<{ cleanupDemo: void }>({
  cleanupDemo: [async ({ page }, use) => {
    await use();
    if (!process.env.E2E_BASE_URL) return;
    const menu = page.getByRole("button", { name: "ユーザーメニュー" }).first();
    if (!(await menu.isVisible().catch(() => false))) return;
    await menu.click();
    const end = page.getByRole("menuitem", { name: "デモを終了する" });
    if (await end.isVisible().catch(() => false)) {
      await end.click();
      await page.waitForURL(/\/login/).catch(() => {});
    } else {
      await page.keyboard.press("Escape");
    }
  }, { auto: true }],
});

export type Persona = "admin" | "manager" | "member";
const PERSONA_BUTTON: Record<Persona, RegExp> = { admin: /管理者として体験/, manager: /マネージャーとして体験/, member: /一般担当者として体験/ };
const PERSONA_LABEL: Record<Persona, string> = { admin: "管理者", manager: "マネージャー", member: "担当者" };

/** ログイン画面から自分専用のデモ組織（株式会社NextWorks）を作って入る */
export async function startDemo(page: Page, persona: Persona = "manager") {
  await page.goto("/login");
  await page.getByRole("button", { name: PERSONA_BUTTON[persona] }).click();
  await page.waitForURL(/\/dashboard$/);
}

/** 画面上部のバナーで、同じデモ組織の別の人として入り直す */
export async function switchPersona(page: Page, persona: Persona) {
  // 画面の読み込み（ハイドレーション）が終わる前に押すと反応しないので待つ
  await page.waitForLoadState("networkidle");
  const group = page.getByRole("group", { name: "体験する役割" });
  await group.getByRole("button", { name: PERSONA_LABEL[persona], exact: true }).click();
  await expect(group.getByRole("button", { name: PERSONA_LABEL[persona], exact: true })).toHaveAttribute("aria-pressed", "true");
}

/** 成功の通知が出るまで待つ */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: text }).first()).toBeVisible();
}
