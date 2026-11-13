import { expect, startDemo, test } from "./fixtures";

/** スマートフォン幅：横にはみ出さず、主要な画面が使える */
test("@mobile 主要な画面が横にはみ出さない", async ({ page }) => {
  // 一般担当者が開ける画面だけを回る（権限のない画面はダッシュボードへ戻される。
  // 画面は読み込み中の表示から順に送られるので、その戻しは読み込み後のブラウザ側の移動になる）
  await startDemo(page, "member");
  for (const path of ["/dashboard", "/inquiries", "/customers", "/deals", "/deals/board", "/tasks", "/activities", "/alerts"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("@mobile メニューから問い合わせ一覧へ移動できる", async ({ page }) => {
  await startDemo(page, "member");
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await page.getByRole("dialog").getByRole("link", { name: /^問い合わせ/ }).click();
  await expect(page).toHaveURL(/\/inquiries$/);
});

test("@both 紹介ページ（このシステムについて）", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("月20時間").first()).toBeVisible();
});
