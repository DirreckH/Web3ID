import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IdentityState } from "../../packages/state/src/index.js";
import { DEMO_TARGETS, type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness, waitFor } from "./helpers.js";

describe.sequential("system boundary acceptance", () => {
  let harness: ServiceHarness | undefined;

  beforeAll(async () => {
    harness = await createSystemHarness(14155);
  }, 900_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("keeps AI advisory-only until human review confirms a manual signal", async () => {
    const start = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.highRisk);
    const end = await harness.currentBlockNumber();
    await harness.backfillExact(harness.paymentsIdentity.identityId, start + 1n, end);

    const pendingContext = await waitFor(async () => {
      const context = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.paymentsIdentity.identityId}/risk-context`);
      return context.reviewQueue?.some((item: any) => item.status === "PENDING_REVIEW") ? context : null;
    });
    const pendingReview = pendingContext.reviewQueue.find((item: any) => item.status === "PENDING_REVIEW");

    expect(pendingContext.aiSuggestions.length).toBeGreaterThan(0);
    expect(pendingContext.manualSignals.length).toBe(0);
    expect(pendingReview.explanation.aiContribution).toBe(true);
    expect(pendingReview.explanation.manualOverride).toBe(false);

    const confirmed = await harness.postJson<any>(`${harness.urls.analyzer}/review-queue/${pendingReview.reviewItemId}/confirm`, {
      actor: "risk-ops",
      requestedState: IdentityState.RESTRICTED,
      reasonCode: "AI_CONFIRMED_SIGNAL",
      note: "Boundary acceptance confirmation",
    });

    const confirmedReview = confirmed.reviewQueue.find((item: any) => item.reviewItemId === pendingReview.reviewItemId);
    expect(confirmedReview.status).toBe("CONFIRMED_SIGNAL");
    expect(confirmedReview.explanation.manualOverride).toBe(true);
    expect(confirmed.manualSignals.some((signal: any) => signal.sourceSuggestionId === pendingReview.sourceSuggestionId)).toBe(true);
  }, 900_000);

  it("keeps propagation bounded and audits manual overrides explicitly", async () => {
    const rwaStart = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.mixer);
    const rwaEnd = await harness.currentBlockNumber();
    await harness.backfillExact(harness.rwaIdentity.identityId, rwaStart + 1n, rwaEnd);

    const rootContext = await waitFor(async () => {
      const context = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rootIdentity.identityId}/risk-context`);
      return context.summary?.propagation?.explanation ? context : null;
    });
    const socialContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.socialIdentity.identityId}/risk-context`);

    expect(rootContext.summary.propagation.explanation.explanationSummary).toBeTruthy();
    expect(socialContext.summary.effectiveState).toBeLessThanOrEqual(rootContext.summary.effectiveState);

    const manualRelease = await harness.postJson<any>(`${harness.urls.analyzer}/manual-release`, {
      identityId: harness.paymentsIdentity.identityId,
      actor: "risk-ops",
      reasonCode: "MANUAL_RELEASE_REVIEWED",
      evidenceRefs: ["system:boundary:manual-release"],
      note: "Boundary acceptance manual release",
    });
    const auditBundle = await harness.postJson<any>(`${harness.urls.analyzer}/audit/export`, {
      identityId: harness.paymentsIdentity.identityId,
    });

    expect(manualRelease.summary.explanation.manualOverride).toBe(true);
    expect(auditBundle.auditRecords.some((record: any) => record.action === "MANUAL_RELEASE_APPLIED")).toBe(true);
  }, 900_000);
});
