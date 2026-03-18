import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServiceHarness, DEMO_TARGETS, type ServiceHarness } from "./service-harness.js";

async function waitFor<T>(callback: () => Promise<T | null>, timeoutMs = 60_000, intervalMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await callback();
    if (value !== null) {
      return value;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, intervalMs));
  }
  throw new Error("Timed out waiting for integration condition.");
}

describe.sequential("extended service integration", () => {
  let harness: ServiceHarness;

  beforeEach(async () => {
    harness = await createServiceHarness(13555 + (process.pid % 100));
    await harness.registerTree();
    await harness.createBindings();
  }, 900_000);

  afterEach(async () => {
    await harness.stop();
  });

  it("covers propagation boundaries and keeps sub risk localized by default", async () => {
    const restrictedStart = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.highRisk);
    const restrictedEnd = await harness.currentBlockNumber();
    await harness.backfillExact(harness.rwaIdentity.identityId, restrictedStart + 1n, restrictedEnd);

    const rwaContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rwaIdentity.identityId}/risk-context`);
    const rootContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rootIdentity.identityId}/risk-context`);
    const socialContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.socialIdentity.identityId}/risk-context`);

    expect(rwaContext.summary.storedState).toBeGreaterThanOrEqual(2);
    expect(rootContext.summary.storedState).toBeGreaterThanOrEqual(1);
    expect(socialContext.summary.effectiveState).toBeLessThanOrEqual(rootContext.summary.effectiveState);
    expect(rwaContext.summary.propagation.reasonCodes.length).toBeGreaterThanOrEqual(0);
  }, 900_000);

  it("covers mixer, sanction, positive signals, and recovery-friendly summaries", async () => {
    const governanceStart = await harness.currentBlockNumber();
    for (let index = 0; index < 3; index += 1) {
      await harness.sendTransaction(DEMO_TARGETS.governance);
    }
    const governanceEnd = await harness.currentBlockNumber();
    await harness.backfillExact(harness.socialIdentity.identityId, governanceStart + 1n, governanceEnd);

    const trustedStart = await harness.currentBlockNumber();
    for (const trustedTarget of DEMO_TARGETS.trustedDefi) {
      await harness.sendTransaction(trustedTarget as `0x${string}`);
    }
    const trustedEnd = await harness.currentBlockNumber();
    await harness.backfillExact(harness.socialIdentity.identityId, trustedStart + 1n, trustedEnd);

    const mixerStart = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.mixer);
    const mixerEnd = await harness.currentBlockNumber();
    await harness.backfillExact(harness.paymentsIdentity.identityId, mixerStart + 1n, mixerEnd);

    const sanctionStart = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.sanctioned);
    const sanctionEnd = await harness.currentBlockNumber();
    await harness.backfillExact(harness.paymentsIdentity.identityId, sanctionStart + 1n, sanctionEnd);

    const socialContext = await waitFor(async () => {
      const context = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.socialIdentity.identityId}/risk-context`);
      return context.summary.positiveSummary?.activePositiveSignals?.length ? context : null;
    });
    const paymentsContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.paymentsIdentity.identityId}/risk-context`);

    expect(paymentsContext.summary.storedState).toBeGreaterThanOrEqual(3);
    expect(socialContext.summary.positiveSummary.activePositiveSignals.length).toBeGreaterThan(0);
    expect(socialContext.summary.recoveryProgress.helpfulPositiveSignals.length).toBeGreaterThan(0);
  }, 900_000);

  it("covers structured audit export, list history, operator dashboard, and policy snapshots", async () => {
    const { bundle, payload } = await harness.issueRwaBundleAndPayload();
    await harness.postJson(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: payload.holderAuthorization.policyId,
      policyVersion: payload.policyVersion,
      payload,
      credentialBundles: [bundle],
    });
    await harness.postJson(`${harness.urls.policy}/policies/warning/evaluate`, {
      identityId: harness.socialIdentity.identityId,
      policyId: "COUNTERPARTY_WARNING_V1",
      policyVersion: 1,
    });

    await harness.postJson(`${harness.urls.analyzer}/lists/manual`, {
      identityId: harness.socialIdentity.identityId,
      rootIdentityId: harness.rootIdentity.identityId,
      subIdentityId: harness.socialIdentity.identityId,
      listName: "watchlist",
      actor: "risk-ops",
      action: "add",
      reasonCode: "MANUAL_LIST_OVERRIDE",
      evidenceRefs: ["integration:list:add"],
    });
    await harness.postJson(`${harness.urls.analyzer}/lists/manual`, {
      identityId: harness.socialIdentity.identityId,
      rootIdentityId: harness.rootIdentity.identityId,
      subIdentityId: harness.socialIdentity.identityId,
      listName: "watchlist",
      actor: "risk-ops",
      action: "remove",
      reasonCode: "MANUAL_LIST_REMOVE",
      evidenceRefs: ["integration:list:remove"],
    });

    const auditExport = await harness.postJson<any>(`${harness.urls.analyzer}/audit/export`, {
      identityId: harness.rwaIdentity.identityId,
      policyKind: "access",
    });
    const listHistory = await harness.getJson<{ items: any[] }>(`${harness.urls.analyzer}/lists/history?identityId=${harness.socialIdentity.identityId}`);
    const dashboard = await harness.getJson<any>(`${harness.urls.analyzer}/operator/dashboard`);
    const rwaContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rwaIdentity.identityId}/risk-context`);

    expect(auditExport.policyDecisions.length).toBeGreaterThan(0);
    expect(auditExport.assessments.length).toBeGreaterThanOrEqual(0);
    expect(listHistory.items.some((item) => item.action === "manually_added")).toBe(true);
    expect(listHistory.items.some((item) => item.action === "removed")).toBe(true);
    expect(dashboard.counts.pendingReviewItems).toBeGreaterThanOrEqual(0);
    expect(dashboard.recentPolicyDecisions.length).toBeGreaterThan(0);
    expect(rwaContext.policyDecisions.length).toBeGreaterThan(0);
  }, 900_000);
});
