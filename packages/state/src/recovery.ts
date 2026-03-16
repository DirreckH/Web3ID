import { type RiskAssessment, buildRiskAssessment } from "./assessment.js";
import { type ConsequenceRecord } from "./consequence.js";
import { createStateTransitionDecision, type StateTransitionDecision } from "./decision.js";
import { IdentityState, type IdentityStateContext } from "./state.js";
import { type RiskSignal } from "./signal.js";

export type RecoveryRule = {
  ruleId: string;
  appliesTo: string[];
  requiredCooldown: number;
  requiredManualReview: boolean;
  requiredPositiveSignals: string[];
  requiredNoFurtherRiskDays: number;
};

export const DEFAULT_RECOVERY_RULES: Record<string, RecoveryRule> = {
  warning_recovery: {
    ruleId: "warning_recovery",
    appliesTo: ["warn"],
    requiredCooldown: 0,
    requiredManualReview: false,
    requiredPositiveSignals: ["long_term_good_standing"],
    requiredNoFurtherRiskDays: 0,
  },
  restricted_recovery: {
    ruleId: "restricted_recovery",
    appliesTo: ["limit", "review_required"],
    requiredCooldown: 0,
    requiredManualReview: false,
    requiredPositiveSignals: ["long_term_good_standing", "trusted_protocol_usage", "repeated_governance_participation"],
    requiredNoFurtherRiskDays: 0,
  },
  freeze_recovery: {
    ruleId: "freeze_recovery",
    appliesTo: ["freeze"],
    requiredCooldown: 30,
    requiredManualReview: true,
    requiredPositiveSignals: ["long_term_good_standing"],
    requiredNoFurtherRiskDays: 30,
  },
};

export type RecoveryEvaluation = {
  next: IdentityStateContext;
  resolvedConsequences: ConsequenceRecord[];
  assessment?: RiskAssessment;
  decision?: StateTransitionDecision;
};

export function evaluateRecovery(
  context: IdentityStateContext,
  positiveSignals: RiskSignal[],
  now = new Date().toISOString(),
): RecoveryEvaluation {
  if (positiveSignals.length === 0) {
    return { next: context, resolvedConsequences: [] };
  }

  const satisfiableSignals = positiveSignals.filter((signal) => signal.category === "positive");
  if (satisfiableSignals.length === 0) {
    return { next: context, resolvedConsequences: [] };
  }

  const activeRecoverable = context.consequences.filter((consequence) => isConsequenceActive(consequence, now) && consequence.recoverable);
  const resolvedConsequences = activeRecoverable.filter((consequence) =>
    satisfiesRecoveryRule(consequence, satisfiableSignals, now),
  );
  if (resolvedConsequences.length === 0) {
    return { next: context, resolvedConsequences: [] };
  }

  const lastSignal = satisfiableSignals.at(-1)!;
  let nextConsequences = context.consequences.map((consequence) =>
    resolvedConsequences.some((resolved) => resolved.consequenceId === consequence.consequenceId)
      ? {
          ...consequence,
          resolvedAt: now,
          resolvedBySignalId: lastSignal.signalId,
        }
      : consequence,
  );

  const nextState = recoveryTargetState(context.currentState);
  if (nextState === null || nextState === context.currentState) {
    return {
      next: {
        ...context,
        consequences: nextConsequences,
      },
      resolvedConsequences: nextConsequences.filter((consequence) => consequence.resolvedAt === now),
    };
  }

  const assessment = buildRiskAssessment({
    identityId: context.identityId,
    signals: satisfiableSignals,
    recommendedState: nextState,
    explanationRef: lastSignal.evidenceRef,
  });
  const decision = createStateTransitionDecision({
    identityId: context.identityId,
    fromState: context.currentState,
    assessment,
    signal: lastSignal,
  });

  nextConsequences = nextConsequences.map((consequence) =>
    consequence.resolvedAt === now
      ? {
          ...consequence,
          resolvedByDecisionId: decision.decisionId,
        }
      : consequence,
  );

  return {
    next: {
      ...context,
      currentState: decision.toState,
      assessments: [...context.assessments, assessment],
      decisions: [...context.decisions, decision],
      consequences: nextConsequences,
      lastDecisionRef: decision.decisionId,
      lastEvidenceHash: decision.evidenceBundleHash,
    },
    resolvedConsequences: nextConsequences.filter((consequence) => consequence.resolvedAt === now),
    assessment,
    decision,
  };
}

function satisfiesRecoveryRule(consequence: ConsequenceRecord, positiveSignals: RiskSignal[], now: string) {
  const recoveryRule = consequence.recoveryRuleId ? DEFAULT_RECOVERY_RULES[consequence.recoveryRuleId] : undefined;
  if (!recoveryRule) {
    return false;
  }

  const cooldownSatisfied = recoveryRule.requiredCooldown === 0 || consequence.effectiveFrom <= now;
  const positiveSignalSatisfied = positiveSignals.some((signal) =>
    recoveryRule.requiredPositiveSignals.includes(normalizeSignalName(signal)),
  );

  return cooldownSatisfied && positiveSignalSatisfied && !recoveryRule.requiredManualReview;
}

function normalizeSignalName(signal: RiskSignal) {
  return signal.signalType.toLowerCase();
}

function isConsequenceActive(consequence: ConsequenceRecord, now: string) {
  return !consequence.resolvedAt && (!consequence.expiresAt || consequence.expiresAt >= now);
}

function recoveryTargetState(currentState: IdentityState) {
  switch (currentState) {
    case IdentityState.OBSERVED:
    case IdentityState.RESTRICTED:
      return IdentityState.NORMAL;
    case IdentityState.HIGH_RISK:
      return IdentityState.RESTRICTED;
    case IdentityState.FROZEN:
      return IdentityState.HIGH_RISK;
    default:
      return null;
  }
}
