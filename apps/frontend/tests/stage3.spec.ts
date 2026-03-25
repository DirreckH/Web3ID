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

test.setTimeout(180_000);

test("bottom navigation stays unified across breakpoints and wallet empty hero remains visible", async ({ page }) => {
  const errors = trackPageErrors(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("wallet-page")).toBeVisible();
  await expect(page.getByTestId("wallet-empty-hero")).toBeVisible();
  const firstReplay = await page.getByTestId("wallet-empty-state").getAttribute("data-replay");
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("mobile-nav-portfolio")).toBeVisible();

  await page.goto("/mall");
  await expect(page.getByTestId("trade-page")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await page.getByTestId("mobile-nav-wallet").click();
  await expect(page.getByTestId("wallet-empty-hero")).toBeVisible();
  await expect
    .poll(async () => page.getByTestId("wallet-empty-state").getAttribute("data-replay"))
    .not.toEqual(firstReplay);

  await page.goto("/profile");
  await expect(page.getByTestId("profile-page")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/");
  await expect(page.getByTestId("wallet-page")).toBeVisible();
  await expect(page.getByTestId("wallet-empty-hero")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("desktop-top-nav")).toHaveCount(0);

  await page.goto("/mall");
  await expect(page.getByTestId("trade-page")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await page.getByTestId("mobile-nav-wallet").click();
  await expect(page.getByTestId("wallet-empty-hero")).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByTestId("profile-page")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();

  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});

test("desktop routes, unified trade flow, and language persistence work", async ({ page }) => {
  const errors = trackPageErrors(page);

  await page.goto("/");
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();

  await page.getByTestId("wallet-add-card").click();
  await page.getByRole("button", { name: "Ethereum Mainnet" }).click();
  await page.getByTestId("wallet-address-input").fill("0x1234567890abcdef1234567890abcdef12345678");
  await page.getByTestId("wallet-address-next").click();
  await page.getByTestId("wallet-sign-confirm").click();
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
  const tradeAssetTabs = page.locator('[data-testid^="trade-asset-type-"]');
  await expect(tradeAssetTabs.nth(0)).toHaveAttribute("data-testid", "trade-asset-type-all");
  await expect(tradeAssetTabs.nth(1)).toHaveAttribute("data-testid", "trade-asset-type-restricted");
  await expect(page.getByTestId("trade-asset-type-restricted")).toHaveAttribute("data-accent", "danger");
  await expect(page.getByTestId("trade-asset-type-restricted")).toHaveClass(/text-red-400/);
  await expect(page.getByTestId("trade-eligibility-badge-nyc")).toContainText("可购买");
  await expect(page.getByTestId("trade-eligibility-reason-nyc")).toContainText("发行方策略");
  await page.getByTestId("trade-asset-type-private-credit").click();
  await expect(page.getByTestId("trade-token-credit")).toBeVisible();
  const privateCreditCount = await page.locator('[data-testid^="trade-token-"]').count();
  expect(privateCreditCount).toBeGreaterThanOrEqual(3);
  await page.getByTestId("trade-product-etf").click();
  await expect(page.getByTestId("trade-token-credit-etf")).toBeVisible();
  const privateCreditEtfCount = await page.locator('[data-testid^="trade-token-"]').count();
  expect(privateCreditEtfCount).toBeGreaterThanOrEqual(3);
  await page.getByTestId("trade-asset-type-real-estate").click();
  await page.getByTestId("trade-token-nyc-etf").click();
  await expect(page.getByTestId("trade-eligibility-summary")).toContainText("可购买");
  await expect(page.getByTestId("trade-eligibility-summary")).toContainText("还差哪一步");
  await expect(page.getByTestId("trade-buy-eligibility-card")).toContainText("下一步");
  await expect(page.getByTestId("trade-buy-button")).toContainText("立即购买");
  await page.getByTestId("trade-timeframe-4h").click();
  await page.getByTestId("trade-buy-button").click();
  await expect(page.getByTestId("web3id-purchase-flow")).toBeVisible();
  await expect(page.getByTestId("purchase-holding-impact")).toBeVisible();
  await page.getByTestId("purchase-flow-next").click();
  await expect(page.getByTestId("purchase-trust-signals")).toBeVisible();
  await page.getByTestId("purchase-flow-start").click();
  await expect(page.getByTestId("purchase-card-identity")).toBeVisible();
  await expect(page.getByTestId("purchase-card-credentials")).toBeVisible();
  await expect(page.getByTestId("purchase-card-payload")).toBeVisible();
  await expect(page.getByTestId("purchase-card-precheck")).toBeVisible();
  await expect(page.getByTestId("purchase-card-execution")).toBeVisible();
  await expect(page.getByTestId("purchase-live-status")).toHaveText(/交易广播中|等待区块确认|链上执行完成/);
  await expect(page.getByTestId("purchase-card-evidence")).toBeVisible();
  await expect(page.getByTestId("purchase-evidence-timeline")).toContainText("资格判断");
  await expect(page.getByTestId("purchase-card-result-approved")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("purchase-step-complete")).toBeVisible();
  await expect(page.getByTestId("purchase-result-check")).toBeVisible();
  await expect(page.getByTestId("purchase-result-effect")).toBeVisible();
  await expect(page.getByTestId("purchase-success-celebration")).toBeVisible();
  await expect(page.getByTestId("purchase-holding-impact")).toContainText("购买后");
  await page.getByTestId("purchase-audit-details-toggle").click();
  await expect(page.getByTestId("purchase-audit-details-panel")).toContainText("Payload Hash");
  const approvedDownload = page.waitForEvent("download");
  await page.getByTestId("purchase-export-audit-pack").click();
  await approvedDownload;
  await page.getByTestId("purchase-flow-complete").click();
  await expect(page.getByTestId("web3id-purchase-flow")).toBeHidden();
  await page.getByTestId("trade-side-sell").click();
  await page.getByTestId("trade-buy-button").click();
  await expect(page.getByTestId("trade-order-modal")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Close" }).click();

  await page.goto("/market");
  await expect(page.getByTestId("trade-page")).toBeVisible();
  await expect(page).toHaveURL(/\/mall$/);
  await page.goto("/assets");
  await expect(page.getByTestId("trade-page")).toBeVisible();
  await expect(page).toHaveURL(/\/mall$/);

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

test("trade review and restricted branches keep auditable outcomes", async ({ page }) => {
  const errors = trackPageErrors(page);

  await page.goto("/mall");
  await expect(page.getByTestId("trade-page")).toBeVisible();

  await page.getByTestId("trade-asset-type-ip-royalties").click();
  await expect(page.getByTestId("trade-eligibility-badge-hollywood-ip")).toContainText("需复核");
  await page.getByTestId("trade-token-streaming-ip").click();
  await expect(page.getByTestId("trade-buy-button")).toContainText("提交购买并进入复核");
  await page.getByTestId("trade-buy-button").click();
  await page.getByTestId("purchase-flow-next").click();
  await page.getByTestId("purchase-flow-start").click();
  await expect(page.getByTestId("purchase-card-identity")).toBeVisible();
  await expect(page.getByTestId("purchase-card-precheck")).toBeVisible({ timeout: 12000 });
  await expect(page.getByTestId("purchase-card-review")).toBeVisible({ timeout: 12000 });
  await expect(page.getByTestId("purchase-card-evidence")).toBeVisible();
  await expect(page.getByTestId("purchase-card-result-review")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("purchase-result-effect")).toBeVisible();
  await expect(page.getByTestId("purchase-success-celebration")).toHaveCount(0);
  await expect(page.getByTestId("purchase-holding-impact")).toContainText("持仓暂不发生变更");
  await page.getByTestId("purchase-audit-details-toggle").click();
  await expect(page.getByTestId("purchase-audit-details-panel")).toContainText("Review Ticket");
  const reviewDownload = page.waitForEvent("download");
  await page.getByTestId("purchase-export-audit-pack").click();
  await reviewDownload;
  await page.getByTestId("purchase-flow-close").click();
  await expect(page.getByTestId("web3id-purchase-flow")).toBeHidden();

  await page.goto("/mall");
  await expect(page.getByTestId("trade-page")).toBeVisible();
  await page.getByTestId("trade-asset-type-restricted").click();
  await expect(page.getByTestId("trade-asset-type-restricted")).toHaveClass(/text-red-600/);
  await expect(page.getByTestId("trade-eligibility-badge-defense-equity")).toContainText("限制购买");
  await page.getByTestId("trade-token-defense-equity").click();
  await expect(page.getByTestId("trade-buy-button")).toContainText("查看限制原因");
  await page.getByTestId("trade-buy-button").click();
  await page.getByTestId("purchase-flow-next").click();
  await page.getByTestId("purchase-flow-start").click();
  await expect(page.getByTestId("purchase-card-identity")).toBeVisible();
  await expect(page.getByTestId("purchase-card-precheck")).toBeVisible({ timeout: 12000 });
  await expect(page.getByTestId("purchase-card-restricted")).toBeVisible({ timeout: 12000 });
  await expect(page.getByTestId("purchase-card-evidence")).toBeVisible();
  await expect(page.getByTestId("purchase-card-result-restricted")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("purchase-result-effect")).toBeVisible();
  await expect(page.getByTestId("purchase-success-celebration")).toHaveCount(0);
  await expect(page.getByTestId("purchase-holding-impact")).toContainText("持仓不会发生变化");
  await page.getByTestId("purchase-audit-details-toggle").click();
  await expect(page.getByTestId("purchase-audit-details-panel")).toContainText("Policy Reference");
  await page.getByTestId("purchase-flow-close").click();
  await expect(page.getByTestId("web3id-purchase-flow")).toBeHidden();

  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});
