import { describe, expect, it } from "vitest";
import { POLICY_DEFINITIONS, POLICY_IDS, computePolicyId, createProofRequest, getPolicyDefinition } from "./index.js";

describe("policy helpers", () => {
  it("produces deterministic bytes32 policy ids", () => {
    expect(computePolicyId("RWA_BUY_V2")).toBe(POLICY_IDS.RWA_BUY_V2);
    expect(POLICY_IDS.RWA_BUY_V2).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("creates proof requests with bytes32 policy ids", () => {
    const request = createProofRequest({
      verifier: "0x0000000000000000000000000000000000000001",
      requestedClaims: ["kycLevel"],
      policyId: POLICY_IDS.ENTITY_PAYMENT_V1,
      policyVersion: 1,
      nonce: "0x0000000000000000000000000000000000000000000000000000000000000002",
      challenge: "0x0000000000000000000000000000000000000000000000000000000000000003",
    });

    expect(request.policyId).toBe(POLICY_IDS.ENTITY_PAYMENT_V1);
  });

  it("tags policies by allowed modes and orchestration actions", () => {
    expect(POLICY_DEFINITIONS.RWA_BUY_V2.requiresComplianceMode).toBe(true);
    expect(POLICY_DEFINITIONS.GOV_VOTE_V1.allowedModes).toEqual(["DEFAULT_BEHAVIOR_MODE"]);
    expect(POLICY_DEFINITIONS.GOV_VOTE_V1.onRiskAction).toBe("observe");
    expect(getPolicyDefinition(POLICY_IDS.GOV_VOTE_V1).targetAction).toBe("governance_vote");
  });

  it("reads reserved privacy fields without changing existing policy definitions", () => {
    const policy = getPolicyDefinition({
      ...POLICY_DEFINITIONS.ENTITY_AUDIT_V1,
      acceptedPrivacyModes: ["credential_bound", "issuer_hidden_reserved"],
      issuerDisclosureRequirement: "hash_only",
    });

    expect(policy.acceptedPrivacyModes).toEqual(["credential_bound", "issuer_hidden_reserved"]);
    expect(policy.issuerDisclosureRequirement).toBe("hash_only");
    expect(policy.proofTemplate).toBe("credential_bound_proof");
  });
});
