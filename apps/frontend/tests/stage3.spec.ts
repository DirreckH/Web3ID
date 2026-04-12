import { expect, test, type Page } from "@playwright/test";

const laneExpectations = [
  { id: "rwa", headline: "Collateral routing velocity jumped across unfamiliar settlement clusters." },
  { id: "defi", headline: "Bridge volume spiked right after a lending position was unwound." },
  { id: "social", headline: "Delegate rights were re-bound to a new vault before the weekly vote checkpoint." },
  { id: "gaming", headline: "Tournament reward claims settled through a fresh payout wallet cluster." },
] as const;

function trackPageErrors(page: Page) {
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

async function addCard(page: Page, networkName: string) {
  await page.getByTestId("wallet-add-card").click();
  const addCardModal = page.getByTestId("add-card-modal");
  await expect(addCardModal).toBeVisible();
  await addCardModal.getByRole("button", { name: networkName }).click();
  await addCardModal.getByRole("textbox").fill("0x1234567890abcdef1234567890abcdef12345678");
  const footerButton = addCardModal.locator("div.border-t button").last();
  await expect(footerButton).toBeEnabled();
  await footerButton.click();
  await expect(addCardModal.getByRole("textbox")).toHaveCount(0);
  await expect(footerButton).toBeEnabled();
  await footerButton.click();
  await expect(addCardModal).toBeHidden();
}

async function expectRecentEventsForLane(page: Page, laneId: string, expectedHeadline: string) {
  await page.getByTestId(`identity-lane-card-${laneId}`).scrollIntoViewIfNeeded();
  await page.getByTestId(`identity-lane-card-${laneId}`).click({ force: true });

  const detail = page.getByTestId(`identity-regulation-detail-${laneId}`);
  await expect(detail).toBeVisible();

  const recentEvents = detail.getByTestId("identity-detail-recent-events");
  await expect(recentEvents).toBeVisible();
  await expect(recentEvents.getByTestId("identity-recent-events-count")).toBeVisible();

  const eventCards = recentEvents.getByTestId("identity-recent-event-card");
  const eventCardCount = await eventCards.count();
  expect(eventCardCount).toBeGreaterThanOrEqual(2);

  await expect(eventCards.first()).toContainText(expectedHeadline);
  await expect(recentEvents.getByTestId("identity-recent-event-summary").first()).toBeVisible();
  await expect(recentEvents.getByTestId("identity-recent-event-actions").first()).toBeVisible();
  await expect(recentEvents.getByTestId("identity-recent-event-window").first()).toBeVisible();
  await expect(recentEvents.getByTestId("identity-recent-event-impact").first()).toBeVisible();

  expect(await recentEvents.locator('[data-source="onchain"]').count()).toBe(eventCardCount);
  await expect(recentEvents.locator('[data-source="sanctions"]')).toHaveCount(0);
  await expect(recentEvents.locator('[data-source="governance"]')).toHaveCount(0);
  await expect(recentEvents.locator('[data-source="advisor"]')).toHaveCount(0);

  return detail;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
});

