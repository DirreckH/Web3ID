import { IdentityState, createIdentityStateContext, createRiskSignal as createBaseRiskSignal, processRiskSignal, type IdentityStateContext } from "../../state/src/index.js";
import { getRuleDefinition, getRuleSnapshot, getRegistryVersion } from "./registry.js";
import type { BehaviorEvent, RiskSignal, ScoreBreakdown } from "./types.js";

function stateFromLabel(label: string): IdentityState {
  return IdentityState[label as keyof typeof IdentityState] ?? IdentityState.NORMAL;
}

function signalTemplateForEvent(event: BehaviorEvent) {
  switch (event.kind) {
    case "mixer_interaction":
      return {
        type: "MIXER_INTERACTION" as const,
        severity: "high" as const,
        category: "negative" as const,
        evidenceType: "MIXER_TRACE" as const,
        requestedState: IdentityState.HIGH_RISK,
        reasonCode: "MIXER_INTERACTION",
      };
    case "sanctioned_interaction":
      return {
        type: "SANCTION_HIT" as const,
        severity: "critical" as const,
        category: "negative" as const,
        evidenceType: "SANCTIONS_LIST" as const,
        requestedState: IdentityState.FROZEN,
        reasonCode: "SANCTION_HIT",
      };
    case "high_risk_counterparty":
      return {
        type: "SUSPICIOUS_COUNTERPARTY" as const,
        severity: "high" as const,
        category: "negative" as const,
        evidenceType: "COUNTERPARTY_SIGNAL" as const,
        requestedState: IdentityState.RESTRICTED,
        reasonCode: "HIGH_RISK_COUNTERPARTY",
      };
    case "trusted_defi_interaction":
      return {
        type: "TRUSTED_PROTOCOL_USAGE" as const,
        severity: "positive" as const,
        category: "positive" as const,
        evidenceType: "LOCAL_CHAIN_ACTIVITY" as const,
        requestedState: IdentityState.NORMAL,
        reasonCode: "TRUSTED_PROTOCOL_USAGE",
      };
    case "governance_vote":
    case "governance_delegate":
      return {
        type: "REPEATED_GOVERNANCE_PARTICIPATION" as const,
        severity: "positive" as const,
        category: "positive" as const,
        evidenceType: "LOCAL_CHAIN_ACTIVITY" as const,
        requestedState: IdentityState.NORMAL,
        reasonCode: "REPEATED_GOVERNANCE_PARTICIPATION",
      };
    case "unknown_contract_repetition":
      return {
        type: "NEGATIVE_RISK_FLAG" as const,
        severity: "medium" as const,
        category: "negative" as const,
        evidenceType: "LOCAL_CHAIN_ACTIVITY" as const,
        requestedState: IdentityState.OBSERVED,
        reasonCode: "UNKNOWN_CONTRACT_REPETITION",
      };
    default:
      return null;
  }
}

