import {
  assertExplanationBlock,
  createExplanationBlock,
} from "../../state/src/index.js";
import type { AuditExportBundle, AuditExportConsistency, ExplanationChainEntry } from "./types.js";
import { unavailableExplanationForMissingChain } from "./explanation.js";

function signalChainEntries(bundle: AuditExportBundle): ExplanationChainEntry[] {
  return bundle.signals.map((signal) => ({
    objectKind: "signal",
    objectId: signal.signalId,
    identityId: signal.identityId,
    explanation: createExplanationBlock({
      reasonCode: signal.reasonCode,
      explanationSummary: signal.explanation,
      evidenceRefs: signal.evidenceRefs?.length ? signal.evidenceRefs : [signal.evidenceRef],
      sourcePolicyVersion: signal.policyVersion,
      sourceRegistryVersion: "registryVersion" in signal && typeof signal.registryVersion === "number" ? signal.registryVersion : null,
      actorType: signal.sourceType,
      actorId: signal.actor,
      aiContribution: signal.sourceType === "ai",
      manualOverride: signal.sourceType === "manual" || signal.sourceType === "governance",
    }),
    linkedTo: [],
  }));
}

function appendObjectEntries(entries: ExplanationChainEntry[], bundle: AuditExportBundle) {
  entries.push(
    ...bundle.assessments.map((assessment) => ({
      objectKind: "assessment" as const,
      objectId: assessment.assessmentId,
      identityId: assessment.identityId,
      explanation: assessment.explanation,
      linkedTo: assessment.signalIds,
    })),
    ...bundle.decisions.map((decision) => ({
      objectKind: "decision" as const,
      objectId: decision.decisionId,
      identityId: decision.identityId,
      explanation: decision.explanation,
      linkedTo: [decision.assessmentId],
    })),
    ...bundle.consequences.map((consequence) => ({
      objectKind: "consequence" as const,
      objectId: consequence.consequenceId,
      identityId: consequence.identityId,
      explanation: consequence.explanation,
      linkedTo: consequence.sourceDecisionId ? [consequence.sourceDecisionId] : [],
    })),
    ...bundle.policyDecisions.map((decision) => ({
      objectKind: "policy_decision" as const,
      objectId: decision.decisionId,
      identityId: decision.identityId,
      explanation: decision.explanation,
      linkedTo: decision.explanation.sourceDecisionId ? [decision.explanation.sourceDecisionId] : [],
    })),
    ...bundle.reviewQueue.map((item) => ({
      objectKind: "ai_review" as const,
      objectId: item.reviewItemId,
      identityId: item.identityId,
      explanation: item.explanation,
      linkedTo: [item.sourceSuggestionId],
    })),
    ...bundle.propagation.map((item) => ({
      objectKind: "propagation" as const,
      objectId: `${item.identityId}:propagation`,
      identityId: item.identityId,
      explanation: item.summary?.explanation ?? unavailableExplanationForMissingChain("PROPAGATION_UNAVAILABLE", "Propagation summary is unavailable."),
      linkedTo: item.summary?.explanation.sourceDecisionId ? [item.summary.explanation.sourceDecisionId] : [],
    })),
    ...bundle.reentryRecovery.map((item) => ({
      objectKind: "recovery" as const,
      objectId: `${item.identityId}:recovery`,
      identityId: item.identityId,
      explanation: item.recoveryProgress?.explanation ?? unavailableExplanationForMissingChain("RECOVERY_UNAVAILABLE", "Recovery summary is unavailable."),
      linkedTo: item.recoveryProgress?.explanation.sourceDecisionId ? [item.recoveryProgress.explanation.sourceDecisionId] : [],
    })),
  );
}

export function buildExplanationChain(bundle: AuditExportBundle): ExplanationChainEntry[] {
  const entries = signalChainEntries(bundle);
  appendObjectEntries(entries, bundle);
  return entries.map((entry) => ({
    ...entry,
    explanation: assertExplanationBlock(entry.explanation),
  }));
}

export function buildAuditExportConsistency(bundle: AuditExportBundle): AuditExportConsistency {
  const missingSegments: string[] = [];
  const unavailableSegments: string[] = [];

  if (bundle.signals.length === 0) {
    unavailableSegments.push("signals");
  }
  if (bundle.assessments.length === 0) {
    unavailableSegments.push("assessments");
  }
  if (bundle.decisions.length === 0) {
    unavailableSegments.push("decisions");
  }
  if (bundle.consequences.some((item) => !item.sourceDecisionId)) {
    missingSegments.push("consequence.sourceDecisionId");
  }
  if (bundle.policyDecisions.some((item) => item.explanation.sourcePolicyVersion === null)) {
    missingSegments.push("policy_decision.sourcePolicyVersion");
  }
  if (bundle.policyDecisions.some((item) => item.evidenceRefs.length === 0)) {
    missingSegments.push("policy_decision.evidenceRefs");
  }
  if (bundle.decisions.some((item) => !item.explanation.explanationSummary)) {
    missingSegments.push("decision.explanation");
  }
  if (bundle.consequences.some((item) => !item.explanation.explanationSummary)) {
    missingSegments.push("consequence.explanation");
  }

  return {
    complete: missingSegments.length === 0,
    missingSegments,
    unavailableSegments,
  };
}

export function assertAuditExportConsistency(bundle: AuditExportBundle) {
  const consistency = buildAuditExportConsistency(bundle);
  if (!consistency.complete) {
    throw new Error(`Audit export consistency failed: ${consistency.missingSegments.join(", ")}`);
  }
  return consistency;
}

export function normalizeAuditExportBundle(bundle: Omit<AuditExportBundle, "explanationChain" | "consistency">): AuditExportBundle {
  const normalized: AuditExportBundle = {
    ...bundle,
    explanationChain: [],
    consistency: {
      complete: true,
      missingSegments: [] as string[],
      unavailableSegments: [] as string[],
    },
  };
  normalized.explanationChain = buildExplanationChain(normalized);
  normalized.consistency = buildAuditExportConsistency(normalized);
  return normalized;
}
