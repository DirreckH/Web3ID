import { describe, expect, it } from "vitest";
import { deriveRootIdentity, deriveSubIdentity, IdentityMode, SubIdentityType } from "@web3id/identity";
import { IdentityState } from "@web3id/state";
import {
  buildEnterpriseAuditRequestHash,
  buildEnterprisePaymentRequestHash,
  evaluatePolicyPreflight,
  buildGovernanceVoteRequestHash,
  buildHolderAuthorizationPayload,
  buildRwaRequestHash,
  policyIds,
  resolveEffectiveMode,
  supportsPolicy,
} from "./index.js";

describe("sdk helpers", () => {
  it("builds deterministic request hashes", () => {
    expect(buildRwaRequestHash("0x0000000000000000000000000000000000000001", 1n)).toBe(
      buildRwaRequestHash("0x0000000000000000000000000000000000000001", 1n),
    );
    expect(
      buildEnterprisePaymentRequestHash(
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        5n,
        "0x0000000000000000000000000000000000000000000000000000000000000003",
      ),
    ).toMatch(/^0x[0-9a-f]{64}$/);
    expect(
      buildEnterpriseAuditRequestHash(
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000000000000000000000000000004",
      ),
    ).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("builds holder authorization payload objects", () => {
    const payload = buildHolderAuthorizationPayload(
      {
        identityId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        subjectBinding: "0x0000000000000000000000000000000000000000000000000000000000000002",
        policyId: "0x0000000000000000000000000000000000000000000000000000000000000003",
        requestHash: "0x0000000000000000000000000000000000000000000000000000000000000004",
        chainId: 31337,
        nonce: 1n,
        deadline: 2n,
      },
      "0x1234",
    );

    expect(payload.nonce).toBe(1n);
    expect(payload.policyId).toBe("0x0000000000000000000000000000000000000000000000000000000000000003");
  });

  it("resolves effective mode against policy requirements", () => {
    const root = deriveRootIdentity("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const social = deriveSubIdentity({ rootIdentity: root, scope: "social", type: SubIdentityType.SOCIAL });
    const rwa = deriveSubIdentity({ rootIdentity: root, scope: "rwa-invest", type: SubIdentityType.RWA_INVEST });

    expect(resolveEffectiveMode(social, policyIds.GOV_VOTE_V1)).toBe("DEFAULT_BEHAVIOR_MODE");
    expect(supportsPolicy(rwa, policyIds.RWA_BUY_V2).supported).toBe(false);
  });

  it("builds deterministic social request hashes", () => {
    expect(
      buildGovernanceVoteRequestHash(
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000000000000000000000000000005",
      ),
    ).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("denies compliance-only policy preflight without credential payload", () => {
    const preflight = evaluatePolicyPreflight({
      identityContext: {
        currentState: IdentityState.NORMAL,
        activeConsequences: [],
      },
      policyId: policyIds.RWA_BUY_V2,
      effectiveMode: IdentityMode.COMPLIANCE_MODE,
      payload: {
        credentialAttestations: [],
      },
    });

    expect(preflight.allowed).toBe(false);
    expect(preflight.source).toBe("mode");
  });

  it("denies default-mode social access when a blocking consequence is active", () => {
    const preflight = evaluatePolicyPreflight({
      identityContext: {
        currentState: IdentityState.NORMAL,
        activeConsequences: [
          {
            consequenceId: "limit-1",
            identityId: "0x0000000000000000000000000000000000000000000000000000000000000001",
            targetLevel: "sub",
            consequenceType: "limit",
            severity: "high",
            reasonCode: "NEGATIVE_RISK_FLAG",
            sourceDecisionId: "decision-1",
            effectiveFrom: new Date(1_000).toISOString(),
            recoverable: true,
            createdAt: new Date(1_000).toISOString(),
          },
        ],
      },
      policyId: policyIds.GOV_VOTE_V1,
      effectiveMode: IdentityMode.DEFAULT_BEHAVIOR_MODE,
      payload: {
        credentialAttestations: [],
      },
    });

    expect(preflight.allowed).toBe(false);
    expect(preflight.source).toBe("consequence");
    expect(preflight.blockingConsequences).toHaveLength(1);
  });
});
