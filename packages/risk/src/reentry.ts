import { IdentityState, type RiskSignal as BaseRiskSignal } from "../../state/src/index.js";
import type { Hex } from "viem";
import type { ManualReleaseWindow, ReviewQueueItem, RiskSignal, ScoreBreakdown } from "./types.js";
import { createSyntheticRecoverySignal } from "./state-machine.js";
import { getRuleSnapshot } from "./registry.js";

function noRecentNegativeSignals(signals: RiskSignal[], now: string, days: number, severities: Array<BaseRiskSignal["severity"]>) {
  return !signals.some(
    (signal) =>
      signal.category === "negative" &&
      severities.includes(signal.severity) &&
      Date.parse(signal.observedAt) >= Date.parse(now) - days * 24 * 60 * 60 * 1000,
  );
}

function positiveSignalsSince(signals: RiskSignal[], since: string) {
  return signals.filter((signal) => signal.category === "positive" && Date.parse(signal.observedAt) >= Date.parse(since));
}

export function buildManualReleaseWindow(input: { releasedAt: string; currentState: IdentityState }): ManualReleaseWindow {
  switch (input.currentState) {
    case IdentityState.RESTRICTED:
      return {
        releasedAt: input.releasedAt,
        floorState: IdentityState.OBSERVED,
        floorUntil: new Date(Date.parse(input.releasedAt) + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    case IdentityState.HIGH_RISK:
      return {
        releasedAt: input.releasedAt,
        floorState: IdentityState.RESTRICTED,
        floorUntil: new Date(Date.parse(input.releasedAt) + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };
    case IdentityState.FROZEN:
      return {
        releasedAt: input.releasedAt,
        floorState: IdentityState.HIGH_RISK,
        floorUntil: new Date(Date.parse(input.releasedAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    default:
      return {
        releasedAt: input.releasedAt,
        floorState: IdentityState.NORMAL,
        floorUntil: input.releasedAt,
      };
  }
}

export function buildAutomaticRecoverySignals(input: {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  currentState: IdentityState;
  signals: RiskSignal[];
  score: ScoreBreakdown;
  openReviewItems: ReviewQueueItem[];
  manualReleaseWindow?: ManualReleaseWindow;
  now?: string;
}): RiskSignal[] {
  const now = input.now ?? new Date().toISOString();
  const recoverySignals: RiskSignal[] = [];
  const thresholds = getRuleSnapshot().thresholds;
  const hasOpenReview = input.openReviewItems.some((item) => item.status === "PENDING_REVIEW");
  const lastNegativeAt = [...input.signals]
    .filter((signal) => signal.category === "negative")
    .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))[0]?.observedAt;
  const positiveSinceLastNegative = lastNegativeAt ? positiveSignalsSince(input.signals, lastNegativeAt) : input.signals.filter((signal) => signal.category === "positive");

  if (input.currentState === IdentityState.FROZEN) {
    return recoverySignals;
  }

  const floorUntil = input.manualReleaseWindow?.floorUntil;
  if (floorUntil && Date.parse(now) < Date.parse(floorUntil)) {
    return recoverySignals;
  }

  if (
    input.currentState === IdentityState.OBSERVED &&
    noRecentNegativeSignals(input.signals, now, 7, ["low", "medium", "high", "critical"]) &&
    (positiveSinceLastNegative.length > 0 || (lastNegativeAt && Date.parse(now) >= Date.parse(lastNegativeAt) + 7 * 24 * 60 * 60 * 1000))
  ) {
    recoverySignals.push(
      createSyntheticRecoverySignal({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        reasonCode: "AUTO_REENTRY_OBSERVED_TO_NORMAL",
        requestedState: IdentityState.NORMAL,
        evidenceRef: "phase3://reentry/observed",
        observedAt: now,
      }),
    );
  }

  if (
    input.currentState === IdentityState.RESTRICTED &&
    noRecentNegativeSignals(input.signals, now, 14, ["high", "critical"]) &&
    input.score.finalInternalScore < thresholds.restricted &&
    !hasOpenReview
  ) {
    recoverySignals.push(
      createSyntheticRecoverySignal({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        reasonCode: "AUTO_REENTRY_RESTRICTED_TO_OBSERVED",
        requestedState: IdentityState.OBSERVED,
        evidenceRef: "phase3://reentry/restricted",
        observedAt: now,
      }),
    );
  }

  if (
    input.currentState === IdentityState.HIGH_RISK &&
    noRecentNegativeSignals(input.signals, now, 30, ["critical"]) &&
    positiveSinceLastNegative.length >= 2 &&
    !hasOpenReview
  ) {
    recoverySignals.push(
      createSyntheticRecoverySignal({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        reasonCode: "AUTO_REENTRY_HIGH_RISK_TO_RESTRICTED",
        requestedState: IdentityState.RESTRICTED,
        evidenceRef: "phase3://reentry/high-risk",
        observedAt: now,
      }),
    );
  }

  return recoverySignals;
}
