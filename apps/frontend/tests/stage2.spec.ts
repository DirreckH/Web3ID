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
  await page.setViewportSize({ width: 390, height: 844 });
});

test("mobile wallet shell, dialogs, and bottom navigation work", async ({ page }) => {
  const errors = trackPageErrors(page);

  await page.goto("/");
  await expect(page.getByTestId("wallet-page")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();

  await page.getByTestId("wallet-add-card").click();
  const addCardModal = page.getByTestId("add-card-modal");
  await expect(addCardModal).toBeVisible();
  await addCardModal.getByRole("button", { name: "BNB Chain" }).click();
  await addCardModal.getByRole("textbox").fill("0x1234567890abcdef1234567890abcdef12345678");
  await addCardModal.locator("div.border-t button").click();
  await addCardModal.locator("div.border-t button").click();
  await expect(page.getByText("0x1234...5678")).toBeVisible();
  await expect(page.getByText("BNB Chain")).toBeVisible();

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
  await page.getByTestId("identity-lane-card-rwa").scrollIntoViewIfNeeded();
  await page.getByTestId("identity-lane-card-rwa").click({ force: true });
  await expect(page.getByTestId("identity-root-overview")).toBeHidden();
  await expect(page.getByTestId("identity-regulation-detail-rwa")).toBeVisible();
  await page.getByTestId("identity-lane-card-gaming").scrollIntoViewIfNeeded();
  await page.getByTestId("identity-lane-card-gaming").click({ force: true });
  await expect(page.getByTestId("identity-regulation-detail-rwa")).toBeHidden();
  await expect(page.getByTestId("identity-regulation-detail-gaming")).toBeVisible();
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
