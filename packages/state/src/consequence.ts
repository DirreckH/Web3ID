import { type Hex } from "viem";
import { IdentityState } from "./state.js";
import { DEFAULT_RECOVERY_RULES, type RecoveryRule } from "./recovery.js";
import { type RiskAssessment } from "./assessment.js";
import { type StateTransitionDecision } from "./decision.js";
import { type RiskSignal } from "./signal.js";

export type ConsequenceTargetLevel = "sub" | "root" | "scope";
export type ConsequenceType =
  | "warn"
  | "limit"
  | "freeze"
  | "review_required"
  | "trust_decrease"
  | "trust_boost"
  | "limit_relaxation"
  | "access_unlock"
  | "reputation_badge";

export type ConsequenceRecord = {
  consequenceId: string;
  identityId: Hex;
  targetLevel: ConsequenceTargetLevel;
  consequenceType: ConsequenceType;
  severity: RiskSignal["severity"];
  reasonCode: string;
  sourceDecisionId: string;
  effectiveFrom: string;
  expiresAt?: string;
  recoverable: boolean;
  recoveryRuleId?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBySignalId?: string;
  resolvedByDecisionId?: string;
};

export function applyConsequences(input: {
  identityId: Hex;
  decision: StateTransitionDecision;
  assessment: RiskAssessment;
  signal: RiskSignal;
  targetLevel?: ConsequenceTargetLevel;
}): ConsequenceRecord[] {
  const createdAt = new Date().toISOString();
  const consequenceType = consequenceTypeFor(input.signal.category, input.decision.toState);
  const recoveryRule = recoveryRuleFor(consequenceType);

  return [
    {
      consequenceId: `${input.decision.decisionId}:${consequenceType}`,
      identityId: input.identityId,
      targetLevel: input.targetLevel ?? "sub",
      consequenceType,
      severity: input.signal.severity,
      reasonCode: input.assessment.reasonCode,
      sourceDecisionId: input.decision.decisionId,
      effectiveFrom: createdAt,
      expiresAt: recoveryRule && recoveryRule.requiredCooldown > 0 ? futureIso(recoveryRule.requiredCooldown) : undefined,
      recoverable: consequenceType !== "trust_decrease",
      recoveryRuleId: recoveryRule?.ruleId,
      createdAt,
    },
  ];
}

export function getActiveConsequences(consequences: ConsequenceRecord[], at = new Date().toISOString()) {
  return consequences.filter(
    (consequence) => !consequence.resolvedAt && (!consequence.expiresAt || consequence.expiresAt >= at),
  );
}

function consequenceTypeFor(category: RiskSignal["category"], state: IdentityState): ConsequenceType {
  if (category === "positive") {
    if (state <= IdentityState.NORMAL) {
      return "access_unlock";
    }
    return "trust_boost";
  }

  switch (state) {
    case IdentityState.OBSERVED:
      return "warn";
    case IdentityState.RESTRICTED:
      return "limit";
    case IdentityState.HIGH_RISK:
      return "review_required";
    case IdentityState.FROZEN:
      return "freeze";
    default:
      return "trust_decrease";
  }
}

function recoveryRuleFor(consequenceType: ConsequenceType): RecoveryRule | undefined {
  if (consequenceType === "warn") {
    return DEFAULT_RECOVERY_RULES.warning_recovery;
  }
  if (consequenceType === "limit" || consequenceType === "review_required") {
    return DEFAULT_RECOVERY_RULES.restricted_recovery;
  }
  if (consequenceType === "freeze") {
    return DEFAULT_RECOVERY_RULES.freeze_recovery;
  }
  return undefined;
}

function futureIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
