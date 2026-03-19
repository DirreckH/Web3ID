import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IdentityState } from "../../packages/state/src/index.js";
import { DEMO_TARGETS, type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness, waitFor } from "./helpers.js";

describe.sequential("system core acceptance", () => {
  let harness: ServiceHarness;

  beforeAll(async () => {
    harness = await createSystemHarness(14055);
  }, 900_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("keeps the root/sub model and explanation chain aligned", async () => {
    const start = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.highRisk);
    const end = await harness.currentBlockNumber();
    await harness.backfillExact(harness.rwaIdentity.identityId, start + 1n, end);

    const rwaContext = await waitFor(async () => {
      const context = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rwaIdentity.identityId}/risk-context`);
      return context.summary?.reasonCodes?.length ? context : null;
    });
    const rootContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rootIdentity.identityId}/risk-context`);

    expect(rwaContext.rootIdentity.identityId).toBe(harness.rootIdentity.identityId);
    expect(rwaContext.subIdentity.identityId).toBe(harness.rwaIdentity.identityId);
    expect(rootContext.subtree.some((item: any) => item.identityId === harness.rwaIdentity.identityId)).toBe(true);
    expect(rwaContext.summary.explanation.reasonCode).toBeTruthy();
    expect(rwaContext.summary.propagation.explanation.explanationSummary).toBeTruthy();
    expect(rootContext.summary.explanation.explanationSummary).toContain("Stored state");
  }, 900_000);

  it("exports a complete signal -> state -> consequence -> policy audit chain", async () => {
    const { bundle, payload } = await harness.issueRwaBundleAndPayload();
    const accessDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: payload.holderAuthorization.policyId,
      policyVersion: payload.policyVersion,
      payload,
      credentialBundles: [bundle],
    });
    const auditBundle = await harness.postJson<any>(`${harness.urls.analyzer}/audit/export`, {
      identityId: harness.rwaIdentity.identityId,
    });

    expect(["allow", "restrict", "deny"]).toContain(accessDecision.decision);
    expect(accessDecision.explanation.explanationSummary).toBeTruthy();
    expect(auditBundle.assessments.length).toBeGreaterThan(0);
    expect(auditBundle.decisions.length).toBeGreaterThan(0);
    expect(auditBundle.consequences.length).toBeGreaterThan(0);
    expect(auditBundle.policyDecisions.length).toBeGreaterThan(0);
    expect(auditBundle.explanationChain.length).toBeGreaterThanOrEqual(auditBundle.decisions.length);
    expect(auditBundle.consistency.complete).toBe(true);
    expect(auditBundle.policyDecisions.every((item: any) => item.explanation.sourcePolicyVersion === payload.policyVersion)).toBe(true);
  }, 900_000);
});
