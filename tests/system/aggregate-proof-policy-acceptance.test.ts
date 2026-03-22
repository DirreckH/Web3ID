import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";
import { createSubjectAggregateRecord, linkRootToAggregate, primaryAggregateAccount, secondaryAggregateAccount } from "./aggregate-helpers.js";

describe.sequential("aggregate proof policy acceptance", () => {
  let harness: ServiceHarness;

  beforeAll(async () => {
    harness = await createSystemHarness(14755);
  }, 900_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("keeps proof verification backward compatible while exposing aggregate-aware policy context", async () => {
    const aggregate = await createSubjectAggregateRecord(harness, {
      actor: "risk-ops",
      evidenceRefs: ["system:aggregate:policy"],
    });
    await linkRootToAggregate(harness, {
      account: primaryAggregateAccount,
      rootIdentityId: harness.rootIdentity.identityId,
      subjectAggregateId: aggregate.subjectAggregateId,
    });
    await linkRootToAggregate(harness, {
      account: secondaryAggregateAccount,
      subjectAggregateId: aggregate.subjectAggregateId,
    });

    const { bundle, payload } = await harness.issueRwaBundleAndPayload();
    const accessDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: payload.holderAuthorization.policyId,
      policyVersion: payload.policyVersion,
      payload,
      credentialBundles: [bundle],
    });
    const warningDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/warning/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: "COUNTERPARTY_WARNING_V1",
      policyVersion: payload.policyVersion,
    });

    expect(["allow", "restrict", "deny"]).toContain(accessDecision.decision);
    expect(accessDecision.proofDescriptor.proofType).toBeTruthy();
    expect(accessDecision.subjectAggregateContext.subjectAggregateId).toBe(aggregate.subjectAggregateId);
    expect(accessDecision.subjectAggregateContext.linkedRootCount).toBe(2);
    expect(accessDecision.subjectAggregateContext.hasTrustedControllerLink).toBe(true);

    expect(warningDecision.subjectAggregateContext.subjectAggregateId).toBe(aggregate.subjectAggregateId);
    expect(warningDecision.subjectAggregateContext.linkedRootCount).toBe(2);
  }, 900_000);
});
