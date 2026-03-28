import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { policyIds, type AccessPayload } from "../../packages/sdk/src/index.js";
import { type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";

describe.sequential("phase4 privacy acceptance", () => {
  let harness: ServiceHarness | undefined;

  beforeAll(async () => {
    harness = await createSystemHarness(14855);
  }, 900_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("keeps public mode backward compatible and enforces disclosure profiles for compliance policies", async () => {
    const { bundle, payload } = await harness.issueRwaBundleAndPayload();
    const selectivePayload: AccessPayload = {
      ...payload,
      proofDescriptor: {
        proofId: "phase4-selective",
        proofType: "credential_bound_proof",
        privacyMode: "credential_bound",
        subjectBindingType: "sub",
        issuerDisclosure: "full",
        supportsSelectiveDisclosure: true,
        supportsIssuerAnonymity: false,
        supportsMultiIssuerAggregation: false,
        createdAt: new Date().toISOString(),
        disclosureProfile: "selective_disclosure",
        generationRoute: "descriptor_selective",
        verificationRule: "descriptor_verify",
        disclosedClaims: [String(bundle.attestation.credentialType)],
        minimumDisclosureSet: [],
        auditVisibleFacts: [],
        versionEnvelope: {
          schemaVersion: "phase4/v1",
          systemModelVersion: "system-model/v2",
          explanationSchemaVersion: "explanation/v2",
          policyVersion: 1,
        },
      },
    };

    const selectiveDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: policyIds.RWA_BUY_V2,
      policyVersion: 1,
      payload: selectivePayload,
      credentialBundles: [bundle],
    });

    expect(selectiveDecision.decision).not.toBe("deny");
    expect(selectiveDecision.proofDescriptor.disclosureProfile).toBe("selective_disclosure");
    expect(selectiveDecision.disclosureRequirement.allowedDisclosureProfiles).toContain("selective_disclosure");

    const minimalDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: policyIds.RWA_BUY_V2,
      policyVersion: 1,
      payload: {
        ...selectivePayload,
        proofDescriptor: {
          ...selectivePayload.proofDescriptor,
          proofId: "phase4-minimal",
          disclosureProfile: "policy_minimal_disclosure",
          generationRoute: "descriptor_minimal",
        },
      },
      credentialBundles: [bundle],
    });

    expect(minimalDecision.decision).toBe("deny");
    expect(minimalDecision.policyReasons.some((item: any) => item.code === "DISCLOSURE_PROFILE_REJECTED")).toBe(true);

    const fallbackDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: policyIds.RWA_BUY_V2,
      policyVersion: 1,
      payload,
      credentialBundles: [bundle],
    });

    expect(fallbackDecision.proofDescriptor.disclosureProfile).toBe("public");
    expect(fallbackDecision.disclosureRequirement.policyVersion).toBe(1);
  }, 900_000);
});
