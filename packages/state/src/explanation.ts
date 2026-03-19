export type ExplanationStatus = "available" | "unavailable" | "not_applicable";

export type ExplanationBlock = {
  status: ExplanationStatus;
  reasonCode: string;
  explanationSummary: string;
  evidenceRefs: string[];
  sourceAssessmentId: string | null;
  sourceDecisionId: string | null;
  sourcePolicyVersion: number | null;
  sourceRegistryVersion: number | null;
  actorType: string | null;
  actorId: string | null;
  aiContribution: boolean;
  manualOverride: boolean;
  unavailableReason?: string | null;
};

export type ExplanationBlockInput = Partial<ExplanationBlock> & {
  reasonCode: string;
  explanationSummary: string;
};

export type ExplanationGuardOptions = {
  requireEvidenceRefs?: boolean;
  requireSourceDecisionId?: boolean;
  requireSourcePolicyVersion?: boolean;
};

export function createExplanationBlock(input: ExplanationBlockInput): ExplanationBlock {
  return {
    status: input.status ?? "available",
    reasonCode: input.reasonCode,
    explanationSummary: input.explanationSummary,
    evidenceRefs: [...new Set(input.evidenceRefs ?? [])],
    sourceAssessmentId: input.sourceAssessmentId ?? null,
    sourceDecisionId: input.sourceDecisionId ?? null,
    sourcePolicyVersion: input.sourcePolicyVersion ?? null,
    sourceRegistryVersion: input.sourceRegistryVersion ?? null,
    actorType: input.actorType ?? null,
    actorId: input.actorId ?? null,
    aiContribution: input.aiContribution ?? false,
    manualOverride: input.manualOverride ?? false,
    unavailableReason: input.unavailableReason ?? null,
  };
}

export function createUnavailableExplanation(reasonCode: string, explanationSummary: string, unavailableReason: string): ExplanationBlock {
  return createExplanationBlock({
    status: "unavailable",
    reasonCode,
    explanationSummary,
    unavailableReason,
  });
}

export function createNotApplicableExplanation(reasonCode: string, explanationSummary: string): ExplanationBlock {
  return createExplanationBlock({
    status: "not_applicable",
    reasonCode,
    explanationSummary,
  });
}

export function assertExplanationBlock(block: ExplanationBlock, options: ExplanationGuardOptions = {}) {
  if (!block.reasonCode.trim()) {
    throw new Error("Explanation block is missing reasonCode.");
  }
  if (!block.explanationSummary.trim()) {
    throw new Error(`Explanation block ${block.reasonCode} is missing explanationSummary.`);
  }
  if (block.status === "available") {
    if (options.requireEvidenceRefs && block.evidenceRefs.length === 0) {
      throw new Error(`Explanation block ${block.reasonCode} is missing evidenceRefs.`);
    }
    if (options.requireSourceDecisionId && !block.sourceDecisionId) {
      throw new Error(`Explanation block ${block.reasonCode} is missing sourceDecisionId.`);
    }
    if (options.requireSourcePolicyVersion && block.sourcePolicyVersion === null) {
      throw new Error(`Explanation block ${block.reasonCode} is missing sourcePolicyVersion.`);
    }
  }
  return block;
}

export function summarizeExplanation(block: ExplanationBlock) {
  const origin = [block.actorType, block.actorId].filter(Boolean).join(":");
  return [
    block.explanationSummary,
    block.reasonCode ? `reason=${block.reasonCode}` : null,
    block.sourceDecisionId ? `decision=${block.sourceDecisionId}` : null,
    block.sourceAssessmentId ? `assessment=${block.sourceAssessmentId}` : null,
    origin ? `actor=${origin}` : null,
  ].filter(Boolean).join(" | ");
}
