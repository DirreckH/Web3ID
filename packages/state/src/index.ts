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
  | "MANUAL_REVIEW_RESULT";

export type EvidenceType =
  | "SANCTIONS_LIST"
  | "COUNTERPARTY_SIGNAL"
  | "MIXER_TRACE"
  | "ISSUER_REGISTRY_UPDATE"
  | "GOVERNANCE_DECISION"
  | "MANUAL_REVIEW";

export type RiskSignal = {
  type: TriggerType;
  evidenceType: EvidenceType;
  actor: string;
  timestamp: number;
  policyVersion: number;
  requestedState?: IdentityState;
  reason: string;
};

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

const ALLOWED_TRANSITIONS: Record<IdentityState, IdentityState[]> = {
  [IdentityState.INIT]: [IdentityState.NORMAL, IdentityState.OBSERVED, IdentityState.RESTRICTED, IdentityState.FROZEN],
  [IdentityState.NORMAL]: [IdentityState.OBSERVED, IdentityState.RESTRICTED, IdentityState.HIGH_RISK, IdentityState.FROZEN],
  [IdentityState.OBSERVED]: [IdentityState.NORMAL, IdentityState.RESTRICTED, IdentityState.HIGH_RISK, IdentityState.FROZEN],
  [IdentityState.RESTRICTED]: [IdentityState.OBSERVED, IdentityState.HIGH_RISK, IdentityState.FROZEN],
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

export function mapRiskSignalToState(currentState: IdentityState, signal: RiskSignal): IdentityState {
  switch (signal.type) {
    case "SANCTION_HIT":
      return IdentityState.FROZEN;
    case "SUSPICIOUS_COUNTERPARTY":
      return currentState >= IdentityState.OBSERVED ? currentState : IdentityState.OBSERVED;
    case "MIXER_INTERACTION":
      return currentState >= IdentityState.RESTRICTED ? currentState : IdentityState.RESTRICTED;
    case "ISSUER_DOWNGRADE":
      return currentState >= IdentityState.RESTRICTED ? currentState : IdentityState.RESTRICTED;
    case "GOVERNANCE_ACTION":
    case "MANUAL_REVIEW_RESULT":
      return signal.requestedState ?? currentState;
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
    triggerType: signal.type,
    evidenceType: signal.evidenceType,
    actor: signal.actor,
    timestamp: signal.timestamp,
    policyVersion: signal.policyVersion,
    reason: signal.reason,
  };
}
