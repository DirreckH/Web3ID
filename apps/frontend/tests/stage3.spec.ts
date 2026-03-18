import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { deriveRootIdentity, listDefaultSubIdentities, SubIdentityType } from "../../../packages/identity/src/index.js";
import { DEFAULT_ACCOUNT, installMockWallet } from "./mockWallet";

const MIXER_ADDRESS = "0x00000000000000000000000000000000000000a1";
const rootIdentity = deriveRootIdentity(DEFAULT_ACCOUNT as `0x${string}`, 31337);
const rwaIdentity = listDefaultSubIdentities(rootIdentity).find((item) => item.type === SubIdentityType.RWA_INVEST)!;

async function waitForDemoReady(request: APIRequestContext) {
  await expect
    .poll(async () => {
      const issuer = await request.get("http://127.0.0.1:4100/health");
      const analyzer = await request.get("http://127.0.0.1:4200/health");
      const policy = await request.get("http://127.0.0.1:4300/health");
      const rpc = await request.post("http://127.0.0.1:8545", {
        data: { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
      });
      return issuer.ok() && analyzer.ok() && policy.ok() && rpc.ok();
    }, { timeout: 180_000 })
    .toBe(true);
}

async function connectAndDeriveIdentity(page: Page, request: APIRequestContext) {
  await waitForDemoReady(request);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByText(DEFAULT_ACCOUNT, { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Sign Identity Challenge" }).click();
  await expect(page.getByText("Identity tree ready.")).toBeVisible({ timeout: 30_000 });
}

async function issueCredentialAndBuildPayload(page: Page) {
  await page.getByRole("button", { name: "Issue Scenario Credential" }).click();
  await expect(page.getByText("Credential issued.")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Build Access Payload" }).click();
  await expect(page.getByText("Access payload ready.")).toBeVisible({ timeout: 120_000 });
}

async function seedFreshMixerReview(request: APIRequestContext) {
  const txResponse = await request.post("http://127.0.0.1:8545", {
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendTransaction",
      params: [{ from: DEFAULT_ACCOUNT, to: MIXER_ADDRESS, value: "0x1" }],
    },
  });
  expect(txResponse.ok()).toBe(true);
  await request.post("http://127.0.0.1:4200/scan/backfill", {
    data: { identityId: rwaIdentity.identityId, recentBlocks: 8 },
  });
}

async function waitForPendingReview(request: APIRequestContext, identityId: `0x${string}`) {
  await expect
    .poll(async () => {
      const response = await request.get(`http://127.0.0.1:4200/identities/${identityId}/risk-context`);
      if (!response.ok()) {
        return false;
      }
      const payload = (await response.json()) as { reviewQueue?: Array<{ status?: string }> };
      return (payload.reviewQueue ?? []).some((item) => item.status === "PENDING_REVIEW");
    }, { timeout: 30_000 })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await installMockWallet(page);
});

test.describe.serial("stage3 console", () => {
  test("binds, manages watches, processes review items, and evaluates access decisions", async ({ page, request }) => {
    await connectAndDeriveIdentity(page, request);
    const phase3Panel = page.locator("article.panel").filter({ has: page.getByRole("heading", { name: "9. Phase3 Risk View" }) });
    const watchConsole = phase3Panel.locator(".info-card").filter({ has: page.getByRole("heading", { name: "Watch Console" }) });
    const watchStatusPre = watchConsole.locator("pre");
    const phase3SummaryPre = phase3Panel.locator("pre").filter({ hasText: '"manualReleaseWindow"' }).first();
    const policyPanel = page.locator("article.panel").filter({ has: page.getByRole("heading", { name: "10. Policy & Review Queue" }) });
    const accessDecisionPre = policyPanel.locator("pre").filter({ hasNotText: "counterpartySummary" }).first();
    const warningDecisionPre = policyPanel.locator("pre").filter({ hasText: "counterpartySummary" }).first();

    await page.getByRole("button", { name: "Create Root Binding" }).click();
    await expect(page.getByText("Root-controller binding recorded.")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Create Sub Binding" }).click();
    await expect(page.getByText("Sub-identity binding recorded.")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Start Watch" }).click();
    await expect(page.getByText("Watcher start completed.")).toBeVisible({ timeout: 30_000 });
    await expect(watchStatusPre).toContainText('"status": "ACTIVE"', { timeout: 30_000 });

    await page.getByRole("button", { name: "Enterprise Treasury" }).click();
    await issueCredentialAndBuildPayload(page);
    await expect(accessDecisionPre).toContainText('"decision": "allow"', { timeout: 120_000 });

    await page.getByRole("button", { name: "RWA Access" }).click();
    await seedFreshMixerReview(request);
    await waitForPendingReview(request, rwaIdentity.identityId);
    await page.getByRole("button", { name: "Refresh Watch" }).click();
    await expect(page.getByText("Watcher refresh completed.")).toBeVisible({ timeout: 30_000 });

    const firstPendingReview = page.locator(".review-item").filter({ hasText: "PENDING_REVIEW" }).first();
    await expect(firstPendingReview).toBeVisible({ timeout: 30_000 });
    await firstPendingReview.getByRole("button", { name: "Dismiss Review" }).click();
    await expect(page.getByText("Review item dismissed.")).toBeVisible({ timeout: 30_000 });

    await seedFreshMixerReview(request);
    await waitForPendingReview(request, rwaIdentity.identityId);
    await page.getByRole("button", { name: "Refresh Watch" }).click();
    await expect(page.getByText("Watcher refresh completed.")).toBeVisible({ timeout: 30_000 });

    const refreshedPendingReview = page.locator(".review-item").filter({ hasText: "PENDING_REVIEW" }).first();
    await expect(refreshedPendingReview).toBeVisible({ timeout: 30_000 });
    await refreshedPendingReview.getByRole("button", { name: "Confirm Review" }).click();
    await expect(page.getByText("Review item confirmed.")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Stop Watch" }).click();
    await expect(page.getByText("Watcher stop completed.")).toBeVisible({ timeout: 30_000 });
    await expect(watchStatusPre).toContainText('"status": "STOPPED"', { timeout: 30_000 });

    await issueCredentialAndBuildPayload(page);
    await expect(accessDecisionPre).toContainText(/"decision": "(deny|restrict)"/, { timeout: 120_000 });
    await expect(warningDecisionPre).toContainText('"decision": "high_warn"', { timeout: 30_000 });

    await page.getByRole("button", { name: "Apply Manual Release" }).click();
    await expect(page.getByText("Manual release applied.")).toBeVisible({ timeout: 30_000 });
    await expect(accessDecisionPre).toContainText(/"decision": "(deny|restrict)"/, { timeout: 60_000 });
    await expect(phase3SummaryPre).toContainText('"floorState": 2', { timeout: 60_000 });
    await expect(phase3SummaryPre).toContainText('"releaseFloorActive": true', { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Submit buyRwa" })).toBeEnabled();
  });
});
