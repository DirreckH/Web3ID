import { type Hex } from "viem";
import { type SubIdentity } from "../../identity/src/index.js";
import { type StateTransitionDecision } from "./decision.js";

export enum PropagationLevel {
  LOCAL_ONLY = "LOCAL_ONLY",
  SAME_SCOPE_CLASS = "SAME_SCOPE_CLASS",
  ROOT_ESCALATION = "ROOT_ESCALATION",
  GLOBAL_LOCKDOWN = "GLOBAL_LOCKDOWN",
}

export type PropagationDecision = {
  sourceIdentityId: Hex;
  sourceDecisionId: string;
  level: PropagationLevel;
  impactedIdentityIds: Hex[];
  reason: string;
};

export function defaultPropagationLevel(
  decision: Pick<StateTransitionDecision, "triggerType" | "signalSeverity" | "actorType">,
): PropagationLevel {
  switch (decision.triggerType) {
    case "SANCTION_HIT":
      return PropagationLevel.ROOT_ESCALATION;
    case "ISSUER_DOWNGRADE":
      return PropagationLevel.SAME_SCOPE_CLASS;
    case "MANUAL_REVIEW_RESULT":
      return decision.signalSeverity === "critical" ? PropagationLevel.ROOT_ESCALATION : PropagationLevel.LOCAL_ONLY;
    case "GOVERNANCE_ACTION":
      return PropagationLevel.ROOT_ESCALATION;
    default:
      return PropagationLevel.LOCAL_ONLY;
  }
}

export function evaluatePropagation(
  decision: StateTransitionDecision,
  subjectIdentity: Pick<SubIdentity, "identityId" | "rootIdentityId" | "scope" | "permissions">,
  identityGraph: ReadonlyArray<Pick<SubIdentity, "identityId" | "rootIdentityId" | "scope">>,
  level = decision.recommendedPropagationLevel,
): PropagationDecision {
  let impactedIdentityIds: Hex[] = [subjectIdentity.identityId];
  let reason = "Risk stays local to the subject identity.";

  if (level === PropagationLevel.SAME_SCOPE_CLASS) {
    impactedIdentityIds = identityGraph
      .filter((identity) => identity.scope === subjectIdentity.scope)
      .map((identity) => identity.identityId);
    reason = "Propagation is limited to identities in the same scope class.";
  }

  if (level === PropagationLevel.ROOT_ESCALATION) {
    impactedIdentityIds = identityGraph
      .filter((identity) => identity.rootIdentityId === subjectIdentity.rootIdentityId)
      .map((identity) => identity.identityId);
    reason = "Propagation escalates across the shared root identity.";
  }

  if (level === PropagationLevel.GLOBAL_LOCKDOWN) {
    if (decision.actorType !== "governance") {
      return {
        sourceIdentityId: subjectIdentity.identityId,
        sourceDecisionId: decision.decisionId,
        level: PropagationLevel.ROOT_ESCALATION,
        impactedIdentityIds: identityGraph
          .filter((identity) => identity.rootIdentityId === subjectIdentity.rootIdentityId)
          .map((identity) => identity.identityId),
        reason: "Global lockdown requires an explicit governance override; default governance signals escalate to the root only.",
      };
    }

    if (!subjectIdentity.permissions.canEscalateToRoot) {
      return {
        sourceIdentityId: subjectIdentity.identityId,
        sourceDecisionId: decision.decisionId,
        level: PropagationLevel.LOCAL_ONLY,
        impactedIdentityIds: [subjectIdentity.identityId],
        reason: "Global lockdown is governance-only; this identity falls back to local isolation.",
      };
    }

    impactedIdentityIds = identityGraph.map((identity) => identity.identityId);
    reason = "Global lockdown is reserved for governance-only emergencies.";
  }

  return {
    sourceIdentityId: subjectIdentity.identityId,
    sourceDecisionId: decision.decisionId,
    level,
    impactedIdentityIds,
    reason,
  };
}
