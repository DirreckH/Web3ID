import positiveSignalsConfig from "../config/positive-signals.json";
import { createRiskSignal, type RiskSignalInput } from "../../state/src/index.js";
import { getRegistryVersion, getRuleSnapshot } from "./registry.js";
import { buildRecoveryExplanation } from "./explanation.js";
import type {
  ManualReleaseWindow,
  PositiveSignalThresholds,
  PositiveSummary,
  RecoveryProgressSummary,
  RiskSignal,
  ScoreBreakdown,
} from "./types.js";
import { IdentityState } from "../../state/src/index.js";
import type { ConsequenceRecord } from "../../state/src/index.js";
import { getActiveConsequences } from "../../state/src/index.js";
import type { Hex } from "viem";

type PositiveSignalConfigShape = {
  version: number;
  demoDefaults: boolean;
  signals: PositiveSignalThresholds;
};

const positiveSignalSnapshot = positiveSignalsConfig as PositiveSignalConfigShape;

function daysAgo(now: string, days: number) {
  return Date.parse(now) - days * 24 * 60 * 60 * 1000;
}

function latestEvidenceRef(signals: RiskSignal[], fallback: string) {
  return signals.at(-1)?.evidenceRefs?.[0] ?? signals.at(-1)?.evidenceRef ?? fallback;
}

function createPositiveSignal(input: {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  signalType: RiskSignal["signalType"];
  reasonCode: string;
  explanation: string;
  requestedState?: IdentityState;
  observedAt: string;
  evidenceRefs: string[];
}) {
  const base = createRiskSignal({
    identityId: input.identityId,
    sourceType: "local_chain",
    sourceId: `positive:${input.reasonCode}:${input.observedAt}`,
    type: input.signalType,
    severity: "positive",
    category: "positive",
    evidenceType: "LOCAL_CHAIN_ACTIVITY",
    evidenceRef: input.evidenceRefs[0] ?? `phase3://positive/${input.reasonCode.toLowerCase()}`,
    observedAt: input.observedAt,
    ingestedAt: input.observedAt,
    actor: "positive-signal-engine",
    policyVersion: getRuleSnapshot().version,
    requestedState: input.requestedState,
    reason: input.reasonCode,
    reasonCode: input.reasonCode,
    explanation: input.explanation,
  } satisfies RiskSignalInput);

  return {
    ...base,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    registryVersion: getRegistryVersion(),
    ruleId: input.reasonCode.toLowerCase(),
    ruleFamily: "positive_signal",
    ruleWeight: 0,
    signalClass: "synthetic_reentry" as const,
    evidenceRefs: [...new Set(input.evidenceRefs)],
  } satisfies RiskSignal;
}

function noRecentNegativeSignals(signals: RiskSignal[], now: string, days: number) {
  return !signals.some(
    (signal) =>
      signal.category === "negative" &&
      Date.parse(signal.observedAt) >= daysAgo(now, days),
  );
}

function countSignals(signals: RiskSignal[], now: string, input: { type: RiskSignal["signalType"]; lookbackDays: number }) {
  return signals.filter(
    (signal) =>
      signal.signalType === input.type &&
      Date.parse(signal.observedAt) >= daysAgo(now, input.lookbackDays),
  );
}

export function getPositiveSignalThresholds() {
  return positiveSignalSnapshot;
}

