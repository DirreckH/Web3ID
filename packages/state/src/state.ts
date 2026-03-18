import { type Hex } from "viem";
import { buildRiskAssessment, type RiskAssessment } from "./assessment.js";
import { applyConsequences, getActiveConsequences, type ConsequenceRecord } from "./consequence.js";
import { createStateTransitionDecision, type StateTransitionDecision } from "./decision.js";
import { type RiskSignal } from "./signal.js";

export enum IdentityState {
  INIT = 0,
  NORMAL = 1,
  OBSERVED = 2,
  RESTRICTED = 3,
  HIGH_RISK = 4,
  FROZEN = 5,
}

export type TriggerType =
  | "SANCTION_HIT"
  | "SUSPICIOUS_COUNTERPARTY"
  | "MIXER_INTERACTION"
  | "ISSUER_DOWNGRADE"
  | "GOVERNANCE_ACTION"
  | "MANUAL_REVIEW_RESULT"
  | "NEW_WALLET_OBSERVATION"
  | "NEGATIVE_RISK_FLAG"
  | "LONG_TERM_GOOD_STANDING"
  | "REPEATED_GOVERNANCE_PARTICIPATION"
  | "TRUSTED_PROTOCOL_USAGE"
  | "NO_RISK_INCIDENT_DAYS";

export type EvidenceType =
  | "SANCTIONS_LIST"
  | "COUNTERPARTY_SIGNAL"
  | "MIXER_TRACE"
  | "ISSUER_REGISTRY_UPDATE"
  | "GOVERNANCE_DECISION"
  | "MANUAL_REVIEW"
  | "FIXTURE_SIGNAL"
  | "LOCAL_CHAIN_ACTIVITY"
  | "AI_RECOMMENDATION";

export type StateTransition = {
  fromState: IdentityState;
  toState: IdentityState;
  triggerType: TriggerType;
  evidenceType: EvidenceType;
  actor: string;
  timestamp: number;
  policyVersion: number;
  reason: string;
};

export type IdentityStateContext = {
  identityId: Hex;
  currentState: IdentityState;
  signals: RiskSignal[];
  assessments: RiskAssessment[];
  decisions: StateTransitionDecision[];
  consequences: ConsequenceRecord[];
  lastDecisionRef?: string;
  lastEvidenceHash?: Hex;
};

const ALLOWED_TRANSITIONS: Record<IdentityState, IdentityState[]> = {
  [IdentityState.INIT]: [IdentityState.NORMAL, IdentityState.OBSERVED, IdentityState.RESTRICTED, IdentityState.FROZEN],
  [IdentityState.NORMAL]: [IdentityState.OBSERVED, IdentityState.RESTRICTED, IdentityState.HIGH_RISK, IdentityState.FROZEN],
  [IdentityState.OBSERVED]: [IdentityState.NORMAL, IdentityState.RESTRICTED, IdentityState.HIGH_RISK, IdentityState.FROZEN],
  [IdentityState.RESTRICTED]: [IdentityState.NORMAL, IdentityState.OBSERVED, IdentityState.HIGH_RISK, IdentityState.FROZEN],
  [IdentityState.HIGH_RISK]: [IdentityState.RESTRICTED, IdentityState.FROZEN],
  [IdentityState.FROZEN]: [IdentityState.RESTRICTED, IdentityState.HIGH_RISK],
};

export function compareStates(left: IdentityState, right: IdentityState) {
  return left - right;
}

export function isStateInRange(state: IdentityState, min: IdentityState, max: IdentityState) {
  return compareStates(state, min) >= 0 && compareStates(state, max) <= 0;
}

export function canTransition(fromState: IdentityState, toState: IdentityState) {
  return ALLOWED_TRANSITIONS[fromState].includes(toState);
}

export function mapRiskSignalToState(currentState: IdentityState, signal: Pick<RiskSignal, "signalType" | "type" | "category" | "requestedState">): IdentityState {
  if (signal.requestedState !== undefined) {
    if (
      signal.category === "positive" ||
      signal.signalType === "MANUAL_REVIEW_RESULT" ||
      signal.signalType === "GOVERNANCE_ACTION"
    ) {
      return signal.requestedState;
    }
    return signal.requestedState >= currentState ? signal.requestedState : currentState;
  }

  const signalType = signal.signalType;
  if (signal.category === "positive") {
    return currentState;
  }

  switch (signalType) {
    case "SANCTION_HIT":
      return IdentityState.FROZEN;
    case "SUSPICIOUS_COUNTERPARTY":
    case "NEW_WALLET_OBSERVATION":
      return currentState >= IdentityState.OBSERVED ? currentState : IdentityState.OBSERVED;
    case "MIXER_INTERACTION":
    case "ISSUER_DOWNGRADE":
    case "NEGATIVE_RISK_FLAG":
      return currentState >= IdentityState.RESTRICTED ? currentState : IdentityState.RESTRICTED;
    case "GOVERNANCE_ACTION":
    case "MANUAL_REVIEW_RESULT":
      return signal.requestedState ?? currentState;
    case "LONG_TERM_GOOD_STANDING":
    case "REPEATED_GOVERNANCE_PARTICIPATION":
    case "TRUSTED_PROTOCOL_USAGE":
    case "NO_RISK_INCIDENT_DAYS":
      return IdentityState.NORMAL;
    default:
      return currentState;
  }
}

export function createStateTransition(currentState: IdentityState, signal: RiskSignal): StateTransition {
  const toState = mapRiskSignalToState(currentState, signal);
  if (!canTransition(currentState, toState) && currentState !== toState) {
    throw new Error(`Illegal transition: ${IdentityState[currentState]} -> ${IdentityState[toState]}`);
  }

  return {
    fromState: currentState,
    toState,
    triggerType: signal.signalType,
    evidenceType: signal.evidenceType,
    actor: signal.actor,
    timestamp: signal.timestamp,
    policyVersion: signal.policyVersion,
    reason: signal.reason,
  };
}

export function createIdentityStateContext(identityId: Hex, currentState = IdentityState.INIT): IdentityStateContext {
  return {
    identityId,
    currentState,
    signals: [],
    assessments: [],
    decisions: [],
    consequences: [],
  };
}

export function processRiskSignal(context: IdentityStateContext, signal: RiskSignal) {
  const assessment = buildRiskAssessment({
    identityId: context.identityId,
    signals: [signal],
    recommendedState: mapRiskSignalToState(context.currentState, signal),
    explanationRef: signal.evidenceRef,
  });
  const decision = createStateTransitionDecision({
    identityId: context.identityId,
    fromState: context.currentState,
    assessment,
    signal,
  });
  const consequences = applyConsequences({
    identityId: context.identityId,
    decision,
    assessment,
    signal,
  });

  return {
    next: {
      ...context,
      currentState: decision.toState,
      signals: [...context.signals, signal],
      assessments: [...context.assessments, assessment],
      decisions: [...context.decisions, decision],
      consequences: [...context.consequences, ...consequences],
      lastDecisionRef: decision.decisionId,
      lastEvidenceHash: decision.evidenceBundleHash,
    } satisfies IdentityStateContext,
    assessment,
    decision,
    consequences,
  };
}

export function summarizeIdentityState(context: IdentityStateContext) {
  const activeConsequences = getActiveConsequences(context.consequences);
  const latestDecision = context.decisions.at(-1);
  return {
    currentState: context.currentState,
    activeConsequences,
    latestDecisionReason: latestDecision?.reasonCode ?? null,
    latestDecisionRef: context.lastDecisionRef ?? null,
    latestEvidenceHash: context.lastEvidenceHash ?? null,
  };
}
