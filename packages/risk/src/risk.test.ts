import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createSameRootProof, createSubIdentityLinkProof, deriveRootIdentity, listDefaultSubIdentities, LinkabilityLevel, RiskIsolationLevel } from "../../identity/src/index.js";
import { IdentityState } from "../../state/src/index.js";
import { createBindingChallenge, buildSameRootAuthorizationMessage, verifyBindingSubmission } from "./bindings.js";
import { createAnchorQueueEntry, shouldAnchorState } from "./anchoring.js";
import { generateAiSuggestions } from "./ai-assistant.js";
import { deriveListEntries, listNameForIdentityState, normalizeRiskListEntryState, statesForRiskList, summarizeLists } from "./lists.js";
import { evaluateAccessRisk, evaluateWarningRisk } from "./policy.js";
import { evaluateSubToRootPropagation, computeEffectiveSubState } from "./propagation.js";
import { buildAutomaticRecoverySignals, buildManualReleaseWindow } from "./reentry.js";
import { buildScoreBreakdown } from "./scoring.js";
import { buildDeterministicSignals } from "./state-machine.js";
import { buildRiskSummaryExplanation } from "./explanation.js";
import type { BehaviorEvent, RiskSummary } from "./types.js";

const rootIdentityId = "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
const subIdentityId = "0x00000000000000000000000000000000000000000000000000000000000000bb" as const;
const testAccount = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const secondAccount = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945384d7d0f5fb8f7c8d17826dfec353bbf4d6");

function makeEvent(kind: BehaviorEvent["kind"], blockTimestamp: string, overrides: Partial<BehaviorEvent> = {}): BehaviorEvent {
  return {
    eventId: `${kind}:${blockTimestamp}`,
    chainId: 31337,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000123",
    txIndex: 0,
    blockNumber: 1n,
    blockTimestamp,
    address: "0x0000000000000000000000000000000000000011",
    direction: "outgoing",
    rootIdentityId,
    subIdentityId,
    bindingId: "binding-1",
    kind,
    label: kind,
    protocolTags: [],
    value: 0n,
    rawRef: "chain:31337:tx:0x123",
    evidenceRefs: ["tx:0x123"],
    ...overrides,
  };
}

