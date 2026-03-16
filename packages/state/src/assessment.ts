import { keccak256, stringToHex, type Hex } from "viem";
import { IdentityState } from "./state.js";
import { type RiskSignal } from "./signal.js";

export type AssessmentEngineType = "rule" | "manual" | "ai";
export type AssessmentResult = "allow" | "observe" | "restrict" | "review_required" | "freeze" | "recover";

export type AiAssessmentMetadata = {
  modelName: string;
  modelVersion: string;
  inputHash: Hex;
  outputSummary: string;
  confidence: number;
  humanReviewRequired: boolean;
};

export type RiskAssessment = {
  assessmentId: string;
  signalIds: string[];
  identityId: Hex;
  engineType: AssessmentEngineType;
  engineVersion: string;
  assessmentResult: AssessmentResult;
  scoreDelta: number;
  recommendedState: IdentityState;
  recommendedActions: string[];
  reasonCode: string;
  explanationRef: string;
  createdAt: string;
  aiMetadata?: AiAssessmentMetadata;
};

export function buildRiskAssessment(input: {
  identityId: Hex;
  signals: RiskSignal[];
  recommendedState: IdentityState;
  engineType?: AssessmentEngineType;
  engineVersion?: string;
  explanationRef?: string;
  aiMetadata?: AiAssessmentMetadata;
}): RiskAssessment {
  const [primarySignal] = input.signals;
  const createdAt = new Date().toISOString();
  const assessmentResult = selectAssessmentResult(primarySignal.category, input.recommendedState);
  const scoreDelta = primarySignal.category === "positive" ? 10 : scoreDeltaForSeverity(primarySignal.severity);

  return {
    assessmentId: keccak256(stringToHex([input.identityId, primarySignal.signalId, createdAt].join(":"))),
    signalIds: input.signals.map((signal) => signal.signalId),
    identityId: input.identityId,
    engineType: input.engineType ?? "rule",
    engineVersion: input.engineVersion ?? "state-engine-v2",
    assessmentResult,
    scoreDelta,
    recommendedState: input.recommendedState,
    recommendedActions: recommendedActionsFor(primarySignal.category, input.recommendedState),
    reasonCode: primarySignal.reasonCode,
    explanationRef: input.explanationRef ?? primarySignal.evidenceRef,
    createdAt,
    aiMetadata: input.aiMetadata,
  };
}

function scoreDeltaForSeverity(severity: RiskSignal["severity"]) {
  switch (severity) {
    case "critical":
      return -100;
    case "high":
      return -60;
    case "medium":
      return -30;
    case "low":
      return -10;
    case "positive":
      return 10;
  }
}

function selectAssessmentResult(category: RiskSignal["category"], state: IdentityState): AssessmentResult {
  if (category === "positive") {
    return "recover";
  }
  switch (state) {
    case IdentityState.OBSERVED:
      return "observe";
    case IdentityState.RESTRICTED:
      return "restrict";
    case IdentityState.HIGH_RISK:
      return "review_required";
    case IdentityState.FROZEN:
      return "freeze";
    default:
      return "allow";
  }
}

function recommendedActionsFor(category: RiskSignal["category"], state: IdentityState) {
  if (category === "positive") {
    return ["review_consequence_relief", "record_positive_history"];
  }

  switch (state) {
    case IdentityState.OBSERVED:
      return ["warn", "increase_monitoring"];
    case IdentityState.RESTRICTED:
      return ["limit_actions", "require_cooldown"];
    case IdentityState.HIGH_RISK:
      return ["review_required", "block_sensitive_actions"];
    case IdentityState.FROZEN:
      return ["full_freeze", "governance_review"];
    default:
      return ["allow"];
  }
}
