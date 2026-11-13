import { expect, expectToast, startDemo, test } from "./fixtures";

/** 中心の流れ：問い合わせ登録 → 対応を記録 → 案件化 → ボードで進める → タスク完了 */
test("問い合わせから受注までの流れ", async ({ page }) => {
  await startDemo(page, "manager");
  const title = `E2E 予約サイトの相談 ${Date.now()}`;

  // 問い合わせを登録
  await page.goto("/inquiries/new");
  await page.getByLabel("件名").fill(title);
  await page.getByLabel("会社名").fill("株式会社テスト商事");
  await page.getByLabel("氏名").fill("新井 太郎");
  await page.getByLabel("メールアドレス").fill("arai@example.com");
  await page.getByRole("button", { name: "登録する" }).click();
  await expectToast(page, "問い合わせを登録しました");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // 対応を記録（未対応 → 対応中）
  await page.getByRole("button", { name: "対応を記録" }).first().click();
  const activity = page.getByRole("dialog", { name: "対応履歴を記録" });
  await activity.getByLabel("対応内容").fill("お電話で要件をヒアリング。予算と時期を確認");
  await activity.getByRole("button", { name: /記録/ }).last().click();
  await expectToast(page, "対応履歴を記録しました");
  await expect(page.getByText("お電話で要件をヒアリング。予算と時期を確認")).toBeVisible();

  // 案件化
  await page.getByRole("button", { name: "案件化する" }).click();
  const convert = page.getByRole("dialog", { name: "問い合わせを案件化" });
  await convert.getByLabel("見積金額（税抜・円）").fill("1,500,000");
  await convert.getByRole("button", { name: "案件化する" }).click();
  await page.waitForURL(/\/deals\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // ボードで「提案」の列へドラッグ
  await page.goto("/deals/board");
  const col = (n: string) => page.getByRole("region", { name: `${n}の列` });
  const card = col("ヒアリング").locator("article").filter({ hasText: title });
  await expect(card).toBeVisible();
  const handle = card.getByRole("button", { name: /ドラッグして移動/ });
  const hb = (await handle.boundingBox())!;
  const tb = (await col("提案").boundingBox())!;
  await page.mouse.move(hb.x + 5, hb.y + 5);
  await page.mouse.down();
  await page.mouse.move(hb.x + 40, hb.y + 40, { steps: 5 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + 100, { steps: 10 });
  await page.mouse.up();
  await expectToast(page, title);
  await page.reload();
  await expect(col("提案").locator("article").filter({ hasText: title })).toBeVisible();

  // 案件化で自動作成されたタスクを完了にする
  await col("提案").locator("article").filter({ hasText: title }).getByRole("link", { name: title }).click();
  const done = page.getByRole("checkbox", { name: /ヒアリングの日程調整.*を完了にする/ });
  await done.click();
  await expectToast(page, /を完了にしました/);
});
