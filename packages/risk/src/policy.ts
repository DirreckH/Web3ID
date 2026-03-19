import { IdentityState } from "../../state/src/index.js";
import { getPolicyRuleSnapshot } from "./registry.js";
import { buildPolicyDecisionExplanation } from "./explanation.js";
import type { PolicyDecision, RiskSummary } from "./types.js";

export function evaluateAccessRisk(input: { policyLabel: string; summary: RiskSummary; policyVersion: number }): PolicyDecision {
  const policyCatalog = getPolicyRuleSnapshot().accessPolicies;
  const policy = policyCatalog[input.policyLabel as keyof typeof policyCatalog];
  const stateName = IdentityState[input.summary.effectiveState] as keyof typeof IdentityState;

  if (!policy) {
    return {
      decision: "deny",
      state: input.summary.effectiveState,
      reasons: [`Unknown access policy: ${input.policyLabel}.`],
      warnings: [],
      evidenceRefs: input.summary.evidenceRefs,
      policyVersion: input.policyVersion,
      policyReasons: [{ code: "UNKNOWN_POLICY", message: `Unknown access policy ${input.policyLabel}.` }],
      explanation: buildPolicyDecisionExplanation({
        decision: "deny",
        state: input.summary.effectiveState,
        reasons: [`Unknown access policy: ${input.policyLabel}.`],
        warnings: [],
        evidenceRefs: input.summary.evidenceRefs,
        policyVersion: input.policyVersion,
        policyLabel: input.policyLabel,
      }),
    };
  }

  if ((policy.denyStates as string[]).includes(stateName)) {
    return {
      decision: "deny",
      state: input.summary.effectiveState,
      reasons: [`Risk state ${stateName} is denied by ${input.policyLabel}.`],
      warnings: input.summary.warnings,
      evidenceRefs: input.summary.evidenceRefs,
      policyVersion: input.policyVersion,
      riskReasons: [{ code: "RISK_DENY", message: `Effective state ${stateName} is outside the allowed range.` }],
      explanation: buildPolicyDecisionExplanation({
        decision: "deny",
        state: input.summary.effectiveState,
        reasons: [`Risk state ${stateName} is denied by ${input.policyLabel}.`],
        warnings: input.summary.warnings,
        evidenceRefs: input.summary.evidenceRefs,
        policyVersion: input.policyVersion,
        policyLabel: input.policyLabel,
      }),
    };
  }

  if ((policy.restrictStates as string[]).includes(stateName)) {
    return {
      decision: "restrict",
      state: input.summary.effectiveState,
      reasons: [`Risk state ${stateName} is restricted by ${input.policyLabel}.`],
      warnings: input.summary.warnings,
      evidenceRefs: input.summary.evidenceRefs,
      policyVersion: input.policyVersion,
      riskReasons: [{ code: "RISK_RESTRICT", message: `Effective state ${stateName} requires restricted handling.` }],
      explanation: buildPolicyDecisionExplanation({
        decision: "restrict",
        state: input.summary.effectiveState,
        reasons: [`Risk state ${stateName} is restricted by ${input.policyLabel}.`],
        warnings: input.summary.warnings,
        evidenceRefs: input.summary.evidenceRefs,
        policyVersion: input.policyVersion,
        policyLabel: input.policyLabel,
      }),
    };
  }

  return {
    decision: "allow",
    state: input.summary.effectiveState,
    reasons: [`Risk state ${stateName} is acceptable for ${input.policyLabel}.`],
    warnings: input.summary.warnings,
    evidenceRefs: input.summary.evidenceRefs,
    policyVersion: input.policyVersion,
    riskReasons: [{ code: "RISK_ALLOW", message: `Effective state ${stateName} is acceptable.` }],
    explanation: buildPolicyDecisionExplanation({
      decision: "allow",
      state: input.summary.effectiveState,
      reasons: [`Risk state ${stateName} is acceptable for ${input.policyLabel}.`],
      warnings: input.summary.warnings,
      evidenceRefs: input.summary.evidenceRefs,
      policyVersion: input.policyVersion,
      policyLabel: input.policyLabel,
    }),
  };
}

