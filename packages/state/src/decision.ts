import { keccak256, stringToHex, type Hex } from "viem";
import { IdentityState, canTransition } from "./state.js";
import { type RiskAssessment } from "./assessment.js";
import { defaultPropagationLevel, type PropagationLevel } from "./propagation.js";
import { type RiskSignal } from "./signal.js";

export type DecisionActorType = "rule_engine" | "manual" | "governance";

export type StateTransitionDecision = {
  decisionId: string;
  identityId: Hex;
  fromState: IdentityState;
  toState: IdentityState;
  assessmentId: string;
  triggerType: RiskSignal["signalType"];
  signalSeverity: RiskSignal["severity"];
  policyVersion: number;
  actorType: DecisionActorType;
  actorId: string;
  reasonCode: string;
  evidenceBundleHash: Hex;
  createdAt: string;
  recommendedPropagationLevel: PropagationLevel;
};

export function createStateTransitionDecision(input: {
  identityId: Hex;
  fromState: IdentityState;
  assessment: RiskAssessment;
  signal: RiskSignal;
  actorType?: DecisionActorType;
  actorId?: string;
}): StateTransitionDecision {
  if (input.assessment.engineType === "ai") {
    throw new Error("AI assessments cannot update state directly; create a reviewed decision instead.");
  }

  const actorType = input.actorType ?? "rule_engine";
  const toState = input.assessment.recommendedState;
  if (input.fromState !== toState && !canTransition(input.fromState, toState)) {
    throw new Error(`Illegal transition: ${IdentityState[input.fromState]} -> ${IdentityState[toState]}`);
  }

  const createdAt = new Date().toISOString();
  const evidenceBundleHash = keccak256(stringToHex(input.assessment.signalIds.join(":")));
  const recommendedPropagationLevel = defaultPropagationLevel({
    triggerType: input.signal.signalType,
    signalSeverity: input.signal.severity,
    actorType,
  });

  return {
    decisionId: keccak256(stringToHex([input.identityId, input.assessment.assessmentId, createdAt].join(":"))),
    identityId: input.identityId,
    fromState: input.fromState,
    toState,
    assessmentId: input.assessment.assessmentId,
    triggerType: input.signal.signalType,
    signalSeverity: input.signal.severity,
    policyVersion: input.signal.policyVersion,
    actorType,
    actorId: input.actorId ?? input.signal.actor,
    reasonCode: input.assessment.reasonCode,
    evidenceBundleHash,
    createdAt,
    recommendedPropagationLevel,
  };
}
