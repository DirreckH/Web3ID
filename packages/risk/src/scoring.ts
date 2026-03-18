import { type Hex } from "viem";
import { getRuleDefinition, getRuleSnapshot, getRuleVersion } from "./registry.js";
import type { BehaviorEvent, ScoreBreakdown, ScoreContribution } from "./types.js";

function daysBetween(earlier: string, later: string) {
  return Math.max(0, (Date.parse(later) - Date.parse(earlier)) / (24 * 60 * 60 * 1000));
}

function decayFactorForEvent(event: BehaviorEvent, now: string) {
  const rules = getRuleSnapshot();
  const rule = getRuleDefinition(event.kind);
  const ageDays = daysBetween(event.blockTimestamp, now);
  if (rule.riskDelta > 0 && !rule.sticky) {
    if (ageDays <= rules.negativeDecay.startDays) {
      return 1;
    }
    const periods = Math.floor((ageDays - rules.negativeDecay.startDays) / rules.negativeDecay.everyDays) + 1;
    return Math.max(0.1, 1 - periods * (rules.negativeDecay.percent / 100));
  }

  if (rule.reputationDelta > 0) {
    if (ageDays > rules.positiveDecay.windowDays) {
      return 0;
    }
    const periods = Math.floor(ageDays / rules.positiveDecay.everyDays);
    return Math.max(0.25, 1 - periods * (rules.positiveDecay.percent / 100));
  }

  return 1;
}

export function buildScoreContribution(event: BehaviorEvent, now = new Date().toISOString()): ScoreContribution {
  const ruleId = event.kind;
  const rule = getRuleDefinition(ruleId);
  const decayFactor = decayFactorForEvent(event, now);
  const effectiveRiskDelta = Math.round(rule.riskDelta * decayFactor);
  const effectiveReputationDelta = Math.round(rule.reputationDelta * decayFactor);
  const effectiveConfidenceDelta = Math.round(rule.confidenceDelta * Math.max(decayFactor, 0.5));

  return {
    ruleId,
    behaviorEventId: event.eventId,
    riskDelta: rule.riskDelta,
    reputationDelta: rule.reputationDelta,
    confidenceDelta: rule.confidenceDelta,
    decayFactor,
    effectiveRiskDelta,
    effectiveReputationDelta,
    effectiveConfidenceDelta,
    reason: `${event.label} matched ${rule.ruleFamily}`,
  };
}

export function buildScoreBreakdown(input: {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  events: BehaviorEvent[];
  now?: string;
}): ScoreBreakdown {
  const now = input.now ?? new Date().toISOString();
  const contributions = input.events.map((event) => buildScoreContribution(event, now));
  const riskScore = Math.max(0, contributions.reduce((sum, item) => sum + item.effectiveRiskDelta, 0));
  const reputationScore = Math.max(0, contributions.reduce((sum, item) => sum + item.effectiveReputationDelta, 0));
  const confidenceScore = Math.max(0, contributions.reduce((sum, item) => sum + item.effectiveConfidenceDelta, 0));
  const finalInternalScore = Math.max(0, Math.min(100, riskScore - Math.floor(reputationScore / 2) + Math.floor(confidenceScore / 10)));

  return {
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    registryVersion: getRuleSnapshot().version,
    scoringVersion: getRuleVersion(),
    evaluatedAt: now,
    riskScore,
    reputationScore,
    confidenceScore,
    finalInternalScore,
    positiveSignalCount: contributions.filter((item) => item.effectiveReputationDelta > 0).length,
    negativeSignalCount: contributions.filter((item) => item.effectiveRiskDelta > 0).length,
    contributionCount: contributions.length,
    contributions,
  };
}
