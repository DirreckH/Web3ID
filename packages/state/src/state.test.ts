import { describe, expect, it } from "vitest";
import { LinkabilityLevel, RiskIsolationLevel } from "../../identity/src/index.js";
import { evaluateRecovery } from "./recovery.js";
import { evaluatePropagation, PropagationLevel } from "./propagation.js";
import { createRiskSignal } from "./signal.js";
import {
  IdentityState,
  canTransition,
  compareStates,
  createIdentityStateContext,
  isStateInRange,
  mapRiskSignalToState,
  processRiskSignal,
} from "./index.js";

describe("state machine", () => {
  it("uses the locked enum ordering", () => {
    expect(compareStates(IdentityState.NORMAL, IdentityState.INIT)).toBe(1);
    expect(compareStates(IdentityState.FROZEN, IdentityState.HIGH_RISK)).toBe(1);
  });

  it("evaluates state ranges numerically", () => {
    expect(isStateInRange(IdentityState.OBSERVED, IdentityState.NORMAL, IdentityState.RESTRICTED)).toBe(true);
    expect(isStateInRange(IdentityState.FROZEN, IdentityState.NORMAL, IdentityState.RESTRICTED)).toBe(false);
  });

  it("maps risk signals deterministically", () => {
    const signal = createRiskSignal({
      identityId: "0x0000000000000000000000000000000000000000000000000000000000000001",
      sourceType: "fixture",
      sourceId: "mixer",
      type: "MIXER_INTERACTION",
      severity: "high",
      category: "negative",
      evidenceType: "MIXER_TRACE",
      evidenceRef: "fixture://mixer",
      observedAt: new Date(1_000).toISOString(),
      actor: "analyzer",
      policyVersion: 1,
      reason: "trace",
      reasonCode: "MIXER_TRACE",
      explanation: "Mixer interaction should restrict the identity.",
    });

    expect(mapRiskSignalToState(IdentityState.NORMAL, signal)).toBe(IdentityState.RESTRICTED);
  });

  it("rejects illegal transitions", () => {
    const signal = createRiskSignal({
      identityId: "0x0000000000000000000000000000000000000000000000000000000000000001",
      sourceType: "manual",
      sourceId: "bad-rollback",
      type: "MANUAL_REVIEW_RESULT",
      severity: "high",
      category: "negative",
      evidenceType: "MANUAL_REVIEW",
      evidenceRef: "fixture://manual-review",
      observedAt: new Date(1_000).toISOString(),
      actor: "reviewer",
      policyVersion: 1,
      requestedState: IdentityState.INIT,
      reason: "bad rollback",
      reasonCode: "BAD_ROLLBACK",
      explanation: "Illegal rollback should be rejected.",
    });
    const context = createIdentityStateContext(signal.identityId, IdentityState.NORMAL);

    expect(() => processRiskSignal(context, signal)).toThrow(/Illegal transition/);
    expect(canTransition(IdentityState.HIGH_RISK, IdentityState.NORMAL)).toBe(false);
  });

  it("builds the attribution chain in fixed order and applies consequences", () => {
    const identityId = "0x0000000000000000000000000000000000000000000000000000000000000002";
    const context = createIdentityStateContext(identityId, IdentityState.NORMAL);
    const signal = createRiskSignal({
      identityId,
      sourceType: "fixture",
      sourceId: "negative-risk",
      type: "NEGATIVE_RISK_FLAG",
      severity: "high",
      category: "negative",
      evidenceType: "FIXTURE_SIGNAL",
      evidenceRef: "fixture://negative-risk",
      observedAt: new Date(1_000).toISOString(),
      actor: "demo",
      policyVersion: 1,
      reason: "negative risk fixture",
      reasonCode: "NEGATIVE_RISK_FLAG",
      explanation: "Mock risk flag should create a restriction.",
    });

    const result = processRiskSignal(context, signal);
    expect(result.next.currentState).toBe(IdentityState.RESTRICTED);
    expect(result.assessment.signalIds).toEqual([signal.signalId]);
    expect(result.decision.assessmentId).toBe(result.assessment.assessmentId);
    expect(result.consequences[0].sourceDecisionId).toBe(result.decision.decisionId);
    expect(result.consequences[0].consequenceType).toBe("limit");
  });

  it("evaluates propagation without defaulting to global lockdown", () => {
    const identityId = "0x0000000000000000000000000000000000000000000000000000000000000010";
    const signal = createRiskSignal({
      identityId,
      sourceType: "fixture",
      sourceId: "sanction",
      type: "SANCTION_HIT",
      severity: "critical",
      category: "negative",
      evidenceType: "SANCTIONS_LIST",
      evidenceRef: "fixture://sanction",
      observedAt: new Date(1_000).toISOString(),
      actor: "demo",
      policyVersion: 1,
      reason: "critical sanction",
      reasonCode: "SANCTION_HIT",
      explanation: "Sanction hit escalates to the root.",
    });
    const decision = processRiskSignal(createIdentityStateContext(identityId, IdentityState.NORMAL), signal).decision;

    const propagation = evaluatePropagation(
      decision,
      {
        identityId: signal.identityId,
        rootIdentityId: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        scope: "social",
        permissions: {
          allowedCredentialTypes: [],
          allowedProofTypes: [],
          supportedProofKinds: ["holder_bound_proof"],
          allowRootLink: false,
          riskIsolationLevel: RiskIsolationLevel.LOW,
          linkabilityLevel: LinkabilityLevel.SAME_SCOPE,
          canEscalateToRoot: true,
          inheritsRootRestrictions: true,
        },
      },
      [
        {
          identityId: signal.identityId,
          rootIdentityId: "0x00000000000000000000000000000000000000000000000000000000000000aa",
          scope: "social",
        },
        {
          identityId: "0x0000000000000000000000000000000000000000000000000000000000000011",
          rootIdentityId: "0x00000000000000000000000000000000000000000000000000000000000000aa",
          scope: "payments",
        },
      ] as const,
    );

    expect(propagation.level).toBe(PropagationLevel.ROOT_ESCALATION);
    expect(propagation.impactedIdentityIds).toHaveLength(2);
  });

  it("keeps critical governance signals below global lockdown unless governance explicitly overrides", () => {
    const identityId = "0x0000000000000000000000000000000000000000000000000000000000000012";
    const signal = createRiskSignal({
      identityId,
      sourceType: "governance",
      sourceId: "governance-escalation",
      type: "GOVERNANCE_ACTION",
      severity: "critical",
      category: "negative",
      evidenceType: "GOVERNANCE_DECISION",
      evidenceRef: "fixture://governance-escalation",
      observedAt: new Date(1_500).toISOString(),
      actor: "governance-council",
      policyVersion: 1,
      requestedState: IdentityState.FROZEN,
      reason: "governance escalation",
      reasonCode: "GOVERNANCE_ESCALATION",
      explanation: "Critical governance actions should default to root escalation only.",
    });
    const decision = processRiskSignal(createIdentityStateContext(identityId, IdentityState.NORMAL), signal).decision;

    const identityGraph = [
      {
        identityId,
        rootIdentityId: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        scope: "social",
      },
      {
        identityId: "0x0000000000000000000000000000000000000000000000000000000000000013",
        rootIdentityId: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        scope: "payments",
      },
    ] as const;

    const defaultPropagation = evaluatePropagation(
      decision,
      {
        identityId,
        rootIdentityId: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        scope: "social",
        permissions: {
          allowedCredentialTypes: [],
          allowedProofTypes: [],
          supportedProofKinds: ["holder_bound_proof"],
          allowRootLink: false,
          riskIsolationLevel: RiskIsolationLevel.LOW,
          linkabilityLevel: LinkabilityLevel.SAME_SCOPE,
          canEscalateToRoot: true,
          inheritsRootRestrictions: true,
        },
      },
      identityGraph,
    );
    expect(defaultPropagation.level).toBe(PropagationLevel.ROOT_ESCALATION);

    const governancePropagation = evaluatePropagation(
      { ...decision, actorType: "governance" },
      {
        identityId,
        rootIdentityId: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        scope: "social",
        permissions: {
          allowedCredentialTypes: [],
          allowedProofTypes: [],
          supportedProofKinds: ["holder_bound_proof"],
          allowRootLink: false,
          riskIsolationLevel: RiskIsolationLevel.LOW,
          linkabilityLevel: LinkabilityLevel.SAME_SCOPE,
          canEscalateToRoot: true,
          inheritsRootRestrictions: true,
        },
      },
      identityGraph,
      PropagationLevel.GLOBAL_LOCKDOWN,
    );
    expect(governancePropagation.level).toBe(PropagationLevel.GLOBAL_LOCKDOWN);
  });

  it("runs recovery as an explicit flow after consequences have been applied", () => {
    const identityId = "0x0000000000000000000000000000000000000000000000000000000000000020";
    const restrictedContext = processRiskSignal(
      createIdentityStateContext(identityId, IdentityState.NORMAL),
      createRiskSignal({
        identityId,
        sourceType: "fixture",
        sourceId: "negative-risk",
        type: "NEGATIVE_RISK_FLAG",
        severity: "high",
        category: "negative",
        evidenceType: "FIXTURE_SIGNAL",
        evidenceRef: "fixture://negative-risk",
        observedAt: new Date(1_000).toISOString(),
        actor: "demo",
        policyVersion: 1,
        reason: "negative risk fixture",
        reasonCode: "NEGATIVE_RISK_FLAG",
        explanation: "Mock risk flag should create a restriction.",
      }),
    ).next;

    const recoverySignal = createRiskSignal({
      identityId,
      sourceType: "fixture",
      sourceId: "good-standing",
      type: "LONG_TERM_GOOD_STANDING",
      severity: "positive",
      category: "positive",
      evidenceType: "FIXTURE_SIGNAL",
      evidenceRef: "fixture://good-standing",
      observedAt: new Date(2_000).toISOString(),
      actor: "demo",
      policyVersion: 1,
      reason: "good standing",
      reasonCode: "LONG_TERM_GOOD_STANDING",
      explanation: "A deterministic recovery signal should unlock the restriction.",
    });
    const positiveResult = processRiskSignal(restrictedContext, recoverySignal);
    expect(positiveResult.next.currentState).toBe(IdentityState.RESTRICTED);

    const recovery = evaluateRecovery(positiveResult.next, [recoverySignal]);
    expect(recovery.resolvedConsequences).toHaveLength(1);
    expect(recovery.resolvedConsequences[0].consequenceType).toBe("limit");
    expect(recovery.next.currentState).toBe(IdentityState.NORMAL);
    expect(recovery.next.decisions.at(-1)?.assessmentId).toBe(recovery.assessment?.assessmentId);
  });
});
