import {
  IdentityState,
  assertExplanationBlock,
  createExplanationBlock,
  createNotApplicableExplanation,
  createUnavailableExplanation,
  type ExplanationBlock,
} from "../../state/src/index.js";
import type {
  AiSuggestion,
  PolicyDecision,
  PolicyDecisionRecord,
  PropagationSummary,
  RecoveryProgressSummary,
  ReviewQueueItem,
  RiskListHistoryItem,
  RiskSummary,
} from "./types.js";

export function buildRiskSummaryText(summary: RiskSummary) {
  return [
    `Stored state: ${IdentityState[summary.storedState]}`,
    `Effective state: ${IdentityState[summary.effectiveState]}`,
    `Risk score: ${summary.riskScore}`,
    `Reputation score: ${summary.reputationScore}`,
    `Reasons: ${summary.reasonCodes.join(", ") || "none"}`,
  ].join(" | ");
}

export function buildPolicyDecisionText(decision: PolicyDecision) {
  return `${decision.decision.toUpperCase()}: ${decision.reasons.join(" ")}`;
}

export function buildRiskSummaryExplanation(input: {
  summary: Pick<RiskSummary, "storedState" | "effectiveState" | "reasonCodes" | "evidenceRefs">;
  sourceAssessmentId?: string | null;
  sourceDecisionId?: string | null;
  sourcePolicyVersion?: number | null;
  sourceRegistryVersion?: number | null;
  actorType?: string | null;
  actorId?: string | null;
  aiContribution?: boolean;
  manualOverride?: boolean;
}): ExplanationBlock {
  return assertExplanationBlock(
    createExplanationBlock({
      reasonCode: input.summary.reasonCodes[0] ?? "STATE_SUMMARY",
      explanationSummary: `Stored state is ${IdentityState[input.summary.storedState]}, effective state is ${IdentityState[input.summary.effectiveState]}. Reasons: ${input.summary.reasonCodes.join(", ") || "none"}.`,
      evidenceRefs: input.summary.evidenceRefs,
      sourceAssessmentId: input.sourceAssessmentId ?? null,
      sourceDecisionId: input.sourceDecisionId ?? null,
      sourcePolicyVersion: input.sourcePolicyVersion ?? null,
      sourceRegistryVersion: input.sourceRegistryVersion ?? null,
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? "risk-summary",
      aiContribution: input.aiContribution ?? false,
      manualOverride: input.manualOverride ?? false,
    }),
    { requireEvidenceRefs: true },
  );
}

export function buildPropagationExplanation(input: {
  reasonCodes: string[];
  warnings: string[];
  evidenceRefs: string[];
  sourceDecisionId?: string | null;
  sourcePolicyVersion?: number | null;
  sourceRegistryVersion?: number | null;
}): ExplanationBlock {
  if (input.reasonCodes.length === 0 && input.warnings.length === 0) {
    return createNotApplicableExplanation("PROPAGATION_IDLE", "No propagation overlay was required for this identity.");
  }
  return assertExplanationBlock(
    createExplanationBlock({
      reasonCode: input.reasonCodes[0] ?? "PROPAGATION_WARNING",
      explanationSummary: `Propagation evaluated with reasons ${input.reasonCodes.join(", ") || "none"} and warnings ${input.warnings.join(", ") || "none"}.`,
      evidenceRefs: input.evidenceRefs,
      sourceDecisionId: input.sourceDecisionId ?? null,
      sourcePolicyVersion: input.sourcePolicyVersion ?? null,
      sourceRegistryVersion: input.sourceRegistryVersion ?? null,
      actorType: "system",
      actorId: "propagation-engine",
    }),
    { requireEvidenceRefs: true },
  );
}

export function buildRecoveryExplanation(input: {
  releaseFloorActive: boolean;
  floorUntil: string | null;
  helpfulPositiveSignals: string[];
  evidenceRefs: string[];
  sourceDecisionId?: string | null;
}): ExplanationBlock {
  if (!input.releaseFloorActive && input.evidenceRefs.length === 0) {
    return createNotApplicableExplanation("RECOVERY_IDLE", "No recovery requirements are active for this identity.");
  }
  return assertExplanationBlock(
    createExplanationBlock({
      reasonCode: input.releaseFloorActive ? "RECOVERY_FLOOR_ACTIVE" : "RECOVERY_GUIDANCE_AVAILABLE",
      explanationSummary: input.releaseFloorActive
        ? `Recovery floor remains active until ${input.floorUntil}.`
        : `Recovery can use positive signals: ${input.helpfulPositiveSignals.join(", ")}.`,
      evidenceRefs: input.evidenceRefs,
      sourceDecisionId: input.sourceDecisionId ?? null,
      actorType: "system",
      actorId: "recovery-engine",
    }),
    { requireEvidenceRefs: true },
  );
}

