import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IdentityState } from "../../packages/state/src/index.js";
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

describe.sequential("basic service integration", () => {
  let harness: ServiceHarness;

  beforeAll(async () => {
    harness = await createServiceHarness(13055 + (process.pid % 100));
    await harness.registerTree();
    await harness.createBindings();
  }, 900_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("covers social default path and compliance access policy decisions", async () => {
    const { bundle, payload } = await harness.issueRwaBundleAndPayload();
    const denyWithoutBundles = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: payload.holderAuthorization.policyId,
      policyVersion: payload.policyVersion,
      payload,
    });
    const allowWithBundles = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: payload.holderAuthorization.policyId,
      policyVersion: payload.policyVersion,
      payload,
      credentialBundles: [bundle],
    });
    const socialWarning = await harness.postJson<any>(`${harness.urls.policy}/policies/warning/evaluate`, {
      identityId: harness.socialIdentity.identityId,
      policyId: "COUNTERPARTY_WARNING_V1",
      policyVersion: 1,
    });

    expect(denyWithoutBundles.decision).toBe("deny");
    expect(allowWithBundles.decision).toBe("allow");
    expect(["info", "warn", "high_warn"]).toContain(socialWarning.decision);
  }, 900_000);

  it("covers watch start refresh stop on the social path", async () => {
    const beforeEvents = await harness.getJson<{ items: any[] }>(`${harness.urls.analyzer}/identities/${harness.socialIdentity.identityId}/events`);
    await harness.postJson(`${harness.urls.analyzer}/scan/watch`, {
      action: "start",
      identityId: harness.socialIdentity.identityId,
      recentBlocks: 4,
      pollIntervalMs: 2_000,
    });
    await harness.sendTransaction(DEMO_TARGETS.governance);

    const eventsAfter = await waitFor(async () => {
      const events = await harness.getJson<{ items: any[] }>(`${harness.urls.analyzer}/identities/${harness.socialIdentity.identityId}/events`);
      return events.items.length > beforeEvents.items.length ? events : null;
    });

    const refreshResult = await harness.postJson<any>(`${harness.urls.analyzer}/scan/watch`, {
      action: "refresh",
      identityId: harness.socialIdentity.identityId,
      recentBlocks: 8,
    });
    const stopResult = await harness.postJson<any>(`${harness.urls.analyzer}/scan/watch`, {
      action: "stop",
      identityId: harness.socialIdentity.identityId,
    });

    expect(eventsAfter.items.length).toBeGreaterThan(beforeEvents.items.length);
    expect(refreshResult.inserted).toBeGreaterThanOrEqual(0);
    expect(stopResult.watcher.status).toBe("STOPPED");
  }, 900_000);

  it("covers backfill, AI review lifecycle, stored/effective state, and manual release floor", async () => {
    const restrictedStart = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.highRisk);
    const restrictedEnd = await harness.currentBlockNumber();
    await harness.backfillExact(harness.paymentsIdentity.identityId, restrictedStart + 1n, restrictedEnd);

    const pendingReview = await waitFor(async () => {
      const queue = await harness.getJson<{ items: any[] }>(`${harness.urls.analyzer}/review-queue?identityId=${harness.paymentsIdentity.identityId}`);
      return queue.items.find((item) => item.status === "PENDING_REVIEW") ?? null;
    });

    const confirmed = await harness.postJson<any>(`${harness.urls.analyzer}/review-queue/${pendingReview.reviewItemId}/confirm`, {
      actor: "risk-ops",
      requestedState: IdentityState.RESTRICTED,
      reasonCode: "AI_CONFIRMED_SIGNAL",
      note: "Basic service integration confirmation",
    });

    const reviewStatus = confirmed.reviewQueue.find((item: any) => item.reviewItemId === pendingReview.reviewItemId)?.status;
    expect(reviewStatus).toBe("CONFIRMED_SIGNAL");
    expect(confirmed.summary.storedState).toBeGreaterThanOrEqual(IdentityState.RESTRICTED);
    expect(confirmed.summary.effectiveState).toBeGreaterThanOrEqual(confirmed.summary.storedState);

    await harness.injectExpiredReview(harness.anonymousIdentity.identityId, harness.rootIdentity.identityId, harness.anonymousIdentity.identityId);
    await harness.postJson(`${harness.urls.analyzer}/identities/${harness.anonymousIdentity.identityId}/recompute`, {});
    const expiredReview = await waitFor(async () => {
      const queue = await harness.getJson<{ items: any[] }>(`${harness.urls.analyzer}/review-queue?identityId=${harness.anonymousIdentity.identityId}`);
      return queue.items.find((item) => item.reviewItemId === "expired-review" && item.status === "EXPIRED") ?? null;
    });
    expect(expiredReview.status).toBe("EXPIRED");

    const frozenStart = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.sanctioned);
    const frozenEnd = await harness.currentBlockNumber();
    await harness.backfillExact(harness.paymentsIdentity.identityId, frozenStart + 1n, frozenEnd);
    const manualRelease = await harness.postJson<any>(`${harness.urls.analyzer}/manual-release`, {
      identityId: harness.paymentsIdentity.identityId,
      actor: "risk-ops",
      reasonCode: "MANUAL_RELEASE_REVIEWED",
      evidenceRefs: ["integration:manual-release"],
      note: "Manual release in basic suite",
    });

    expect(manualRelease.summary.manualReleaseWindow.floorState).not.toBeNull();
    expect(manualRelease.summary.recoveryProgress.releaseFloorActive).toBe(true);
  }, 900_000);
});