test("desktop routes, trade flow, redirects, and language persistence work", async ({ page }) => {
  const errors = trackPageErrors(page);

  await page.goto("/");
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("mobile-nav-portfolio")).toBeVisible();
  const walletShell = await page.getByTestId("desktop-core-shell").boundingBox();
  const navBox = await page.getByTestId("mobile-bottom-nav").boundingBox();
  expect(walletShell).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(walletShell!.width).toBeLessThan(1400);
  expect(walletShell!.x).toBeGreaterThan(0);
  expect(navBox!.width).toBeLessThan(900);

  await page.getByTestId("mobile-nav-portfolio").click();
  await expect(page.getByTestId("portfolio-page")).toBeVisible();

  await page.getByTestId("mobile-nav-wallet").click();
  await expect(page.getByTestId("wallet-page")).toBeVisible();

  await addCard(page, "Ethereum Mainnet");
  await page.getByText("0x1234...5678").click();
  await expect(page.getByTestId("identity-tree-modal")).toBeVisible();
  await expect(page.getByTestId("identity-root-card")).toBeVisible();

  await page.getByTestId("identity-root-card").click({ force: true });
  await expect(page.getByTestId("identity-root-overview")).toBeVisible();

  const rwaDetail = await expectRecentEventsForLane(page, laneExpectations[0].id, laneExpectations[0].headline);
  const rootBox = await page.getByTestId("identity-root-card").boundingBox();
  const laneBox = await page.getByTestId("identity-lane-card-rwa").boundingBox();
  const detailBox = await rwaDetail.boundingBox();
  expect(rootBox).not.toBeNull();
  expect(laneBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(rootBox!.y).toBeLessThan(laneBox!.y);
  expect(detailBox!.width).toBeGreaterThan(laneBox!.width * 1.8);
  await expect(page.getByTestId("identity-root-overview")).toBeHidden();

  for (const lane of laneExpectations.slice(1)) {
    await expectRecentEventsForLane(page, lane.id, lane.headline);
  }

  await page.getByLabel("Close identity tree").click();
  await expect(page.getByTestId("identity-tree-modal")).toBeHidden();

  await page.goto("/mall");
  await expect(page.getByTestId("trade-page")).toBeVisible();
  const tradeShell = await page.getByTestId("desktop-core-shell").boundingBox();
  expect(tradeShell).not.toBeNull();
  expect(tradeShell!.width).toBeLessThan(1400);
  await expect(page.getByTestId("trade-asset-type-restricted")).toBeVisible();
  await page.getByTestId("trade-asset-type-private-credit").click();
  await expect(page.getByTestId("trade-token-credit")).toBeVisible();
  await page.getByTestId("trade-asset-type-all").click();
  await expect(page.getByTestId("trade-product-etf")).toBeVisible();
  await page.getByTestId("trade-product-etf").click();
  await expect(page.getByTestId("trade-token-nyc-etf")).toBeVisible();
  await page.getByTestId("trade-product-spot").click();
  await page.getByTestId("trade-token-nyc").click();
  await page.getByTestId("trade-timeframe-4h").click();
  await page.getByTestId("trade-buy-button").click();
  await expect(page.getByTestId("trade-order-modal")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("trade-order-processing")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Close" }).click();

  await page.goto("/market");
  await expect(page).toHaveURL(/\/mall\/?$/);
  await expect(page.getByTestId("trade-page")).toBeVisible();

  await page.goto("/assets");
  await expect(page).toHaveURL(/\/mall\/?$/);
  await expect(page.getByTestId("trade-page")).toBeVisible();

  await page.goto("/portfolio");
  await expect(page.getByTestId("portfolio-page")).toBeVisible();
  const portfolioShell = await page.getByTestId("desktop-core-shell").boundingBox();
  expect(portfolioShell).not.toBeNull();
  expect(portfolioShell!.width).toBeLessThan(1400);
  await expect(page.getByTestId("portfolio-page")).toHaveAttribute("class", /lg:rounded-\[34px\]/);

  await page.goto("/history");
  await expect(page.getByTestId("history-page")).toBeVisible();
  const historyShell = await page.getByTestId("desktop-core-shell").boundingBox();
  expect(historyShell).not.toBeNull();
  expect(historyShell!.width).toBeLessThan(1400);
  await expect(page.getByTestId("history-page")).toHaveAttribute("class", /lg:rounded-\[34px\]/);

  await page.goto("/profile");
  await expect(page.getByTestId("profile-page")).toBeVisible();
  const profileShell = await page.getByTestId("desktop-core-shell").boundingBox();
  expect(profileShell).not.toBeNull();
  expect(profileShell!.width).toBeLessThan(1400);
  await page.getByTestId("profile-language-button").click();
  await expect(page.getByTestId("language-modal")).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await page.getByTestId("language-confirm").click();
  await page.reload();
  await expect(page.getByTestId("mobile-nav-wallet")).toContainText("Wallet");

  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});