describe("risk package", () => {
  it("maps mixer and sanctions to stronger Phase3 states", () => {
    const signals = buildDeterministicSignals({
      rootIdentityId,
      subIdentityId,
      events: [
        makeEvent("mixer_interaction", new Date("2026-03-01T00:00:00Z").toISOString()),
        makeEvent("sanctioned_interaction", new Date("2026-03-02T00:00:00Z").toISOString()),
      ],
    });

    expect(signals[0].requestedState).toBe(IdentityState.HIGH_RISK);
    expect(signals[1].requestedState).toBe(IdentityState.FROZEN);
  });

  it("computes sub->root propagation and root overlays", () => {
    const propagation = evaluateSubToRootPropagation({
      subject: {
        identityId: subIdentityId,
        rootIdentityId,
        scope: "payments",
        storedState: IdentityState.HIGH_RISK,
        permissions: {
          allowedCredentialTypes: [],
          allowedProofTypes: [],
          supportedProofKinds: ["holder_bound_proof"],
          allowRootLink: true,
          riskIsolationLevel: RiskIsolationLevel.HIGH,
          linkabilityLevel: LinkabilityLevel.ROOT_LINKABLE,
          canEscalateToRoot: true,
          inheritsRootRestrictions: true,
        },
      },
      siblings: [
        {
          identityId: subIdentityId,
          rootIdentityId,
          scope: "payments",
          storedState: IdentityState.HIGH_RISK,
          permissions: {
            allowedCredentialTypes: [],
            allowedProofTypes: [],
            supportedProofKinds: ["holder_bound_proof"],
            allowRootLink: true,
            riskIsolationLevel: RiskIsolationLevel.HIGH,
            linkabilityLevel: LinkabilityLevel.ROOT_LINKABLE,
            canEscalateToRoot: true,
            inheritsRootRestrictions: true,
          },
        },
        {
          identityId: "0x00000000000000000000000000000000000000000000000000000000000000bc",
          rootIdentityId,
          scope: "payments",
          storedState: IdentityState.NORMAL,
          permissions: {
            allowedCredentialTypes: [],
            allowedProofTypes: [],
            supportedProofKinds: ["holder_bound_proof"],
            allowRootLink: true,
            riskIsolationLevel: RiskIsolationLevel.HIGH,
            linkabilityLevel: LinkabilityLevel.ROOT_LINKABLE,
            canEscalateToRoot: true,
            inheritsRootRestrictions: true,
          },
        },
      ],
      nextState: IdentityState.HIGH_RISK,
      ruleFamily: "counterparty",
      rootSensitive: true,
      recentHistory: [
        { identityId: subIdentityId, state: IdentityState.HIGH_RISK, occurredAt: new Date("2026-03-01T00:00:00Z").toISOString(), ruleFamily: "counterparty" },
        { identityId: "0x00000000000000000000000000000000000000000000000000000000000000bc", state: IdentityState.HIGH_RISK, occurredAt: new Date("2026-03-02T00:00:00Z").toISOString(), ruleFamily: "counterparty" },
      ],
      now: new Date("2026-03-03T00:00:00Z").toISOString(),
    });

    expect(propagation.rootTargetState).toBe(IdentityState.RESTRICTED);
    expect(computeEffectiveSubState({ storedState: IdentityState.NORMAL, rootStoredState: IdentityState.RESTRICTED, inheritsRootRestrictions: true })).toBe(IdentityState.RESTRICTED);
    expect(computeEffectiveSubState({ storedState: IdentityState.NORMAL, rootStoredState: IdentityState.RESTRICTED, inheritsRootRestrictions: false })).toBe(IdentityState.NORMAL);
  });

  it("creates automatic re-entry signals without jumping frozen identities", () => {
    const trustedEvent = makeEvent("trusted_defi_interaction", new Date("2026-03-20T00:00:00Z").toISOString());
    const signals = buildAutomaticRecoverySignals({
      identityId: subIdentityId,
      rootIdentityId,
      subIdentityId,
      currentState: IdentityState.RESTRICTED,
      signals: buildDeterministicSignals({ rootIdentityId, subIdentityId, events: [trustedEvent, { ...trustedEvent, eventId: "trusted-2", blockTimestamp: new Date("2026-03-21T00:00:00Z").toISOString() }] }),
      score: buildScoreBreakdown({
        identityId: subIdentityId,
        rootIdentityId,
        subIdentityId,
        events: [trustedEvent],
        now: new Date("2026-04-10T00:00:00Z").toISOString(),
      }),
      openReviewItems: [],
      now: new Date("2026-04-10T00:00:00Z").toISOString(),
    });

    expect(signals[0].requestedState).toBe(IdentityState.OBSERVED);

    const frozenSignals = buildAutomaticRecoverySignals({
      identityId: subIdentityId,
      rootIdentityId,
      subIdentityId,
      currentState: IdentityState.FROZEN,
      signals: [],
      score: buildScoreBreakdown({ identityId: subIdentityId, rootIdentityId, subIdentityId, events: [] }),
      openReviewItems: [],
    });
    expect(frozenSignals).toHaveLength(0);
  });

  it("anchors only compliance-relevant states and keeps observed chain-offline", () => {
    expect(
      shouldAnchorState({ kind: "sub", subType: "SOCIAL" as any, storedState: IdentityState.OBSERVED, effectiveState: IdentityState.OBSERVED, isManualOrGovernance: false }),
    ).toBe(false);
    expect(
      shouldAnchorState({ kind: "sub", subType: "RWA_INVEST" as any, storedState: IdentityState.RESTRICTED, effectiveState: IdentityState.RESTRICTED, isManualOrGovernance: false }),
    ).toBe(true);

    const entry = createAnchorQueueEntry({
      identityId: subIdentityId,
      rootIdentityId,
      subIdentityId,
      storedState: IdentityState.RESTRICTED,
      effectiveState: IdentityState.RESTRICTED,
      reasonCode: "ROOT_RESTRICTED_ESCALATION",
      policyVersion: 1,
      registryVersion: 1,
      decisionId: "decision-1",
      evidenceRefs: ["tx:0x123"],
      anchorSeq: 1,
      shouldMaterializeState: true,
    });
    expect(entry.shouldMaterializeState).toBe(true);
    expect(entry.stateHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("derives lists, warnings, and AI review-only suggestions", async () => {
    const summary: RiskSummary = {
      identityId: subIdentityId,
      rootIdentityId,
      subIdentityId,
      storedState: IdentityState.HIGH_RISK,
      effectiveState: IdentityState.HIGH_RISK,
      riskScore: 80,
      reputationScore: 0,
      confidenceScore: 20,
      finalInternalScore: 82,
      reasonCodes: ["MIXER_INTERACTION"],
      warnings: ["Mixer interaction detected"],
      evidenceRefs: ["tx:0x123"],
      watchlist: [],
      restrictedList: [],
      blacklistOrFrozenList: [],
      explanation: buildRiskSummaryExplanation({
        summary: {
          storedState: IdentityState.HIGH_RISK,
          effectiveState: IdentityState.HIGH_RISK,
          reasonCodes: ["MIXER_INTERACTION"],
          evidenceRefs: ["tx:0x123"],
        },
      }),
    };
    const ai = await generateAiSuggestions({
      identityId: subIdentityId,
      rootIdentityId,
      subIdentityId,
      summary,
      signals: buildDeterministicSignals({ rootIdentityId, subIdentityId, events: [makeEvent("mixer_interaction", new Date().toISOString())] }),
    });
    expect(["watch", "review", "warn_only"]).toContain(ai[0].recommendedAction);
    expect(ai[0].audit.recommendedAction).toBe(ai[0].recommendedAction);

    const lists = summarizeLists(
      deriveListEntries({
        identityId: subIdentityId,
        rootIdentityId,
        subIdentityId,
        state: IdentityState.HIGH_RISK,
        reasonCode: "MIXER_INTERACTION",
        sourceSignalIds: [],
        evidenceRefs: ["tx:0x123"],
        aiSuggestions: ai,
      }),
    );
    expect(listNameForIdentityState(IdentityState.HIGH_RISK)).toBe("restricted_list");
    expect(statesForRiskList("restricted_list")).toEqual([IdentityState.RESTRICTED, IdentityState.HIGH_RISK]);
    expect(normalizeRiskListEntryState("blacklist_or_frozen_list")).toBe(IdentityState.FROZEN);
    expect(lists.restrictedList).toHaveLength(1);
    expect(lists.watchlist.length).toBeGreaterThan(0);
    expect(lists.watchlist.every((entry) => entry.state === IdentityState.OBSERVED)).toBe(true);
  });

  it("evaluates access and warning policy decisions separately", () => {
    const summary: RiskSummary = {
      identityId: subIdentityId,
      rootIdentityId,
      subIdentityId,
      storedState: IdentityState.RESTRICTED,
      effectiveState: IdentityState.RESTRICTED,
      riskScore: 50,
      reputationScore: 0,
      confidenceScore: 10,
      finalInternalScore: 55,
      reasonCodes: ["HIGH_RISK_COUNTERPARTY"],
      warnings: ["Counterparty risk"],
      evidenceRefs: ["tx:0x123"],
      watchlist: [],
      restrictedList: [],
      blacklistOrFrozenList: [],
      explanation: buildRiskSummaryExplanation({
        summary: {
          storedState: IdentityState.RESTRICTED,
          effectiveState: IdentityState.RESTRICTED,
          reasonCodes: ["HIGH_RISK_COUNTERPARTY"],
          evidenceRefs: ["tx:0x123"],
        },
      }),
    };
    expect(evaluateAccessRisk({ policyLabel: "RWA_BUY_V2", summary, policyVersion: 1 }).decision).toBe("restrict");
    expect(evaluateWarningRisk({ policyId: "COUNTERPARTY_WARNING_V1", summary, policyVersion: 1 }).decision).toBe("warn");
  });

  it("builds binding challenges with stable authorization messages", () => {
    const rootIdentity = deriveRootIdentity(testAccount.address, 31337);
    const extensionControllerRef = deriveRootIdentity(secondAccount.address, 31337).primaryControllerRef;
    const challenge = createBindingChallenge({
      bindingType: "same_root_extension",
      controllerRef: extensionControllerRef,
      rootIdentityId: rootIdentity.identityId,
    });
    expect(challenge.challengeMessage).toContain("Web3ID Controller Challenge");
    expect(challenge.candidateAddress).toBe(secondAccount.address);
    const authorization = buildSameRootAuthorizationMessage({
      challengeHash: challenge.challengeHash,
      candidateAddress: challenge.candidateAddress!,
      rootIdentityId: rootIdentity.identityId,
      authorizerAddress: testAccount.address,
    });
    expect(authorization).toContain(String(challenge.challengeHash));
    expect(challenge.challengeFields.replayScope).toContain("same_root_extension");
  });

  it("respects manual release observation floors", () => {
    const window = buildManualReleaseWindow({ releasedAt: new Date("2026-03-01T00:00:00Z").toISOString(), currentState: IdentityState.FROZEN });
    expect(window.floorState).toBe(IdentityState.HIGH_RISK);
    expect(Date.parse(window.floorUntil)).toBeGreaterThan(Date.parse(window.releasedAt));
  });

  it("validates same-root bindings and rejects invalid authorizers or proofs", async () => {
    const rootIdentity = deriveRootIdentity(testAccount.address, 31337);
    const [rwaIdentity, paymentsIdentity] = listDefaultSubIdentities(rootIdentity);
    const activeRootBinding = {
      bindingId: "active-root-binding",
      type: "root_controller" as const,
      status: "ACTIVE" as const,
      address: testAccount.address,
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
      createdAt: new Date().toISOString(),
      evidenceRefs: [],
      bindingHash: "0x1111111111111111111111111111111111111111111111111111111111111111" as const,
    };
    const challenge = createBindingChallenge({
      bindingType: "same_root_extension",
      controllerRef: deriveRootIdentity(secondAccount.address, 31337).primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
    });

    const success = await verifyBindingSubmission({
      challenge,
      candidateSignature: await secondAccount.signMessage({ message: challenge.challengeMessage }),
      rootIdentity: rootIdentity,
      sameRootProof: createSameRootProof(rootIdentity, [rwaIdentity, paymentsIdentity]),
      authorizerAddress: testAccount.address,
      authorizerSignature: await testAccount.signMessage({
        message: buildSameRootAuthorizationMessage({
          challengeHash: challenge.challengeHash,
          candidateAddress: secondAccount.address,
          rootIdentityId: rootIdentity.identityId,
          authorizerAddress: testAccount.address,
        }),
      }),
      activeBindings: [activeRootBinding],
    });
    expect(success.evidenceRefs.some((ref) => ref.startsWith("same-root-proof:"))).toBe(true);

    await expect(
      verifyBindingSubmission({
        challenge,
        candidateSignature: await secondAccount.signMessage({ message: challenge.challengeMessage }),
        rootIdentity: rootIdentity,
        sameRootProof: createSameRootProof(rootIdentity, [rwaIdentity, paymentsIdentity]),
        authorizerAddress: secondAccount.address,
        authorizerSignature: await secondAccount.signMessage({
          message: buildSameRootAuthorizationMessage({
            challengeHash: challenge.challengeHash,
            candidateAddress: secondAccount.address,
            rootIdentityId: rootIdentity.identityId,
            authorizerAddress: secondAccount.address,
          }),
        }),
        activeBindings: [],
      }),
    ).rejects.toThrow("already active authorizer binding");

    const subChallenge = createBindingChallenge({
      bindingType: "sub_identity_link",
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: rwaIdentity.identityId,
    });
    await expect(
      verifyBindingSubmission({
        challenge: subChallenge,
        candidateSignature: await testAccount.signMessage({ message: subChallenge.challengeMessage }),
        rootIdentity: rootIdentity,
        subIdentity: rwaIdentity,
        linkProof: createSubIdentityLinkProof(rootIdentity, paymentsIdentity),
      }),
    ).rejects.toThrow("Invalid sub identity link proof.");
  });
});
