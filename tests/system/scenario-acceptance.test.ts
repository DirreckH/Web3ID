import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POLICY_IDS } from "../../packages/policy/src/index.js";
import { type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";

describe.sequential("system scenario acceptance", () => {
  let harness: ServiceHarness;

  beforeAll(async () => {
    harness = await createSystemHarness(14255);
  }, 900_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("keeps RWA on the compliance path and requires credential evidence", async () => {
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

    expect(denyWithoutBundles.decision).toBe("deny");
    expect(allowWithBundles.decision).toBe("allow");
    expect(allowWithBundles.explanation.sourcePolicyVersion).toBe(payload.policyVersion);
    expect(allowWithBundles.snapshotPersisted).toBe(true);
  }, 900_000);

  it("keeps the social path VC-optional and explanation-first", async () => {
    const warningDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/warning/evaluate`, {
      identityId: harness.socialIdentity.identityId,
      policyId: "COUNTERPARTY_WARNING_V1",
      policyVersion: 1,
    });

    expect(["info", "warn", "high_warn"]).toContain(warningDecision.decision);
    expect(warningDecision.credentialReasons).toEqual([]);
    expect(warningDecision.explanation.explanationSummary).toBeTruthy();
    expect(warningDecision.counterpartySummary.subIdentityId).toBe(harness.socialIdentity.identityId);
  }, 900_000);

  it("surfaces enterprise and audit activity through operator and export views", async () => {
    const operatorDashboard = await harness.getJson<any>(`${harness.urls.analyzer}/operator/dashboard`);
    const rootAudit = await harness.postJson<any>(`${harness.urls.analyzer}/audit/export`, {
      rootIdentityId: harness.rootIdentity.identityId,
    });

    expect(operatorDashboard.counts.pendingAiReviews).toBeGreaterThanOrEqual(0);
    expect(operatorDashboard.recentPolicyDecisions.length + operatorDashboard.recentWarningPolicies.length).toBeGreaterThan(0);
    expect(rootAudit.policyDecisions.some((item: any) => item.policyId === POLICY_IDS.RWA_BUY_V2 || item.policyId === "COUNTERPARTY_WARNING_V1")).toBe(true);
    expect(rootAudit.auditRecords.length).toBeGreaterThan(0);
  }, 900_000);
});
