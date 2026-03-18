import { afterEach, describe, expect, it, vi } from "vitest";
import { CREDENTIAL_TYPES, POLICY_IDS } from "../../../packages/policy/src/index.js";
import { IdentityState } from "../../../packages/state/src/index.js";
import { evaluateAccessDecision, evaluateWarningDecision, getIdentityState } from "./service.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const identityId = "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;

function okJson(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  };
}

function makeRiskPayload(overrides: { summary?: Record<string, unknown>; riskRecord?: Record<string, unknown> } & Record<string, unknown> = {}) {
  const summaryOverrides = overrides.summary ?? {};
  return {
    identityId,
    summary: {
      identityId,
      rootIdentityId: identityId,
      storedState: IdentityState.NORMAL,
      effectiveState: IdentityState.NORMAL,
      riskScore: 0,
      reputationScore: 10,
      confidenceScore: 10,
      finalInternalScore: 0,
      reasonCodes: [],
      warnings: [],
      evidenceRefs: [],
      watchlist: [],
      restrictedList: [],
      blacklistOrFrozenList: [],
      ...summaryOverrides,
    },
    signals: [],
    reviewQueue: [],
    riskRecord: { storedState: IdentityState.NORMAL, effectiveState: IdentityState.NORMAL },
    ...overrides,
  };
}

function makePayload(policyId = POLICY_IDS.ENTITY_PAYMENT_V1, credentialType = CREDENTIAL_TYPES.ENTITY) {
  return {
    identityId,
    credentialAttestations: [
      {
        credentialType,
        credentialHash: "0x1000000000000000000000000000000000000000000000000000000000000001",
        revocationId: "0x2000000000000000000000000000000000000000000000000000000000000002",
        subjectBinding: "0x3000000000000000000000000000000000000000000000000000000000000003",
        issuer: "0x00000000000000000000000000000000000000f1",
        expiration: Math.floor(Date.now() / 1000) + 3_600,
        claimsHash: "0x4000000000000000000000000000000000000000000000000000000000000004",
        policyHintsHash: "0x5000000000000000000000000000000000000000000000000000000000000005",
        policyHints: [policyId],
        signature: "0x1234",
      },
    ],
    zkProof: {
      proofPoints: [1, 2, 3, 4, 5, 6, 7, 8],
      publicSignals: [BigInt("0x3000000000000000000000000000000000000000000000000000000000000003")],
    },
    policyVersion: 1,
    holderAuthorization: {
      identityId,
      subjectBinding: "0x3000000000000000000000000000000000000000000000000000000000000003",
      policyId,
      requestHash: "0x6000000000000000000000000000000000000000000000000000000000000006",
      chainId: 31337,
      nonce: 1,
      deadline: Math.floor(Date.now() / 1000) + 3_600,
      signature: "0x5678",
    },
  } as any;
}

function makeBundle(payload = makePayload()) {
  return {
    credential: {
      credentialId: "cred-1",
      issuerDid: "did:example:issuer",
      issuerAddress: payload.credentialAttestations[0].issuer,
      holder: "did:pkh:eip155:31337:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      holderIdentityId: identityId,
      credentialType: payload.credentialAttestations[0].credentialType,
      credentialTypeLabel: "EntityCredential",
      claimSet: { entityName: "Acme Treasury" },
      policyHints: payload.credentialAttestations[0].policyHints,
      issuedAt: new Date().toISOString(),
      expiry: payload.credentialAttestations[0].expiration,
      revocationId: payload.credentialAttestations[0].revocationId,
      subjectBinding: payload.credentialAttestations[0].subjectBinding,
      evidenceRef: "issuer:demo",
    },
    attestation: payload.credentialAttestations[0],
  };
}