export function evaluateWarningRisk(input: {
  policyId: string;
  summary: RiskSummary;
  policyVersion: number;
}): PolicyDecision {
  const warningPolicies = getPolicyRuleSnapshot().warningPolicies;
  const policy = warningPolicies[input.policyId as keyof typeof warningPolicies];
  const stateName = IdentityState[input.summary.effectiveState] as keyof typeof IdentityState;
  if (!policy) {
    return {
      decision: "info",
      state: input.summary.effectiveState,
      reasons: [`Unknown warning policy: ${input.policyId}.`],
      warnings: input.summary.warnings,
      evidenceRefs: input.summary.evidenceRefs,
      policyVersion: input.policyVersion,
      policyReasons: [{ code: "UNKNOWN_WARNING_POLICY", message: `Unknown warning policy ${input.policyId}.` }],
      explanation: buildPolicyDecisionExplanation({
        decision: "info",
        state: input.summary.effectiveState,
        reasons: [`Unknown warning policy: ${input.policyId}.`],
        warnings: input.summary.warnings,
        evidenceRefs: input.summary.evidenceRefs,
        policyVersion: input.policyVersion,
        policyLabel: input.policyId,
      }),
    };
  }
  if ((policy.highWarnStates as string[]).includes(stateName)) {
    return {
      decision: "high_warn",
      state: input.summary.effectiveState,
      reasons: [`Counterparty effective state ${stateName} requires a high warning.`],
      warnings: [...input.summary.warnings, `High warning for ${stateName}.`],
      evidenceRefs: input.summary.evidenceRefs,
      policyVersion: input.policyVersion,
      riskReasons: [{ code: "HIGH_WARN", message: `Effective state ${stateName} should produce a high warning.` }],
      explanation: buildPolicyDecisionExplanation({
        decision: "high_warn",
        state: input.summary.effectiveState,
        reasons: [`Counterparty effective state ${stateName} requires a high warning.`],
        warnings: [...input.summary.warnings, `High warning for ${stateName}.`],
        evidenceRefs: input.summary.evidenceRefs,
        policyVersion: input.policyVersion,
        policyLabel: input.policyId,
      }),
    };
  }
  if ((policy.warnStates as string[]).includes(stateName)) {
    return {
      decision: "warn",
      state: input.summary.effectiveState,
      reasons: [`Counterparty effective state ${stateName} requires a warning.`],
      warnings: [...input.summary.warnings, `Warning for ${stateName}.`],
      evidenceRefs: input.summary.evidenceRefs,
      policyVersion: input.policyVersion,
      riskReasons: [{ code: "WARN", message: `Effective state ${stateName} should produce a warning.` }],
      explanation: buildPolicyDecisionExplanation({
        decision: "warn",
        state: input.summary.effectiveState,
        reasons: [`Counterparty effective state ${stateName} requires a warning.`],
        warnings: [...input.summary.warnings, `Warning for ${stateName}.`],
        evidenceRefs: input.summary.evidenceRefs,
        policyVersion: input.policyVersion,
        policyLabel: input.policyId,
      }),
    };
  }
  return {
    decision: "info",
    state: input.summary.effectiveState,
    reasons: ["Counterparty is in good standing."],
    warnings: input.summary.warnings,
    evidenceRefs: input.summary.evidenceRefs,
    policyVersion: input.policyVersion,
    riskReasons: [{ code: "INFO", message: "No blocking or warning conditions were found." }],
    explanation: buildPolicyDecisionExplanation({
      decision: "info",
      state: input.summary.effectiveState,
      reasons: ["Counterparty is in good standing."],
      warnings: input.summary.warnings,
      evidenceRefs: input.summary.evidenceRefs,
      policyVersion: input.policyVersion,
      policyLabel: input.policyId,
    }),
  };
}