export function buildPolicyDecisionExplanation(input: {
  decision: PolicyDecision["decision"];
  state: PolicyDecision["state"];
  reasons: string[];
  warnings: string[];
  evidenceRefs: string[];
  policyVersion: number;
  policyLabel: string;
  sourceAssessmentId?: string | null;
  sourceDecisionId?: string | null;
  sourceRegistryVersion?: number | null;
  modePath?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  aiContribution?: boolean;
  manualOverride?: boolean;
}): ExplanationBlock {
  return assertExplanationBlock(
    createExplanationBlock({
      reasonCode: input.reasons[0] ?? `${input.policyLabel}_DECISION`,
      explanationSummary: `${input.policyLabel} produced ${String(input.decision).toUpperCase()} while state remained ${IdentityState[input.state]}. ${input.reasons.join(" ")}`.trim(),
      evidenceRefs: input.evidenceRefs,
      sourceAssessmentId: input.sourceAssessmentId ?? null,
      sourceDecisionId: input.sourceDecisionId ?? null,
      sourcePolicyVersion: input.policyVersion,
      sourceRegistryVersion: input.sourceRegistryVersion ?? null,
      actorType: input.actorType ?? "policy_engine",
      actorId: input.actorId ?? input.modePath ?? input.policyLabel,
      aiContribution: input.aiContribution ?? false,
      manualOverride: input.manualOverride ?? false,
    }),
    { requireEvidenceRefs: true, requireSourcePolicyVersion: true },
  );
}

export function buildAiSuggestionExplanation(input: {
  summary: string;
  evidenceRefs: string[];
  suggestionId: string;
  provider: string;
  recommendedAction?: string;
}): ExplanationBlock {
  return assertExplanationBlock(
    createExplanationBlock({
      reasonCode: input.recommendedAction === "review" ? "AI_REVIEW_SUGGESTION" : "AI_SUGGESTION",
      explanationSummary: `${input.summary} This is an AI suggestion and not a final decision.`,
      evidenceRefs: input.evidenceRefs,
      actorType: "ai",
      actorId: input.provider,
      aiContribution: true,
    }),
    { requireEvidenceRefs: true },
  );
}

export function buildReviewQueueExplanation(input: {
  reviewItemId: string;
  status: string;
  evidenceRefs: string[];
  sourceSuggestionId: string;
  reason?: string;
  actor?: string | null;
}): ExplanationBlock {
  return assertExplanationBlock(
    createExplanationBlock({
      reasonCode: input.status,
      explanationSummary: `AI review item ${input.reviewItemId} is ${input.status}. ${input.reason ?? "Human review is required before any state write."}`.trim(),
      evidenceRefs: input.evidenceRefs,
      actorType: input.actor ? "manual" : "ai",
      actorId: input.actor ?? input.sourceSuggestionId,
      aiContribution: true,
      manualOverride: Boolean(input.actor),
    }),
    { requireEvidenceRefs: true },
  );
}

export function buildRiskListHistoryExplanation(input: {
  reasonCode: string;
  action: string;
  listName: string;
  evidenceRefs: string[];
  sourceDecisionId?: string | null;
  actor: string;
}): ExplanationBlock {
  return assertExplanationBlock(
    createExplanationBlock({
      reasonCode: input.reasonCode,
      explanationSummary: `Risk list ${input.listName} recorded action ${input.action}.`,
      evidenceRefs: input.evidenceRefs,
      sourceDecisionId: input.sourceDecisionId ?? null,
      actorType: "system",
      actorId: input.actor,
      manualOverride: input.actor !== "risk-engine" && input.actor !== "ai-assistant",
    }),
    { requireEvidenceRefs: true },
  );
}

export function assertRiskContextExplainability<T extends {
  summary?: RiskSummary | null;
  policyDecisions?: PolicyDecisionRecord[];
  aiSuggestions?: AiSuggestion[];
  reviewQueue?: ReviewQueueItem[];
  listHistory?: RiskListHistoryItem[];
}>(context: T): T {
  if (context.summary) {
    assertExplanationBlock(context.summary.explanation, { requireEvidenceRefs: true });
    if (context.summary.propagation) {
      assertExplanationBlock(context.summary.propagation.explanation);
    }
    if (context.summary.recoveryProgress) {
      assertExplanationBlock(context.summary.recoveryProgress.explanation);
    }
  }

  for (const decision of context.policyDecisions ?? []) {
    assertExplanationBlock(decision.explanation, {
      requireEvidenceRefs: true,
      requireSourcePolicyVersion: true,
    });
  }
  for (const suggestion of context.aiSuggestions ?? []) {
    assertExplanationBlock(suggestion.explanation, { requireEvidenceRefs: true });
  }
  for (const item of context.reviewQueue ?? []) {
    assertExplanationBlock(item.explanation, { requireEvidenceRefs: true });
  }
  for (const item of context.listHistory ?? []) {
    assertExplanationBlock(item.explanation, { requireEvidenceRefs: true });
  }
  return context;
}

export function ensurePolicyDecisionExplanation(decision: PolicyDecision, policyLabel: string, modePath?: string | null) {
  return decision.explanation ?? buildPolicyDecisionExplanation({
    decision: decision.decision,
    state: decision.state,
    reasons: decision.reasons,
    warnings: decision.warnings,
    evidenceRefs: decision.evidenceRefs,
    policyVersion: decision.policyVersion,
    policyLabel,
    modePath,
  });
}

export function unavailableExplanationForMissingChain(reasonCode: string, summary: string) {
  return createUnavailableExplanation(reasonCode, summary, `${reasonCode.toLowerCase()} is unavailable in the current export.`);
}
