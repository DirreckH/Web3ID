import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearRecoveryHooksForTests,
  controllerProofEnvelopeSchema,
  createRecoveryIntent,
  deriveRootIdentity,
  deriveSubIdentity,
  getRecoveryPolicySlot,
  IdentityMode,
  registerRecoveryGuardians,
  registerRecoveryPolicySlot,
  SubIdentityType,
} from "@web3id/identity";
import { IdentityState, createExplanationBlock } from "@web3id/state";
import {
  buildCrossChainStateMessage,
  buildControllerChallenge,
  buildStateSnapshot,
  buildEnterpriseAuditRequestHash,
  buildEnterprisePaymentRequestHash,
  evaluatePolicyPreflight,
  buildGovernanceVoteRequestHash,
  buildHolderAuthorizationPayload,
  buildRwaRequestHash,
  getProofCapabilities,
  getProofDescriptor,
  getRecoveryHooksSnapshot,
  listSupportedChainFamilies,
  listSupportedEvmNetworks,
  parseControllerProofEnvelope,
  policyIds,
  resolveEffectiveMode,
  resolveEvmNetworkPreset,
  supportsPolicy,
} from "./index.js";

describe("sdk helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearRecoveryHooksForTests();
  });

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
            explanation: createExplanationBlock({
              reasonCode: "NEGATIVE_RISK_FLAG",
              explanationSummary: "A high-risk consequence is active.",
              evidenceRefs: ["tx:0xlimit"],
              sourceDecisionId: "decision-1",
            }),
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

  it("reuses the shared proof envelope schema and exposes supported mainstream networks", () => {
    const envelope = parseControllerProofEnvelope({
      proofEnvelopeVersion: "1",
      proofType: "aptos_sign_message",
      signature: "0x1234",
      publicKey: "0xabcd",
      fullMessage: "full-message",
      proofPayload: {
        address: "0x01",
        application: "web3id",
        chainId: 1,
        nonce: "nonce-1",
        message: "challenge",
      },
    });

    expect(controllerProofEnvelopeSchema.parse(envelope).proofType).toBe("aptos_sign_message");
    expect(listSupportedChainFamilies()).toContain("tron");
    expect(listSupportedEvmNetworks().map((item) => item.networkRef)).toContain("eip155:8453");
    expect(resolveEvmNetworkPreset(42161)?.label).toBe("Arbitrum One");
  });

  it("builds canonical controller challenges through the SDK entrypoint", () => {
    const challenge = buildControllerChallenge({
      bindingType: "subject_aggregate_link",
      controllerRef: {
        chainFamily: "tron",
        networkId: "mainnet",
        address: "0x41b3fd7ef7d3c0d7e6db4b297927651c01fb9b31c4",
      },
      nonce: "nonce-1",
      issuedAt: "2030-03-22T00:00:00.000Z",
      expiresAt: "2030-03-22T00:10:00.000Z",
      subjectAggregateId: "subject-1",
    });

    expect(challenge.message).toContain("Web3ID Controller Challenge");
    expect(challenge.networkRef).toBe("tron:mainnet");
  });

  it("builds state snapshots from analyzer risk-context while preferring structured state facts", async () => {
    const root = deriveRootIdentity("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const rwa = deriveSubIdentity({ rootIdentity: root, scope: "rwa-invest", type: SubIdentityType.RWA_INVEST });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          rootIdentity: root,
          subIdentity: rwa,
          summary: {
            storedState: IdentityState.FROZEN,
            effectiveState: IdentityState.RESTRICTED,
          },
          stateContext: {
            currentState: IdentityState.NORMAL,
            decisions: [
              {
                decisionId: "decision-1",
                evidenceBundleHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
              },
            ],
            assessments: [],
            consequences: [
              {
                consequenceId: "limit-1",
                identityId: rwa.identityId,
                targetLevel: "sub",
                consequenceType: "limit",
                severity: "high",
                reasonCode: "NEGATIVE_RISK_FLAG",
                sourceDecisionId: "decision-1",
                effectiveFrom: new Date("2026-03-18T00:00:00Z").toISOString(),
                recoverable: true,
                createdAt: new Date("2026-03-18T00:00:00Z").toISOString(),
              },
            ],
          },
          policyDecisions: [
            {
              policyLabel: "RWA_BUY_V2",
              policyVersion: 1,
              createdAt: new Date("2026-03-19T00:00:00Z").toISOString(),
            },
          ],
        }),
      })) as any,
    );

    const snapshot = await buildStateSnapshot("http://127.0.0.1:4200", rwa.identityId, {
      generatedAt: new Date("2026-03-20T00:00:00Z").toISOString(),
    });
    const message = await buildCrossChainStateMessage("http://127.0.0.1:4200", rwa.identityId, 10, {
      generatedAt: new Date("2026-03-20T00:00:00Z").toISOString(),
      createdAt: new Date("2026-03-20T00:00:00Z").toISOString(),
      commitmentCreatedAt: new Date("2026-03-20T00:00:00Z").toISOString(),
    });

    expect(snapshot.storedState).toBe("NORMAL");
    expect(snapshot.effectiveState).toBe("RESTRICTED");
    expect(snapshot.policyContextVersion).toBe("RWA_BUY_V2@1");
    expect(message.targetChainId).toBe(10);
    expect(message.snapshotRef).toBe(snapshot.snapshotId);
  });

  it("exposes proof descriptors and local recovery hook snapshots without mutating main flows", () => {
    const root = deriveRootIdentity("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    registerRecoveryPolicySlot({
      policySlotId: "slot-1",
      rootIdentityId: root.identityId,
      enabled: true,
      minGuardianApprovals: 2,
      cooldownSeconds: 3600,
      scope: "root_only",
      allowedRecoveryActions: ["unlock"],
      createdAt: new Date("2026-03-18T00:00:00Z").toISOString(),
      updatedAt: new Date("2026-03-18T00:00:00Z").toISOString(),
    });
    registerRecoveryGuardians(root.identityId, [
      {
        guardianId: "guardian-1",
        guardianType: "address",
        guardianRef: "0x00000000000000000000000000000000000000a1",
        role: "primary",
        weight: 1,
        addedAt: new Date("2026-03-18T00:00:00Z").toISOString(),
        status: "active",
      },
    ]);
    createRecoveryIntent(
      {
        intentId: "intent-1",
        rootIdentityId: root.identityId,
        action: "unlock",
        initiatedBy: "guardian-1",
        createdAt: new Date("2026-03-18T01:00:00Z").toISOString(),
      },
      { governanceEmergencyFreeze: true },
    );

    const recoverySnapshot = getRecoveryHooksSnapshot({
      ...root,
      guardianSetRef: "guardians:root",
      recoveryPolicySlotId: "slot-1",
    });
    const proofDescriptor = getProofDescriptor("holder_bound_proof");

    expect(getProofCapabilities().some((item) => item.proofType === "credential_bound_proof")).toBe(true);
    expect(proofDescriptor.privacyMode).toBe("holder_binding");
    expect(getRecoveryPolicySlot("slot-1")?.enabled).toBe(true);
    expect(recoverySnapshot.guardians).toHaveLength(1);
    expect(recoverySnapshot.policySlot?.allowedRecoveryActions).toEqual(["unlock"]);
    expect(recoverySnapshot.intents[0]?.blockedReason).toMatch(/emergency freeze/i);
  });
});
