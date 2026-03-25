import { expect, test } from "@playwright/test";

function trackPageErrors(page: Parameters<(typeof test)["beforeEach"]>[0][0]["page"]) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
});

test("desktop routes, trade flow, market purchase, and language persistence work", async ({ page }) => {
  const errors = trackPageErrors(page);

  await page.goto("/");
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("mobile-nav-portfolio")).toBeVisible();
  await page.getByTestId("mobile-nav-portfolio").click();
  await expect(page.getByTestId("portfolio-page")).toBeVisible();
  await page.getByTestId("mobile-nav-wallet").click();
  await expect(page.getByTestId("wallet-page")).toBeVisible();

  await page.getByTestId("wallet-add-card").click();
  await page.getByRole("button", { name: "Ethereum Mainnet" }).click();
  await page.getByPlaceholder("输入您的钱包地址").fill("0x1234567890abcdef1234567890abcdef12345678");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "签名确认" }).click();
  await page.getByText("0x1234...5678").click();
  await expect(page.getByTestId("identity-tree-modal")).toBeVisible();
  await expect(page.getByTestId("identity-root-card")).toBeVisible();
  await expect(page.getByTestId("identity-lane-card-rwa")).toBeVisible();
  await page.getByTestId("identity-lane-card-rwa").click({ force: true });
  await expect(page.getByTestId("identity-regulation-detail-rwa")).toBeVisible();
  const rootBox = await page.getByTestId("identity-root-card").boundingBox();
  const laneBox = await page.getByTestId("identity-lane-card-rwa").boundingBox();
  expect(rootBox).not.toBeNull();
  expect(laneBox).not.toBeNull();
  expect(rootBox!.y).toBeLessThan(laneBox!.y);
  await page.getByLabel("Close identity tree").click();
  await expect(page.getByTestId("identity-tree-modal")).toBeHidden();

  await page.goto("/mall");
  await expect(page.getByTestId("trade-page")).toBeVisible();
  await page.getByTestId("trade-token-nyc").click();
  await page.getByTestId("trade-timeframe-4h").click();
  await page.getByTestId("trade-buy-button").click();
  await expect(page.getByTestId("trade-order-modal")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Close" }).click();

  await page.goto("/market");
  await expect(page.getByTestId("market-page")).toBeVisible();
  await page.getByTestId("market-filter-real-estate").click();
  await page.getByTestId("market-card-1").click();
  await expect(page.getByTestId("asset-detail-modal")).toBeVisible();
  await page.getByRole("button", { name: "立即购买" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "确认并支付" }).click();
  await expect(page.getByRole("button", { name: "完成" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "完成" }).click();
  await expect(page.getByTestId("asset-detail-modal")).toBeHidden();

  await page.goto("/portfolio");
  await expect(page.getByTestId("portfolio-page")).toBeVisible();

  await page.goto("/history");
  await expect(page.getByTestId("history-page")).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByTestId("profile-page")).toBeVisible();
  await page.getByTestId("profile-language-button").click();
  await expect(page.getByTestId("language-modal")).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await page.getByTestId("language-confirm").click();
  await page.reload();
  await expect(page.getByTestId("mobile-nav-wallet")).toContainText("Wallet");

  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});
