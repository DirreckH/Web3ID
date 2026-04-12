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
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test("mobile wallet shell, dialogs, and bottom navigation work", async ({ page }) => {
  const errors = trackPageErrors(page);

  await page.goto("/");
  await expect(page.getByTestId("wallet-page")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();

  await addCard(page, "BNB Chain");
  await expect(page.getByText("0x1234...5678")).toBeVisible();
  await expect(page.getByTestId("wallet-page").getByText("BNB Chain")).toBeVisible();

  await page.getByTestId("wallet-inbox-button").click();
  await expect(page.getByTestId("messages-inbox")).toBeVisible();
  await page.locator('[data-testid="messages-inbox"] button').first().click();
  await expect(page.getByTestId("messages-inbox")).toBeHidden();

  await page.getByText("0x1234...5678").click();
  await expect(page.getByTestId("identity-tree-modal")).toBeVisible();
  await expect(page.getByTestId("identity-root-card")).toBeVisible();
  await expect(page.getByText("BNB Chain Root")).toBeVisible();

  await page.getByTestId("identity-root-card").click({ force: true });
  await expect(page.getByTestId("identity-root-overview")).toBeVisible();

  for (const lane of laneExpectations) {
    await expectRecentEventsForLane(page, lane.id, lane.headline);
  }

  await expect(page.getByTestId("identity-root-overview")).toBeHidden();
  await page.getByLabel("Close identity tree").click();
  await expect(page.getByTestId("identity-tree-modal")).toBeHidden();

  await page.getByTestId("mobile-nav-trade").click();
  await expect(page.getByTestId("trade-page")).toBeVisible();
  await page.getByTestId("mobile-nav-profile").click();
  await expect(page.getByTestId("profile-page")).toBeVisible();
  await page.getByTestId("mobile-nav-wallet").click();
  await expect(page.getByTestId("wallet-page")).toBeVisible();

  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});
