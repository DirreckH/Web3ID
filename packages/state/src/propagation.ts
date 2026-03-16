import { type Hex } from "viem";
import { type SubIdentity } from "../../identity/src/index.js";
import { type RiskSignal } from "./signal.js";

export enum PropagationLevel {
  LOCAL_ONLY = "LOCAL_ONLY",
  SAME_SCOPE_CLASS = "SAME_SCOPE_CLASS",
  ROOT_ESCALATION = "ROOT_ESCALATION",
  GLOBAL_LOCKDOWN = "GLOBAL_LOCKDOWN",
}

export type PropagationDecision = {
  sourceIdentityId: Hex;
  level: PropagationLevel;
  impactedIdentityIds: Hex[];
  reason: string;
};

export function defaultPropagationLevel(signal: RiskSignal): PropagationLevel {
  switch (signal.signalType) {
    case "SANCTION_HIT":
      return PropagationLevel.ROOT_ESCALATION;
    case "ISSUER_DOWNGRADE":
      return PropagationLevel.SAME_SCOPE_CLASS;
    case "MANUAL_REVIEW_RESULT":
      return signal.severity === "critical" ? PropagationLevel.ROOT_ESCALATION : PropagationLevel.LOCAL_ONLY;
    case "GOVERNANCE_ACTION":
      return signal.severity === "critical" ? PropagationLevel.GLOBAL_LOCKDOWN : PropagationLevel.ROOT_ESCALATION;
    default:
      return PropagationLevel.LOCAL_ONLY;
  }
}

export function evaluatePropagation(
  signal: RiskSignal,
  subjectIdentity: Pick<SubIdentity, "identityId" | "rootIdentityId" | "scope" | "permissions">,
  identityGraph: Array<Pick<SubIdentity, "identityId" | "rootIdentityId" | "scope">>,
  level = defaultPropagationLevel(signal),
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
    if (!subjectIdentity.permissions.canEscalateToRoot) {
      return {
        sourceIdentityId: subjectIdentity.identityId,
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
    level,
    impactedIdentityIds,
    reason,
  };
}
