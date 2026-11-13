import { expect, startDemo, switchPersona, test } from "./fixtures";

test("一般担当者は設定・分析・CSV取り込みを開けない", async ({ page }) => {
  await startDemo(page, "member");
  for (const path of ["/settings", "/analytics", "/customers/import"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard\?denied=1$/);
  }
  const res = await page.request.get("/api/export/customers");
  expect(res.status()).toBe(403);
});

test("マネージャーは分析を開けるが設定は開けない。管理者は設定を開ける", async ({ page }) => {
  await startDemo(page, "manager");
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "営業分析", level: 1 })).toBeVisible();
  await page.goto("/settings");
  await expect(page).toHaveURL(/denied=1/);
  await switchPersona(page, "admin");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
});

test("CSV は BOM 付き UTF-8 で日本語のファイル名", async ({ page }) => {
  await startDemo(page, "manager");
  const res = await page.request.get("/api/export/inquiries");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("filename*=UTF-8''");
  const body = await res.body();
  expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
});

test("ログインしていなければログイン画面へ", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
