import { IdentityState } from "../../state/src/index.js";
import type { PolicyDecision, RiskSummary } from "./types.js";

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