export function buildSyntheticUnknownContractEvents(events: BehaviorEvent[]) {
  const grouped = new Map<string, BehaviorEvent[]>();
  for (const event of events.filter((item) => item.kind === "contract_call" && !item.protocolTags.length)) {
    const dayBucket = event.blockTimestamp.slice(0, 10);
    const key = `${event.subIdentityId ?? event.rootIdentityId}:${dayBucket}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(event);
    grouped.set(key, bucket);
  }

  const derived: BehaviorEvent[] = [];
  for (const bucket of grouped.values()) {
    if (bucket.length < 3) {
      continue;
    }
    const first = bucket[0];
    derived.push({
      ...first,
      eventId: `${first.eventId}:unknown-contract-repetition`,
      kind: "unknown_contract_repetition",
      label: "Repeated unknown contract activity",
      evidenceRefs: [...new Set(bucket.flatMap((item) => item.evidenceRefs))],
      protocolTags: ["scope_class"],
      metadata: {
        repeatedCalls: bucket.length,
      },
    });
  }
  return derived;
}

export function buildDeterministicSignals(input: {
  rootIdentityId: `0x${string}`;
  subIdentityId?: `0x${string}`;
  events: BehaviorEvent[];
  score?: ScoreBreakdown;
  now?: string;
}): RiskSignal[] {
  const now = input.now ?? new Date().toISOString();
  const events = [...input.events, ...buildSyntheticUnknownContractEvents(input.events)]
    .sort((left, right) => Date.parse(left.blockTimestamp) - Date.parse(right.blockTimestamp));

  const signals = events
    .map((event): RiskSignal | null => {
      const template = signalTemplateForEvent(event);
      if (!template) {
        return null;
      }
      const rule = getRuleDefinition(event.kind);
      const signal = createBaseRiskSignal({
        identityId: event.subIdentityId ?? event.rootIdentityId,
        sourceType: "local_chain",
        sourceId: event.eventId,
        type: template.type,
        severity: template.severity,
        category: template.category,
        evidenceType: template.evidenceType,
        evidenceRef: event.rawRef,
        observedAt: event.blockTimestamp,
        ingestedAt: now,
        actor: "analyzer-service",
        policyVersion: getRuleSnapshot().version,
        requestedState: template.requestedState,
        reason: `${event.label} matched deterministic rule ${event.kind}`,
        reasonCode: template.reasonCode,
        explanation: `${event.label} created a ${template.category} signal for ${event.address}.`,
      });

      return {
        ...signal,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: event.subIdentityId,
        registryVersion: getRegistryVersion(),
        ruleId: event.kind,
        ruleFamily: rule.ruleFamily,
        ruleWeight: rule.riskDelta || rule.reputationDelta,
        sourceEventId: event.eventId,
        signalClass: "deterministic" as const,
        evidenceRefs: event.evidenceRefs,
      } satisfies RiskSignal;
    });

  return signals.filter((item): item is RiskSignal => item !== null);
}

export function replaySignalTimeline(identityId: `0x${string}`, initialState: IdentityState, signals: RiskSignal[]): IdentityStateContext {
  return signals
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt))
    .reduce((context, signal) => processRiskSignal(context, signal).next, createIdentityStateContext(identityId, initialState));
}

export function targetStateFromScore(score: ScoreBreakdown) {
  const thresholds = getRuleSnapshot().thresholds;
  if (score.finalInternalScore >= thresholds.frozen) {
    return IdentityState.FROZEN;
  }
  if (score.finalInternalScore >= thresholds.highRisk) {
    return IdentityState.HIGH_RISK;
  }
  if (score.finalInternalScore >= thresholds.restricted) {
    return IdentityState.RESTRICTED;
  }
  if (score.finalInternalScore >= thresholds.observed) {
    return IdentityState.OBSERVED;
  }
  return IdentityState.NORMAL;
}

export function createSyntheticRecoverySignal(input: {
  identityId: `0x${string}`;
  rootIdentityId: `0x${string}`;
  subIdentityId?: `0x${string}`;
  reasonCode: string;
  requestedState: IdentityState;
  evidenceRef: string;
  observedAt: string;
}) {
  const base = createBaseRiskSignal({
    identityId: input.identityId,
    sourceType: "local_chain",
    sourceId: `synthetic:${input.reasonCode}:${input.observedAt}`,
    type: "LONG_TERM_GOOD_STANDING",
    severity: "positive",
    category: "positive",
    evidenceType: "LOCAL_CHAIN_ACTIVITY",
    evidenceRef: input.evidenceRef,
    observedAt: input.observedAt,
    ingestedAt: input.observedAt,
    actor: "reentry-engine",
    policyVersion: getRuleSnapshot().version,
    requestedState: input.requestedState,
    reason: input.reasonCode,
    reasonCode: input.reasonCode,
    explanation: `Synthetic re-entry moved the identity to ${IdentityState[input.requestedState]}.`,
  });

  return {
    ...base,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    registryVersion: getRegistryVersion(),
    ruleId: input.reasonCode.toLowerCase(),
    ruleFamily: "synthetic_reentry",
    ruleWeight: 0,
    signalClass: "synthetic_reentry" as const,
    evidenceRefs: [input.evidenceRef],
  } satisfies RiskSignal;
}
