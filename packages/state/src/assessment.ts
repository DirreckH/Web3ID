import { keccak256, stringToHex, type Hex } from "viem";
import { assertExplanationBlock, createExplanationBlock, type ExplanationBlock } from "./explanation.js";
import { IdentityState } from "./state.js";
import { type RiskSignal } from "./signal.js";

export type AssessmentEngineType = "rule" | "manual" | "ai";
export type AssessmentResult = "allow" | "observe" | "restrict" | "review_required" | "freeze" | "recover";

export type AiAssessmentMetadata = {
  provider: string;
  model: string;
  modelVersion: string;
  promptVersion: string;
  inputHash: Hex;
  evidenceRefs: string[];
  outputSummary: string;
  confidence: number;
  recommendedAction: "watch" | "review" | "warn_only";
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
  explanation: ExplanationBlock;
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
  if (input.engineType === "ai" && !input.aiMetadata) {
    throw new Error("AI assessments require aiMetadata and must remain reviewable.");
  }
  const createdAt = new Date().toISOString();
  const assessmentResult = selectAssessmentResult(primarySignal.category, input.recommendedState);
  const scoreDelta = primarySignal.category === "positive" ? 10 : scoreDeltaForSeverity(primarySignal.severity);
  const assessmentId = keccak256(stringToHex([input.identityId, primarySignal.signalId, createdAt].join(":")));
  const explanation = assertExplanationBlock(
    createExplanationBlock({
      reasonCode: primarySignal.reasonCode,
      explanationSummary: primarySignal.explanation,
      evidenceRefs: [primarySignal.evidenceRef],
      sourceAssessmentId: assessmentId,
      sourcePolicyVersion: primarySignal.policyVersion,
      sourceRegistryVersion:
        "registryVersion" in primarySignal && typeof primarySignal.registryVersion === "number"
          ? primarySignal.registryVersion
          : null,
      actorType: input.engineType === "ai" ? "ai" : input.engineType === "manual" ? "manual" : "rule_engine",
      actorId: input.engineType === "ai" ? input.aiMetadata?.provider ?? primarySignal.actor : primarySignal.actor,
      aiContribution: input.engineType === "ai",
      manualOverride: input.engineType === "manual" || primarySignal.sourceType === "manual",
    }),
    { requireEvidenceRefs: true, requireSourcePolicyVersion: true },
  );

  return {
    assessmentId,
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
    explanation,
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