export function buildConfiguredPositiveSignals(input: {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  signals: RiskSignal[];
  score: ScoreBreakdown;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const config = getPositiveSignalThresholds().signals;
  const next: RiskSignal[] = [];

  if (noRecentNegativeSignals(input.signals, now, config.no_risk_incident_days.daysWithoutIncident)) {
    next.push(
      createPositiveSignal({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        signalType: "NO_RISK_INCIDENT_DAYS",
        reasonCode: "NO_RISK_INCIDENT_DAYS",
        explanation: `No negative risk incidents were observed in the past ${config.no_risk_incident_days.daysWithoutIncident} days.`,
        observedAt: now,
        evidenceRefs: [latestEvidenceRef(input.signals, "phase3://positive/no-risk-incident-days")],
      }),
    );
  }

  if (
    noRecentNegativeSignals(input.signals, now, config.long_term_good_standing.daysWithoutIncident) &&
    input.score.reputationScore >= config.long_term_good_standing.minReputationScore
  ) {
    next.push(
      createPositiveSignal({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        signalType: "LONG_TERM_GOOD_STANDING",
        reasonCode: "LONG_TERM_GOOD_STANDING",
        explanation: `Long-term good standing was reached after ${config.long_term_good_standing.daysWithoutIncident} clean days with reputation score ${input.score.reputationScore}.`,
        observedAt: now,
        evidenceRefs: [latestEvidenceRef(input.signals, "phase3://positive/long-term-good-standing")],
      }),
    );
  }

  const governanceSignals = countSignals(input.signals, now, {
    type: "REPEATED_GOVERNANCE_PARTICIPATION",
    lookbackDays: config.repeated_governance_participation.lookbackDays,
  });
  if (governanceSignals.length >= config.repeated_governance_participation.minEvents) {
    next.push(
      createPositiveSignal({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        signalType: "REPEATED_GOVERNANCE_PARTICIPATION",
        reasonCode: "REPEATED_GOVERNANCE_PARTICIPATION",
        explanation: `Governance participation reached ${governanceSignals.length} events in the last ${config.repeated_governance_participation.lookbackDays} days.`,
        observedAt: now,
        evidenceRefs: governanceSignals.flatMap((signal) => signal.evidenceRefs),
      }),
    );
  }

  const trustedProtocolSignals = countSignals(input.signals, now, {
    type: "TRUSTED_PROTOCOL_USAGE",
    lookbackDays: config.trusted_protocol_usage.lookbackDays,
  });
  if (trustedProtocolSignals.length >= config.trusted_protocol_usage.minEvents) {
    next.push(
      createPositiveSignal({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        signalType: "TRUSTED_PROTOCOL_USAGE",
        reasonCode: "TRUSTED_PROTOCOL_USAGE",
        explanation: `Trusted protocol usage reached ${trustedProtocolSignals.length} events in the last ${config.trusted_protocol_usage.lookbackDays} days.`,
        observedAt: now,
        evidenceRefs: trustedProtocolSignals.flatMap((signal) => signal.evidenceRefs),
      }),
    );
  }

  return next;
}

export function summarizePositiveState(input: {
  signals: RiskSignal[];
  consequences: ConsequenceRecord[];
  manualReleaseWindow?: ManualReleaseWindow | null;
  now?: string;
}): PositiveSummary {
  const now = input.now ?? new Date().toISOString();
  const activeConsequences = getActiveConsequences(input.consequences, now);
  const unlocked = activeConsequences.filter((consequence) =>
    ["trust_boost", "limit_relaxation", "access_unlock", "reputation_badge"].includes(consequence.consequenceType),
  );
  const restricted = activeConsequences.filter((consequence) =>
    ["warn", "limit", "freeze", "review_required", "trust_decrease"].includes(consequence.consequenceType),
  );

  return {
    activePositiveSignals: input.signals.filter((signal) => signal.category === "positive"),
    activeUnlocks: unlocked,
    activeRestrictions: restricted,
    demoDefaults: positiveSignalSnapshot.demoDefaults,
  };
}

export function buildRecoveryProgressSummary(input: {
  signals: RiskSignal[];
  consequences: ConsequenceRecord[];
  manualReleaseWindow?: ManualReleaseWindow | null;
  now?: string;
}): RecoveryProgressSummary {
  const now = input.now ?? new Date().toISOString();
  const positiveSummary = summarizePositiveState(input);
  const config = getPositiveSignalThresholds().signals;
  const floorUntil = input.manualReleaseWindow?.floorUntil ?? null;
  const cooldownRemainingDays = floorUntil
    ? Math.max(0, Math.ceil((Date.parse(floorUntil) - Date.parse(now)) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    releaseFloorActive: Boolean(floorUntil && Date.parse(floorUntil) > Date.parse(now)),
    floorUntil,
    cooldownRemainingDays,
    activeRestrictions: positiveSummary.activeRestrictions.map((consequence) => consequence.consequenceType),
    activeUnlocks: positiveSummary.activeUnlocks.map((consequence) => consequence.consequenceType),
    helpfulPositiveSignals: [
      `long_term_good_standing (${config.long_term_good_standing.daysWithoutIncident} clean days)`,
      `repeated_governance_participation (${config.repeated_governance_participation.minEvents} events / ${config.repeated_governance_participation.lookbackDays} days)`,
      `trusted_protocol_usage (${config.trusted_protocol_usage.minEvents} events / ${config.trusted_protocol_usage.lookbackDays} days)`,
      `no_risk_incident_days (${config.no_risk_incident_days.daysWithoutIncident} clean days)`,
    ],
    explanation: buildRecoveryExplanation({
      releaseFloorActive: Boolean(floorUntil && Date.parse(floorUntil) > Date.parse(now)),
      floorUntil,
      helpfulPositiveSignals: [
        `long_term_good_standing (${config.long_term_good_standing.daysWithoutIncident} clean days)`,
        `repeated_governance_participation (${config.repeated_governance_participation.minEvents} events / ${config.repeated_governance_participation.lookbackDays} days)`,
        `trusted_protocol_usage (${config.trusted_protocol_usage.minEvents} events / ${config.trusted_protocol_usage.lookbackDays} days)`,
        `no_risk_incident_days (${config.no_risk_incident_days.daysWithoutIncident} clean days)`,
      ],
      evidenceRefs: positiveSummary.activePositiveSignals.flatMap((signal) => signal.evidenceRefs),
    }),
  };
}
