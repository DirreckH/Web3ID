import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { DEFAULT_ACCOUNT, installMockWallet } from "./mockWallet";

async function waitForDemoReady(request: APIRequestContext) {
  await expect
    .poll(async () => {
      const issuer = await request.get("http://127.0.0.1:4100/health");
      const rpc = await request.post("http://127.0.0.1:8545", {
        data: { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
      });
      return issuer.ok() && rpc.ok();
    }, { timeout: 120_000 })
    .toBe(true);
}

async function connectAndDeriveIdentity(page: Page, request: APIRequestContext) {
  await waitForDemoReady(request);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByText(DEFAULT_ACCOUNT, { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Sign Identity Challenge" }).click();
  await expect(page.getByText("Identity tree ready.")).toBeVisible({ timeout: 20_000 });
}

async function issueCredentialAndBuildPayload(page: Page) {
  await page.getByRole("button", { name: "Issue Scenario Credential" }).click();
  await expect(page.getByText("Credential issued.")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Build Access Payload" }).click();
  await expect(page.getByText("Access payload ready.")).toBeVisible({ timeout: 120_000 });
}

test.beforeEach(async ({ page }) => {
  await installMockWallet(page);
});

test("builds an RWA payload end to end", async ({ page, request }) => {
  await connectAndDeriveIdentity(page, request);
  await issueCredentialAndBuildPayload(page);
  await expect(page.getByRole("button", { name: "Submit buyRwa" })).toBeEnabled();
});

test("switches between scenario controls", async ({ page, request }) => {
  await connectAndDeriveIdentity(page, request);
  await page.locator("select").selectOption({ label: "social / SOCIAL" });
  await expect(page.locator(".hero-card span").nth(0)).toHaveText("social / SOCIAL", { timeout: 15_000 });
  await page.getByRole("button", { name: "Enterprise Treasury" }).click();
  await expect(page.getByRole("button", { name: "Payment", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Audit", exact: true })).toBeVisible();
});

test("builds an enterprise payment payload", async ({ page, request }) => {
  await connectAndDeriveIdentity(page, request);
  await page.getByRole("button", { name: "Enterprise Treasury" }).click();

  await issueCredentialAndBuildPayload(page);
  await expect(page.getByRole("button", { name: "Submit Payment" })).toBeEnabled();
});

test("builds an enterprise audit payload", async ({ page, request }) => {
  await connectAndDeriveIdentity(page, request);
  await page.getByRole("button", { name: "Enterprise Treasury" }).click();
  await page.getByRole("button", { name: "Audit", exact: true }).click();

  await issueCredentialAndBuildPayload(page);
  await expect(page.getByRole("button", { name: "Export Audit Record" })).toBeEnabled();
});

test("builds a default-mode social payload without credentials", async ({ page, request }) => {
  await connectAndDeriveIdentity(page, request);
  await page.getByRole("button", { name: "Social Governance" }).click();

  await page.getByRole("button", { name: "Build Access Payload" }).click();
  await expect(page.getByText("Access payload ready.")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("button", { name: "Submit Vote" })).toBeEnabled();
});

test("shows social denial after applying a deterministic risk signal", async ({ page, request }) => {
  await connectAndDeriveIdentity(page, request);
  await page.getByRole("button", { name: "Social Governance" }).click();
  await page.getByRole("button", { name: "Apply Risk Flag" }).click();
  await expect(page.getByText("Signal applied: negative_risk_flag")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Build Access Payload" }).click();
  await expect(page.getByText("Access payload ready.")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Policy preflight: Denied by active consequence:/)).toBeVisible({ timeout: 120_000 });
});

test("social new wallet stays denied until recovery path completes", async ({ page, request }) => {
  await connectAndDeriveIdentity(page, request);
  await page.getByRole("button", { name: "Social Governance" }).click();
  await page.getByRole("button", { name: "Observe New Wallet" }).click();
  await expect(page.getByText("Signal applied: new_wallet_observation")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Build Access Payload" }).click();
  await expect(page.getByText("Access payload ready.")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Policy preflight: Denied by (active consequence|state):/)).toBeVisible({ timeout: 120_000 });

  await page.getByRole("button", { name: "Build Access Payload" }).click();
  await expect(page.getByText("Access payload ready.")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Policy preflight: Denied by (active consequence|state):/)).toBeVisible({ timeout: 120_000 });
});

test("social recovers after good standing and can re-enter", async ({ page, request }) => {
  await connectAndDeriveIdentity(page, request);
  await page.getByRole("button", { name: "Social Governance" }).click();
  await page.getByRole("button", { name: "Apply Risk Flag" }).click();
  await expect(page.getByText("Signal applied: negative_risk_flag")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Build Access Payload" }).click();
  await expect(page.getByText(/Policy preflight: Denied by active consequence:/)).toBeVisible({ timeout: 120_000 });

  await page.getByRole("button", { name: "Recover to Normal" }).click();
  await expect(page.getByText("Signal applied: good_standing")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/"resolvedAt":/)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Build Access Payload" }).click();
  await expect(page.getByText("Policy preflight: Allowed: policy preflight passed.")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Verifier preflight: Allowed by on-chain verifier:/)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("Current State")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^NORMAL$/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Submit Vote" })).toBeEnabled();
});