describe("policy api service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies access when credential bundles are missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/risk-context")) {
        return okJson(makeRiskPayload());
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }));

    const decision = await evaluateAccessDecision({
      identityId,
      policyId: POLICY_IDS.RWA_BUY_V2,
      policyVersion: 1,
    });

    expect(decision.decision).toBe("deny");
    expect(decision.credentialReasons.some((reason: { code: string }) => reason.code === "MISSING_CREDENTIAL_BUNDLES")).toBe(true);
    expect(decision.credentialReasons.some((reason: { code: string }) => reason.code === "MISSING_PAYLOAD")).toBe(true);
  });

  it("denies access when issuer verification fails or bundle does not match payload", async () => {
    const payload = makePayload();
    const mismatchedBundle = makeBundle({
      ...payload,
      credentialAttestations: [
        {
          ...payload.credentialAttestations[0],
          credentialHash: "0x7000000000000000000000000000000000000000000000000000000000000007",
        },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/risk-context")) {
        return okJson(makeRiskPayload());
      }
      if (url.includes("/credentials/verify")) {
        return okJson({ valid: false, trustedIssuer: false, signer: "0x0000000000000000000000000000000000000002" });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }));

    const decision = await evaluateAccessDecision({
      identityId,
      policyId: POLICY_IDS.ENTITY_PAYMENT_V1,
      policyVersion: 1,
      payload,
      credentialBundles: [mismatchedBundle as any],
      verifierAddress: ZERO_ADDRESS,
    });

    expect(decision.decision).toBe("deny");
    expect(decision.credentialReasons.some((reason: { code: string }) => reason.code === "BUNDLE_ATTESTATION_MISMATCH")).toBe(true);
    expect(decision.credentialReasons.some((reason: { code: string }) => reason.code === "ISSUER_BUNDLE_INVALID")).toBe(true);
    expect(decision.credentialReasons.some((reason: { code: string }) => reason.code === "UNTRUSTED_ISSUER")).toBe(true);
  });

  it("denies access when policy version mismatches even if risk is normal", async () => {
    const payload = makePayload(POLICY_IDS.ENTITY_PAYMENT_V1, CREDENTIAL_TYPES.ENTITY);
    const bundle = makeBundle(payload);

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/risk-context")) {
        return okJson(makeRiskPayload());
      }
      if (url.includes("/credentials/verify")) {
        return okJson({ valid: true, trustedIssuer: true, signer: "0x00000000000000000000000000000000000000f1" });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }));

    const decision = await evaluateAccessDecision({
      identityId,
      policyId: POLICY_IDS.ENTITY_PAYMENT_V1,
      policyVersion: 99,
      payload,
      credentialBundles: [bundle as any],
      verifierAddress: ZERO_ADDRESS,
    });

    expect(decision.decision).toBe("deny");
    expect(decision.policyReasons.some((reason: { code: string }) => reason.code === "POLICY_VERSION_MISMATCH")).toBe(true);
  });

  it("returns high warning for risky counterparties and exposes stored/effective state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/risk-context")) {
        return okJson(makeRiskPayload({
          summary: {
            storedState: IdentityState.HIGH_RISK,
            effectiveState: IdentityState.HIGH_RISK,
            riskScore: 80,
            reputationScore: 0,
            confidenceScore: 20,
            finalInternalScore: 82,
            reasonCodes: ["MIXER_INTERACTION"],
            warnings: ["Mixer interaction detected"],
            evidenceRefs: ["tx:0x123"],
          },
          riskRecord: { storedState: IdentityState.HIGH_RISK, effectiveState: IdentityState.HIGH_RISK },
        }));
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }));

    const state = await getIdentityState(identityId);
    expect(state.effectiveState).toBe(IdentityState.HIGH_RISK);

    const warning = await evaluateWarningDecision({
      identityId,
      policyId: "COUNTERPARTY_WARNING_V1",
      policyVersion: 1,
    });
    expect(warning.decision).toBe("high_warn");
    expect(warning.counterpartySummary.reasonCodes).toContain("MIXER_INTERACTION");
  });
});
