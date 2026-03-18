
import {
  buildAutomaticRecoverySignals,
  buildDeterministicSignals,
  buildManualReleaseWindow,
  buildScoreBreakdown,
  collectBehaviorEvents,
  computeEffectiveSubState,
  createAnchorQueueEntry,
  createAuditRecord,
  createBindingChallenge,
  deriveListEntries,
  evaluateSubToRootPropagation,
  exportAuditBundle,
  generateAiSuggestions,
  getOpenReviewItems,
  getRegistryVersion,
  getRuleDefinition,
  queueSuggestionForReview,
  replaySignalTimeline,
  shouldAnchorState,
  summarizeLists,
  verifyBindingSubmission,
  type AiSuggestion,
  type BehaviorBinding,
  type BindingType,
  type ManualListAction,
  type RiskSignal,
  type RiskSummary,
  type ReviewQueueCounts,
  type WatchStatusSummary,
} from "../../../packages/risk/src/index.js";
import { SubIdentityType, type RootIdentity, type SameRootProof, type SubIdentity, type SubIdentityLinkProof } from "../../../packages/identity/src/index.js";
import { IdentityState, createRiskSignal, type IdentityStateContext, type RiskSignalInput } from "../../../packages/state/src/index.js";
import { createPublicClient, createWalletClient, getAddress, http, keccak256, stringToHex, type Address, type Hex } from "viem";
import { analyzerConfig } from "./config.js";
import { loadStore, saveStore, type AnalyzerIdentityRecord, type AnalyzerStore, type AnalyzerWatcherRecord } from "./store.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const anchorRegistryAbi = [
  {
    type: "function",
    name: "setStateWithAnchorHashes",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityId", type: "bytes32" },
      { name: "nextState", type: "uint8" },
      { name: "reasonCode", type: "bytes32" },
      { name: "version", type: "uint256" },
      { name: "decisionRef", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "stateHash", type: "bytes32" },
      { name: "evidenceBundleHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setStateWithAnchors",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityId", type: "bytes32" },
      { name: "nextState", type: "uint8" },
      { name: "reasonCode", type: "bytes32" },
      { name: "version", type: "uint256" },
      { name: "decisionRef", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setState",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityId", type: "bytes32" },
      { name: "nextState", type: "uint8" },
      { name: "reasonCode", type: "bytes32" },
      { name: "version", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const publicClient = createPublicClient({ transport: http(analyzerConfig.rpcUrl) });
const walletClient = createWalletClient({ account: analyzerConfig.riskManagerAccount, transport: http(analyzerConfig.rpcUrl) });
const watchTimers = new Map<string, NodeJS.Timeout>();
const activeWatchTicks = new Set<string>();

export type RegisterIdentityTreeInput = { rootIdentity: RootIdentity; subIdentities: SubIdentity[] };
export type SubmitBindingInput = {
  challengeId: string;
  candidateSignature: Hex;
  linkProof?: SubIdentityLinkProof;
  sameRootProof?: SameRootProof;
  authorizerAddress?: Address;
  authorizerSignature?: Hex;
  metadata?: Record<string, unknown>;
};
export type BackfillScanInput = { rootIdentityId?: Hex; identityId?: Hex; fromBlock?: bigint; toBlock?: bigint; recentBlocks?: number };
export type ReviewConfirmationInput = { actor: string; requestedState?: IdentityState; reasonCode?: string; note?: string };
export type ManualReleaseInput = { identityId: Hex; actor: string; reasonCode: string; evidenceRefs: string[]; note?: string };
export type WatchScanInput = {
  action?: "refresh" | "start" | "stop";
  rootIdentityId?: Hex;
  identityId?: Hex;
  fromBlock?: bigint;
  toBlock?: bigint;
  recentBlocks?: number;
  pollIntervalMs?: number;
};

function nowIso() { return new Date().toISOString(); }
function uniqueStrings(values: string[]) { return [...new Set(values.filter(Boolean))]; }
function strongerState(left: IdentityState, right: IdentityState) { return Number(left) >= Number(right) ? left : right; }
function defaultInitialStateForSub(subIdentity?: SubIdentity) { return subIdentity?.type === SubIdentityType.ANONYMOUS_LOWRISK ? IdentityState.OBSERVED : IdentityState.NORMAL; }
function toBytes32(value?: string) {
  if (!value) return `0x${"0".repeat(64)}` as Hex;
  return (value.startsWith("0x") && value.length === 66 ? value : keccak256(stringToHex(value))) as Hex;
}

function ensureRootContainer(store: AnalyzerStore, rootIdentity: RootIdentity) {
  const existing = store.roots[rootIdentity.identityId] ?? { rootIdentity, subIdentityIds: [] };
  existing.rootIdentity = rootIdentity;
  store.roots[rootIdentity.identityId] = existing;
  return existing;
}

function ensureIdentityRecord(store: AnalyzerStore, input: { rootIdentity: RootIdentity; subIdentity?: SubIdentity }): AnalyzerIdentityRecord {
  const identityId = input.subIdentity?.identityId ?? input.rootIdentity.identityId;
  const existing = store.identities[identityId];
  if (existing) {
    existing.kind = input.subIdentity ? "sub" : "root";
    existing.rootIdentity = input.rootIdentity;
    existing.subIdentity = input.subIdentity;
    existing.signals = existing.signals ?? [];
    existing.manualSignals = existing.manualSignals ?? [];
    existing.listEntries = existing.listEntries ?? [];
    existing.manualListActions = existing.manualListActions ?? [];
    existing.updatedAt = nowIso();
    return existing;
  }

  const createdAt = nowIso();
  const created: AnalyzerIdentityRecord = {
    kind: input.subIdentity ? "sub" : "root",
    rootIdentity: input.rootIdentity,
    subIdentity: input.subIdentity,
    signals: [],
    manualSignals: [],
    listEntries: [],
    manualListActions: [],
    createdAt,
    updatedAt: createdAt,
  };
  store.identities[identityId] = created;
  return created;
}

function getIdentityRecordOrThrow(store: AnalyzerStore, identityId: Hex) {
  const record = store.identities[identityId];
  if (!record) throw new Error(`Unknown identity: ${identityId}`);
  return record;
}
function getRootContainerOrThrow(store: AnalyzerStore, rootIdentityId: Hex) {
  const root = store.roots[rootIdentityId];
  if (!root) throw new Error(`Unknown root identity: ${rootIdentityId}`);
  return root;
}
function resolveRootIdentityId(store: AnalyzerStore, input: { rootIdentityId?: Hex; identityId?: Hex }) {
  if (input.rootIdentityId) return input.rootIdentityId;
  if (!input.identityId) throw new Error("Either rootIdentityId or identityId must be provided.");
  return getIdentityRecordOrThrow(store, input.identityId).rootIdentity.identityId;
}
function sortedSignals(signals: RiskSignal[]) { return [...signals].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)); }
function mergeSignals(...groups: RiskSignal[][]) {
  const merged = new Map<string, RiskSignal>();
  for (const signal of groups.flat()) merged.set(signal.signalId, signal);
  return sortedSignals([...merged.values()]);
}
function persistAudit(store: AnalyzerStore, audit: ReturnType<typeof createAuditRecord>) { store.audits[audit.auditId] = audit; }
function watchIdFor(input: { rootIdentityId: Hex; identityId?: Hex }) {
  return input.identityId ? `identity:${input.identityId}` : `root:${input.rootIdentityId}`;
}
function summarizeReviewQueueCounts(reviewItems: ReturnType<typeof getReviewsForIdentity>): ReviewQueueCounts {
  return reviewItems.reduce<ReviewQueueCounts>(
    (counts, item) => {
      if (item.status === "PENDING_REVIEW") counts.pending += 1;
      else if (item.status === "CONFIRMED_SIGNAL") counts.confirmed += 1;
      else if (item.status === "DISMISSED") counts.dismissed += 1;
      else if (item.status === "EXPIRED") counts.expired += 1;
      return counts;
    },
    { pending: 0, confirmed: 0, dismissed: 0, expired: 0 },
  );
}
function getRelevantWatchers(store: AnalyzerStore, identityId: Hex) {
  const record = getIdentityRecordOrThrow(store, identityId);
  const rootIdentityId = record.rootIdentity.identityId;
  return Object.values(store.watchers)
    .filter((watcher) => watcher.rootIdentityId === rootIdentityId && (watcher.identityId === undefined || watcher.identityId === identityId))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}
function summarizeWatchStatus(store: AnalyzerStore, identityId: Hex): WatchStatusSummary {
  const items = getRelevantWatchers(store, identityId).map((watcher) => ({
    watchId: watcher.watchId,
    scope: watcher.scope,
    identityId: watcher.identityId as Hex | undefined,
    rootIdentityId: watcher.rootIdentityId as Hex,
    status: watcher.status,
    recentBlocks: watcher.recentBlocks,
    pollIntervalMs: watcher.pollIntervalMs,
    lastScanStartedAt: watcher.lastScanStartedAt,
    lastScanCompletedAt: watcher.lastScanCompletedAt,
    lastError: watcher.lastError,
  }));
  return {
    active: items.some((item) => item.status === "ACTIVE"),
    items,
  };
}
function summarizeActiveManualOverrides(record: AnalyzerIdentityRecord, now = nowIso()) {
  return {
    activeManualSignals: record.manualSignals.filter((signal) => {
      if (signal.category === "positive" && signal.reasonCode.startsWith("AUTO_REENTRY_")) return false;
      if (record.manualReleaseWindow && Date.parse(record.manualReleaseWindow.floorUntil) > Date.parse(now)) return true;
      return signal.signalType === "MANUAL_REVIEW_RESULT";
    }),
    activeManualListActions: record.manualListActions.filter((action) => !action.expiresAt || Date.parse(action.expiresAt) > Date.parse(now)),
    releaseFloorActive: Boolean(record.manualReleaseWindow && Date.parse(record.manualReleaseWindow.floorUntil) > Date.parse(now)),
  };
}
function expirePendingReviews(store: AnalyzerStore, now = nowIso()) {
  for (const item of Object.values(store.reviewQueue)) {
    if (item.status === "PENDING_REVIEW" && item.expiresAt && Date.parse(item.expiresAt) <= Date.parse(now)) {
      item.status = "EXPIRED";
      item.expiredAt = now;
      persistAudit(
        store,
        createAuditRecord({
          identityId: item.identityId,
          rootIdentityId: item.rootIdentityId,
          subIdentityId: item.subIdentityId,
          action: "AI_REVIEW_ITEM_EXPIRED",
          actor: "analyzer-service",
          evidenceRefs: item.evidenceRefs,
          aiSuggestionId: item.sourceSuggestionId,
          reviewItemId: item.reviewItemId,
        }),
      );
    }
  }
}
function buildStateContextWithFloor(context: IdentityStateContext, floorState?: IdentityState) {
  if (floorState === undefined || context.currentState >= floorState) return context;
  return { ...context, currentState: floorState } satisfies IdentityStateContext;
}
function latestReasonCode(record: AnalyzerIdentityRecord) {
  return record.signals.at(-1)?.reasonCode ?? record.stateContext?.decisions.at(-1)?.reasonCode ?? "NO_SIGNAL";
}

function createManualSignal(input: {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  requestedState: IdentityState;
  reasonCode: string;
  actor: string;
  evidenceRefs: string[];
  note?: string;
  category?: "positive" | "negative";
  severity?: RiskSignal["severity"];
  sourceSuggestionId?: string;
  observedAt?: string;
}) {
  const observedAt = input.observedAt ?? nowIso();
  const base = createRiskSignal({
    identityId: input.identityId,
    sourceType: "manual",
    sourceId: input.sourceSuggestionId ?? input.reasonCode,
    type: "MANUAL_REVIEW_RESULT",
    severity: input.severity ?? (input.category === "positive" ? "positive" : "high"),
    category: input.category ?? (input.requestedState <= IdentityState.NORMAL ? "positive" : "negative"),
    evidenceType: "MANUAL_REVIEW",
    evidenceRef: input.evidenceRefs[0] ?? `phase3://manual/${input.reasonCode}`,
    observedAt,
    ingestedAt: observedAt,
    actor: input.actor,
    policyVersion: 1,
    requestedState: input.requestedState,
    reason: input.note ?? input.reasonCode,
    reasonCode: input.reasonCode,
    explanation: input.note ?? `Manual action set the identity to ${IdentityState[input.requestedState]}.`,
  } satisfies RiskSignalInput);

  return {
    ...base,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    registryVersion: getRegistryVersion(),
    ruleId: input.reasonCode.toLowerCase(),
    ruleFamily: "manual",
    ruleWeight: 0,
    signalClass: "manual" as const,
    sourceSuggestionId: input.sourceSuggestionId,
    evidenceRefs: uniqueStrings(input.evidenceRefs),
  } satisfies RiskSignal;
}

type LocalComputation = {
  identityId: Hex;
  record: AnalyzerIdentityRecord;
  score: NonNullable<AnalyzerIdentityRecord["score"]>;
  stateContext: IdentityStateContext;
  storedState: IdentityState;
  signals: RiskSignal[];
  reasonCodes: string[];
  evidenceRefs: string[];
  latestSignal?: RiskSignal;
};
function getEventsForIdentity(store: AnalyzerStore, identityId: Hex) {
  const record = getIdentityRecordOrThrow(store, identityId);
  return Object.values(store.events)
    .filter((event) => (record.kind === "root" ? event.rootIdentityId === identityId : event.subIdentityId === identityId))
    .sort((a, b) => {
      const blockDiff = Number(a.blockNumber - b.blockNumber);
      if (blockDiff !== 0) return blockDiff;
      if (a.txIndex !== b.txIndex) return a.txIndex - b.txIndex;
      return (a.logIndex ?? -1) - (b.logIndex ?? -1);
    });
}
function getBindingsForIdentity(store: AnalyzerStore, identityId: Hex) {
  const record = getIdentityRecordOrThrow(store, identityId);
  return Object.values(store.bindings).filter((binding) => {
    if (binding.status !== "ACTIVE") return false;
    return record.kind === "root" ? binding.rootIdentityId === identityId : binding.subIdentityId === identityId;
  });
}
function getReviewsForIdentity(store: AnalyzerStore, identityId: Hex) {
  return Object.values(store.reviewQueue)
    .filter((item) => item.identityId === identityId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
function getSuggestionsForIdentity(store: AnalyzerStore, identityId: Hex) {
  return Object.values(store.aiSuggestions)
    .filter((item) => item.identityId === identityId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
function getAnchorsForIdentity(store: AnalyzerStore, identityId: Hex) {
  return Object.values(store.anchorQueue)
    .filter((item) => item.identityId === identityId)
    .sort((a, b) => a.anchorSeq - b.anchorSeq);
}
function getAuditForIdentity(store: AnalyzerStore, identityId: Hex) {
  return Object.values(store.audits)
    .filter((item) => item.identityId === identityId || item.rootIdentityId === identityId)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

async function computeLocalRecord(store: AnalyzerStore, record: AnalyzerIdentityRecord, now = nowIso()): Promise<LocalComputation> {
  const identityId = (record.subIdentity?.identityId ?? record.rootIdentity.identityId) as Hex;
  const events = getEventsForIdentity(store, identityId);
  const rootIdentityId = record.rootIdentity.identityId;
  const subIdentityId = record.subIdentity?.identityId;
  const score = buildScoreBreakdown({ identityId, rootIdentityId, subIdentityId, events, now });
  const deterministicSignals = buildDeterministicSignals({ rootIdentityId, subIdentityId, events, score, now });
  const preRecoverySignals = mergeSignals(deterministicSignals, record.manualSignals);
  const openReviewItems = getOpenReviewItems(getReviewsForIdentity(store, identityId), identityId);
  const preRecoveryContext = replaySignalTimeline(
    identityId,
    record.kind === "sub" ? defaultInitialStateForSub(record.subIdentity) : IdentityState.NORMAL,
    preRecoverySignals,
  );
  const recoverySignals = buildAutomaticRecoverySignals({
    identityId,
    rootIdentityId,
    subIdentityId,
    currentState: preRecoveryContext.currentState,
    signals: preRecoverySignals,
    score,
    openReviewItems,
    manualReleaseWindow: record.manualReleaseWindow,
    now,
  });
  const signals = mergeSignals(preRecoverySignals, recoverySignals);
  const floorState = record.manualReleaseWindow && Date.parse(record.manualReleaseWindow.floorUntil) > Date.parse(now)
    ? record.manualReleaseWindow.floorState
    : undefined;
  const stateContext = buildStateContextWithFloor(
    replaySignalTimeline(
      identityId,
      record.kind === "sub" ? defaultInitialStateForSub(record.subIdentity) : IdentityState.NORMAL,
      signals,
    ),
    floorState,
  );
  return {
    identityId,
    record,
    score,
    stateContext,
    storedState: stateContext.currentState,
    signals,
    reasonCodes: uniqueStrings(signals.map((signal) => signal.reasonCode)),
    evidenceRefs: uniqueStrings([...events.flatMap((event) => event.evidenceRefs), ...signals.flatMap((signal) => signal.evidenceRefs)]),
    latestSignal: signals.at(-1),
  };
}

function collectRecentPropagationHistory(subComputations: LocalComputation[]) {
  return subComputations.flatMap((local) =>
    local.signals
      .filter((signal) => signal.category === "negative")
      .map((signal) => ({
        identityId: local.identityId,
        state: signal.requestedState ?? local.storedState,
        occurredAt: signal.observedAt,
        ruleFamily: signal.ruleFamily,
      })),
  );
}

function syncAiArtifacts(input: { store: AnalyzerStore; identityId: Hex; rootIdentityId: Hex; subIdentityId?: Hex; suggestions: AiSuggestion[] }) {
  for (const suggestion of input.suggestions) {
    if (!input.store.aiSuggestions[suggestion.id]) {
      input.store.aiSuggestions[suggestion.id] = suggestion;
      persistAudit(
        input.store,
        createAuditRecord({
          identityId: input.identityId,
          rootIdentityId: input.rootIdentityId,
          subIdentityId: input.subIdentityId,
          action: "AI_SUGGESTION_CREATED",
          actor: "ai-assistant",
          evidenceRefs: suggestion.evidenceRefs,
          aiSuggestionId: suggestion.id,
          metadata: { summary: suggestion.summary, recommendedAction: suggestion.recommendedAction },
        }),
      );
    }

    const existingReview = Object.values(input.store.reviewQueue).find((item) => item.sourceSuggestionId === suggestion.id);
    if (existingReview) continue;
    const reviewItem = queueSuggestionForReview(suggestion);
    if (!reviewItem) continue;
    input.store.reviewQueue[reviewItem.reviewItemId] = reviewItem;
    persistAudit(
      input.store,
      createAuditRecord({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        action: "AI_REVIEW_ITEM_OPENED",
        actor: "ai-assistant",
        evidenceRefs: reviewItem.evidenceRefs,
        aiSuggestionId: suggestion.id,
        reviewItemId: reviewItem.reviewItemId,
      }),
    );
  }
}
function syncIdentityArtifacts(input: {
  store: AnalyzerStore;
  record: AnalyzerIdentityRecord;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  score: NonNullable<AnalyzerIdentityRecord["score"]>;
  stateContext: IdentityStateContext;
  storedState: IdentityState;
  effectiveState: IdentityState;
  reasonCodes: string[];
  warnings: string[];
  evidenceRefs: string[];
  aiSuggestions: AiSuggestion[];
  listEntries: AnalyzerIdentityRecord["listEntries"];
  now: string;
}) {
  const previousRiskRecord = input.record.riskRecord;
  const previousScore = input.record.score;
  const previousListSignature = (input.record.listEntries ?? []).map((entry) => `${entry.entryId}:${entry.removedAt ?? "active"}`).join("|");
  const nextListSignature = input.listEntries.map((entry) => `${entry.entryId}:${entry.removedAt ?? "active"}`).join("|");

  input.record.score = input.score;
  input.record.signals = input.stateContext.signals as RiskSignal[];
  input.record.stateContext = input.stateContext;
  input.record.listEntries = input.listEntries;
  input.record.summary = {
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    storedState: input.storedState,
    effectiveState: input.effectiveState,
    anchoredState: previousRiskRecord?.anchoredState,
    riskScore: input.score.riskScore,
    reputationScore: input.score.reputationScore,
    confidenceScore: input.score.confidenceScore,
    finalInternalScore: input.score.finalInternalScore,
    reasonCodes: uniqueStrings(input.reasonCodes),
    warnings: uniqueStrings([...input.warnings, ...input.aiSuggestions.map((suggestion) => suggestion.summary)]),
    evidenceRefs: uniqueStrings(input.evidenceRefs),
    ...summarizeLists(input.listEntries),
    manualReleaseWindow: input.record.manualReleaseWindow ?? null,
    activeManualOverrides: summarizeActiveManualOverrides(input.record, input.now),
    watchStatus: summarizeWatchStatus(input.store, input.identityId),
    reviewQueueCounts: summarizeReviewQueueCounts(getReviewsForIdentity(input.store, input.identityId)),
  } satisfies RiskSummary;
  input.record.riskRecord = {
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    kind: input.record.kind,
    storedState: input.storedState,
    effectiveState: input.effectiveState,
    anchoredState: previousRiskRecord?.anchoredState,
    anchoredStateHash: previousRiskRecord?.anchoredStateHash,
    lastEvidenceBundleHash: previousRiskRecord?.lastEvidenceBundleHash,
    lastDecisionId: input.stateContext.lastDecisionRef,
    updatedAt: input.now,
  };
  input.record.updatedAt = input.now;
  input.record.lastComputedAt = input.now;

  if (!previousScore || previousScore.finalInternalScore !== input.score.finalInternalScore || previousScore.riskScore !== input.score.riskScore || previousScore.reputationScore !== input.score.reputationScore) {
    persistAudit(
      input.store,
      createAuditRecord({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        action: "SCORE_COMPUTED",
        actor: "analyzer-service",
        ruleIds: uniqueStrings(input.reasonCodes),
        evidenceRefs: input.evidenceRefs,
        registryVersion: getRegistryVersion(),
        metadata: {
          riskScore: input.score.riskScore,
          reputationScore: input.score.reputationScore,
          confidenceScore: input.score.confidenceScore,
          finalInternalScore: input.score.finalInternalScore,
        },
      }),
    );
  }

  if (!previousRiskRecord || previousRiskRecord.storedState !== input.storedState || previousRiskRecord.effectiveState !== input.effectiveState) {
    persistAudit(
      input.store,
      createAuditRecord({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        action: "STATE_COMPUTED",
        actor: "analyzer-service",
        ruleIds: uniqueStrings(input.reasonCodes),
        evidenceRefs: input.evidenceRefs,
        registryVersion: getRegistryVersion(),
        metadata: { storedState: IdentityState[input.storedState], effectiveState: IdentityState[input.effectiveState] },
      }),
    );
  }

  if (previousListSignature !== nextListSignature) {
    persistAudit(
      input.store,
      createAuditRecord({
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        action: "LIST_UPDATED",
        actor: "analyzer-service",
        ruleIds: uniqueStrings(input.reasonCodes),
        evidenceRefs: input.evidenceRefs,
        metadata: { listEntryCount: input.listEntries.length },
      }),
    );
  }
}

function maybeQueueAnchor(input: {
  store: AnalyzerStore;
  record: AnalyzerIdentityRecord;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  storedState: IdentityState;
  effectiveState: IdentityState;
  reasonCode: string;
  evidenceRefs: string[];
  isManualOrGovernance: boolean;
}) {
  const previousAnchoredState = input.record.riskRecord?.anchoredState;
  const shouldQueue = shouldAnchorState({
    kind: input.record.kind,
    subType: input.record.subIdentity?.type,
    previousAnchoredState,
    storedState: input.storedState,
    effectiveState: input.effectiveState,
    isManualOrGovernance: input.isManualOrGovernance,
  });
  if (!shouldQueue) return;

  const existingPending = Object.values(input.store.anchorQueue).find((entry) =>
    entry.identityId === input.identityId && entry.status === "PENDING" && entry.storedState === input.storedState && entry.effectiveState === input.effectiveState,
  );
  if (existingPending) return;

  const anchorSeq = getAnchorsForIdentity(input.store, input.identityId).length + 1;
  const entry = createAnchorQueueEntry({
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    storedState: input.storedState,
    effectiveState: input.effectiveState,
    reasonCode: input.reasonCode,
    policyVersion: 1,
    registryVersion: getRegistryVersion(),
    decisionId: input.record.stateContext?.lastDecisionRef,
    evidenceRefs: input.evidenceRefs,
    anchorSeq,
    shouldMaterializeState: input.effectiveState >= IdentityState.RESTRICTED || input.isManualOrGovernance,
  });
  input.store.anchorQueue[entry.anchorId] = entry;
  persistAudit(
    input.store,
    createAuditRecord({
      identityId: input.identityId,
      rootIdentityId: input.rootIdentityId,
      subIdentityId: input.subIdentityId,
      action: "ANCHOR_QUEUED",
      actor: "analyzer-service",
      evidenceRefs: [...input.evidenceRefs, `stateHash:${entry.stateHash}`, `evidenceBundleHash:${entry.evidenceBundleHash}`],
      metadata: { anchorId: entry.anchorId },
    }),
  );
}

async function recomputeRootState(store: AnalyzerStore, rootIdentityId: Hex, now = nowIso()) {
  expirePendingReviews(store, now);
  const rootContainer = getRootContainerOrThrow(store, rootIdentityId);
  const rootRecord = ensureIdentityRecord(store, { rootIdentity: rootContainer.rootIdentity });
  const subRecords = rootContainer.subIdentityIds.map((identityId) => getIdentityRecordOrThrow(store, identityId as Hex));

  const rootLocal = await computeLocalRecord(store, rootRecord, now);
  const subLocals = await Promise.all(subRecords.map((record) => computeLocalRecord(store, record, now)));
  const recentHistory = collectRecentPropagationHistory(subLocals);
  const siblingOverlayMap = new Map<Hex, IdentityState>();
  const subPropagationReasons = new Map<Hex, string[]>();
  let rootStoredState = rootLocal.storedState;
  const rootReasonCodes = [...rootLocal.reasonCodes];
  const rootEvidenceRefs = [...rootLocal.evidenceRefs];

  for (const local of subLocals) {
    const latestNegativeSignal = [...local.signals].reverse().find((signal) => signal.category === "negative");
    if (!latestNegativeSignal || !local.record.subIdentity) continue;

    const rule = (() => {
      try { return getRuleDefinition(latestNegativeSignal.ruleId as never); } catch { return undefined; }
    })();
    const propagation = evaluateSubToRootPropagation({
      subject: {
        identityId: local.identityId,
        rootIdentityId,
        scope: local.record.subIdentity.scope,
        storedState: local.storedState,
        permissions: local.record.subIdentity.permissions,
      },
      siblings: subLocals.filter((item) => Boolean(item.record.subIdentity)).map((item) => ({
        identityId: item.identityId,
        rootIdentityId,
        scope: item.record.subIdentity!.scope,
        storedState: item.storedState,
        permissions: item.record.subIdentity!.permissions,
      })),
      nextState: local.storedState,
      ruleFamily: latestNegativeSignal.ruleFamily,
      rootSensitive: rule?.rootSensitive ?? ["mixer", "sanctioned", "counterparty", "manual"].includes(latestNegativeSignal.ruleFamily),
      directRootEvidence: latestNegativeSignal.evidenceRefs.some((ref) => ref.includes("root") || ref.includes("controller")),
      governanceFreeze: latestNegativeSignal.signalType === "GOVERNANCE_ACTION" && local.storedState === IdentityState.FROZEN,
      recentHistory,
      now,
    });

    if (propagation.rootTargetState !== null) {
      rootStoredState = strongerState(rootStoredState, propagation.rootTargetState);
      rootReasonCodes.push(...propagation.reasonCodes);
      rootEvidenceRefs.push(...local.evidenceRefs);
    }
    if (propagation.reasonCodes.length > 0) subPropagationReasons.set(local.identityId, propagation.reasonCodes);
    for (const overlay of propagation.siblingOverlays) {
      const previous = siblingOverlayMap.get(overlay.identityId);
      siblingOverlayMap.set(overlay.identityId, previous === undefined ? overlay.overlayState : strongerState(previous, overlay.overlayState));
    }
  }
  const rootWarnings = uniqueStrings(rootReasonCodes.map((reasonCode) => `Root propagation applied: ${reasonCode}`));
  const rootAiSuggestions = await generateAiSuggestions({
    identityId: rootContainer.rootIdentity.identityId,
    rootIdentityId: rootContainer.rootIdentity.identityId,
    summary: {
      identityId: rootContainer.rootIdentity.identityId,
      rootIdentityId: rootContainer.rootIdentity.identityId,
      storedState: rootStoredState,
      effectiveState: rootStoredState,
      riskScore: rootLocal.score.riskScore,
      reputationScore: rootLocal.score.reputationScore,
      confidenceScore: rootLocal.score.confidenceScore,
      finalInternalScore: rootLocal.score.finalInternalScore,
      reasonCodes: uniqueStrings(rootReasonCodes),
      warnings: rootWarnings,
      evidenceRefs: uniqueStrings(rootEvidenceRefs),
      watchlist: [],
      restrictedList: [],
      blacklistOrFrozenList: [],
    },
    signals: rootLocal.signals,
    apiKey: analyzerConfig.openAiApiKey,
    model: analyzerConfig.openAiModel,
    now,
  });
  syncAiArtifacts({ store, identityId: rootContainer.rootIdentity.identityId, rootIdentityId: rootContainer.rootIdentity.identityId, suggestions: rootAiSuggestions });
  const rootListEntries = deriveListEntries({
    identityId: rootContainer.rootIdentity.identityId,
    rootIdentityId: rootContainer.rootIdentity.identityId,
    state: rootStoredState,
    reasonCode: uniqueStrings(rootReasonCodes).at(-1) ?? latestReasonCode(rootRecord),
    sourceSignalIds: rootLocal.signals.map((signal) => signal.signalId),
    sourceDecisionId: rootLocal.stateContext.lastDecisionRef,
    evidenceRefs: uniqueStrings(rootEvidenceRefs),
    aiSuggestions: rootAiSuggestions,
    manualActions: rootRecord.manualListActions,
    now,
  });
  syncIdentityArtifacts({
    store,
    record: rootRecord,
    identityId: rootContainer.rootIdentity.identityId,
    rootIdentityId: rootContainer.rootIdentity.identityId,
    score: rootLocal.score,
    stateContext: { ...rootLocal.stateContext, currentState: rootStoredState },
    storedState: rootStoredState,
    effectiveState: rootStoredState,
    reasonCodes: uniqueStrings(rootReasonCodes),
    warnings: rootWarnings,
    evidenceRefs: uniqueStrings(rootEvidenceRefs),
    aiSuggestions: rootAiSuggestions,
    listEntries: rootListEntries,
    now,
  });
  maybeQueueAnchor({
    store,
    record: rootRecord,
    identityId: rootContainer.rootIdentity.identityId,
    rootIdentityId: rootContainer.rootIdentity.identityId,
    storedState: rootStoredState,
    effectiveState: rootStoredState,
    reasonCode: uniqueStrings(rootReasonCodes).at(-1) ?? latestReasonCode(rootRecord),
    evidenceRefs: uniqueStrings(rootEvidenceRefs),
    isManualOrGovernance: rootRecord.manualSignals.some((signal) => signal.signalType === "MANUAL_REVIEW_RESULT" || signal.sourceType === "governance"),
  });

  for (const local of subLocals) {
    const siblingOverlayState = siblingOverlayMap.get(local.identityId);
    const overlayedLocalState = siblingOverlayState === undefined ? local.storedState : strongerState(local.storedState, siblingOverlayState);
    const effectiveState = computeEffectiveSubState({
      storedState: overlayedLocalState,
      rootStoredState,
      inheritsRootRestrictions: local.record.subIdentity?.permissions.inheritsRootRestrictions ?? true,
    });
    const warnings = uniqueStrings([
      ...(siblingOverlayState !== undefined && siblingOverlayState > local.storedState ? [`Sibling overlay raised the effective state floor to ${IdentityState[siblingOverlayState]}.`] : []),
      ...(effectiveState > overlayedLocalState ? [`Root restrictions raised the effective state floor to ${IdentityState[effectiveState]}.`] : []),
      ...(local.record.manualReleaseWindow && Date.parse(local.record.manualReleaseWindow.floorUntil) > Date.parse(now) ? [`Manual release observation floor remains active until ${local.record.manualReleaseWindow.floorUntil}.`] : []),
      ...(getOpenReviewItems(getReviewsForIdentity(store, local.identityId), local.identityId).length > 0 ? ["A pending AI review item remains unresolved."] : []),
    ]);
    const reasonCodes = uniqueStrings([
      ...local.reasonCodes,
      ...(subPropagationReasons.get(local.identityId) ?? []),
      ...(siblingOverlayState !== undefined && siblingOverlayState > local.storedState ? ["SCOPE_CLASS_OVERLAY"] : []),
      ...(effectiveState > overlayedLocalState ? [`ROOT_EFFECTIVE_FLOOR_${IdentityState[effectiveState]}`] : []),
    ]);
    const aiSuggestions = await generateAiSuggestions({
      identityId: local.identityId,
      rootIdentityId,
      subIdentityId: local.record.subIdentity?.identityId,
      summary: {
        identityId: local.identityId,
        rootIdentityId,
        subIdentityId: local.record.subIdentity?.identityId,
        storedState: local.storedState,
        effectiveState,
        riskScore: local.score.riskScore,
        reputationScore: local.score.reputationScore,
        confidenceScore: local.score.confidenceScore,
        finalInternalScore: local.score.finalInternalScore,
        reasonCodes,
        warnings,
        evidenceRefs: local.evidenceRefs,
        watchlist: [],
        restrictedList: [],
        blacklistOrFrozenList: [],
      },
      signals: local.signals,
      apiKey: analyzerConfig.openAiApiKey,
      model: analyzerConfig.openAiModel,
      now,
    });
    syncAiArtifacts({ store, identityId: local.identityId, rootIdentityId, subIdentityId: local.record.subIdentity?.identityId, suggestions: aiSuggestions });
    const listEntries = deriveListEntries({
      identityId: local.identityId,
      rootIdentityId,
      subIdentityId: local.record.subIdentity?.identityId,
      state: effectiveState,
      reasonCode: reasonCodes.at(-1) ?? latestReasonCode(local.record),
      sourceSignalIds: local.signals.map((signal) => signal.signalId),
      sourceDecisionId: local.stateContext.lastDecisionRef,
      evidenceRefs: local.evidenceRefs,
      aiSuggestions,
      manualActions: local.record.manualListActions,
      now,
    });
    syncIdentityArtifacts({
      store,
      record: local.record,
      identityId: local.identityId,
      rootIdentityId,
      subIdentityId: local.record.subIdentity?.identityId,
      score: local.score,
      stateContext: local.stateContext,
      storedState: local.storedState,
      effectiveState,
      reasonCodes,
      warnings,
      evidenceRefs: local.evidenceRefs,
      aiSuggestions,
      listEntries,
      now,
    });
    maybeQueueAnchor({
      store,
      record: local.record,
      identityId: local.identityId,
      rootIdentityId,
      subIdentityId: local.record.subIdentity?.identityId,
      storedState: local.storedState,
      effectiveState,
      reasonCode: reasonCodes.at(-1) ?? latestReasonCode(local.record),
      evidenceRefs: local.evidenceRefs,
      isManualOrGovernance: local.record.manualSignals.some((signal) => signal.signalType === "MANUAL_REVIEW_RESULT" || signal.sourceType === "governance"),
    });
  }
}
export async function registerIdentityTree(input: RegisterIdentityTreeInput) {
  const store = await loadStore();
  const rootContainer = ensureRootContainer(store, input.rootIdentity);
  ensureIdentityRecord(store, { rootIdentity: input.rootIdentity });
  rootContainer.subIdentityIds = uniqueStrings([...rootContainer.subIdentityIds, ...input.subIdentities.map((item) => item.identityId)]);
  for (const subIdentity of input.subIdentities) ensureIdentityRecord(store, { rootIdentity: input.rootIdentity, subIdentity });
  await recomputeRootState(store, input.rootIdentity.identityId);
  await saveStore(store);
  return { rootIdentity: input.rootIdentity, subIdentities: input.subIdentities };
}

export async function createBindingChallengeRecord(input: { bindingType: BindingType; candidateAddress: Address; rootIdentityId: Hex; subIdentityId?: Hex }) {
  const store = await loadStore();
  const rootContainer = getRootContainerOrThrow(store, input.rootIdentityId);
  if (input.subIdentityId && !rootContainer.subIdentityIds.includes(input.subIdentityId)) throw new Error("Unknown sub identity for the provided root.");
  const challenge = createBindingChallenge({
    bindingType: input.bindingType,
    candidateAddress: getAddress(input.candidateAddress),
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
  });
  store.bindingChallenges[challenge.challengeId] = challenge;
  persistAudit(
    store,
    createAuditRecord({
      identityId: input.subIdentityId ?? input.rootIdentityId,
      rootIdentityId: input.rootIdentityId,
      subIdentityId: input.subIdentityId,
      action: "BINDING_CHALLENGE_CREATED",
      actor: "analyzer-service",
      evidenceRefs: [`challenge:${challenge.challengeHash}`],
      metadata: { bindingType: input.bindingType, candidateAddress: challenge.candidateAddress },
    }),
  );
  await saveStore(store);
  return challenge;
}

export async function submitBinding(input: SubmitBindingInput) {
  const store = await loadStore();
  const challenge = store.bindingChallenges[input.challengeId];
  if (!challenge) throw new Error(`Unknown binding challenge: ${input.challengeId}`);

  const rootContainer = getRootContainerOrThrow(store, challenge.rootIdentityId);
  const subRecord = challenge.subIdentityId ? getIdentityRecordOrThrow(store, challenge.subIdentityId) : undefined;
  const verification = await verifyBindingSubmission({
    challenge,
    candidateSignature: input.candidateSignature,
    rootIdentity: rootContainer.rootIdentity,
    subIdentity: subRecord?.subIdentity,
    linkProof: input.linkProof,
    sameRootProof: input.sameRootProof,
    authorizerAddress: input.authorizerAddress,
    authorizerSignature: input.authorizerSignature,
    activeBindings: Object.values(store.bindings).filter((binding) => binding.rootIdentityId === challenge.rootIdentityId),
  });

  const binding: BehaviorBinding = {
    bindingId: verification.bindingHash,
    type: challenge.bindingType,
    status: "ACTIVE",
    address: getAddress(challenge.candidateAddress),
    rootIdentityId: challenge.rootIdentityId,
    subIdentityId: challenge.subIdentityId,
    authorizerAddress: input.authorizerAddress ? getAddress(input.authorizerAddress) : undefined,
    createdAt: nowIso(),
    evidenceRefs: verification.evidenceRefs,
    bindingHash: verification.bindingHash,
    metadata: input.metadata,
  };
  store.bindings[binding.bindingId] = binding;
  delete store.bindingChallenges[input.challengeId];
  persistAudit(
    store,
    createAuditRecord({
      identityId: challenge.subIdentityId ?? challenge.rootIdentityId,
      rootIdentityId: challenge.rootIdentityId,
      subIdentityId: challenge.subIdentityId,
      action: "BINDING_CREATED",
      actor: binding.address,
      evidenceRefs: verification.evidenceRefs,
      metadata: { bindingId: binding.bindingId, bindingType: binding.type },
    }),
  );
  await saveStore(store);
  return binding;
}

async function performBackfillScan(store: AnalyzerStore, input: BackfillScanInput) {
  const rootIdentityId = resolveRootIdentityId(store, input);
  const latestBlock = input.toBlock ?? (await publicClient.getBlockNumber());
  const recentBlocks = BigInt(input.recentBlocks ?? analyzerConfig.defaultRecentBlocks);
  const fromBlock = input.fromBlock ?? (latestBlock > recentBlocks ? latestBlock - recentBlocks : 0n);
  const requestedRecord = input.identityId ? getIdentityRecordOrThrow(store, input.identityId) : undefined;
  const bindings = Object.values(store.bindings).filter((binding) => {
    if (binding.status !== "ACTIVE" || binding.rootIdentityId !== rootIdentityId) return false;
    if (!requestedRecord) return true;
    return requestedRecord.kind === "root" ? binding.rootIdentityId === requestedRecord.rootIdentity.identityId : binding.subIdentityId === requestedRecord.subIdentity?.identityId;
  });
  if (bindings.length === 0) throw new Error("No active bindings found for the requested identity scope.");

  const events = await collectBehaviorEvents({ publicClient, chainId: analyzerConfig.chainId, bindings, fromBlock, toBlock: latestBlock });
  let inserted = 0;
  for (const event of events) {
    if (store.events[event.eventId]) continue;
    store.events[event.eventId] = event;
    inserted += 1;
    persistAudit(
      store,
      createAuditRecord({
        identityId: event.subIdentityId ?? event.rootIdentityId,
        rootIdentityId: event.rootIdentityId,
        subIdentityId: event.subIdentityId,
        action: "BEHAVIOR_INGESTED",
        actor: "analyzer-service",
        ruleIds: [event.kind],
        evidenceRefs: event.evidenceRefs,
        metadata: { txHash: event.txHash, blockNumber: event.blockNumber.toString(), bindingId: event.bindingId },
      }),
    );
  }

  await recomputeRootState(store, rootIdentityId);
  return { rootIdentityId, fromBlock: fromBlock.toString(), toBlock: latestBlock.toString(), inserted, totalEvents: events.length };
}

function clearWatcherTimer(watchId: string) {
  const timer = watchTimers.get(watchId);
  if (timer) {
    clearInterval(timer);
    watchTimers.delete(watchId);
  }
}

function ensureWatcherTimer(watcher: AnalyzerWatcherRecord) {
  clearWatcherTimer(watcher.watchId);
  if (watcher.status !== "ACTIVE") {
    return;
  }
  const timer = setInterval(() => {
    void tickWatcher(watcher.watchId);
  }, watcher.pollIntervalMs);
  watchTimers.set(watcher.watchId, timer);
}

async function tickWatcher(watchId: string) {
  if (activeWatchTicks.has(watchId)) {
    return { watchId, skipped: true };
  }

  activeWatchTicks.add(watchId);
  try {
    let store = await loadStore();
    const watcher = store.watchers[watchId];
    if (!watcher || watcher.status !== "ACTIVE") {
      clearWatcherTimer(watchId);
      return { watchId, skipped: true };
    }

    watcher.lastScanStartedAt = nowIso();
    watcher.updatedAt = watcher.lastScanStartedAt;
    persistAudit(
      store,
      createAuditRecord({
        identityId: (watcher.identityId ?? watcher.rootIdentityId) as Hex,
        rootIdentityId: watcher.rootIdentityId as Hex,
        subIdentityId: watcher.identityId && watcher.identityId !== watcher.rootIdentityId ? (watcher.identityId as Hex) : undefined,
        action: "WATCH_UPDATED",
        actor: "analyzer-service",
        evidenceRefs: [],
        metadata: { watchId, status: watcher.status, phase: "scan_started" },
      }),
    );
    await saveStore(store);

    store = await loadStore();
    const activeWatcher = store.watchers[watchId];
    if (!activeWatcher || activeWatcher.status !== "ACTIVE") {
      clearWatcherTimer(watchId);
      return { watchId, skipped: true };
    }
    const scanResult = await performBackfillScan(store, {
      rootIdentityId: activeWatcher.rootIdentityId as Hex,
      identityId: activeWatcher.identityId as Hex | undefined,
      recentBlocks: activeWatcher.recentBlocks,
    });
    const completedAt = nowIso();
    activeWatcher.lastScanCompletedAt = completedAt;
    activeWatcher.updatedAt = completedAt;
    activeWatcher.lastError = undefined;
    persistAudit(
      store,
      createAuditRecord({
        identityId: (activeWatcher.identityId ?? activeWatcher.rootIdentityId) as Hex,
        rootIdentityId: activeWatcher.rootIdentityId as Hex,
        subIdentityId: activeWatcher.identityId && activeWatcher.identityId !== activeWatcher.rootIdentityId ? (activeWatcher.identityId as Hex) : undefined,
        action: "WATCH_UPDATED",
        actor: "analyzer-service",
        evidenceRefs: [],
        metadata: { watchId, status: activeWatcher.status, phase: "scan_completed", inserted: scanResult.inserted },
      }),
    );
    await saveStore(store);
    return { watchId, skipped: false, ...scanResult };
  } catch (error) {
    const store = await loadStore();
    const watcher = store.watchers[watchId];
    if (watcher) {
      watcher.lastError = error instanceof Error ? error.message : "Unknown watcher error";
      watcher.updatedAt = nowIso();
      persistAudit(
        store,
        createAuditRecord({
          identityId: (watcher.identityId ?? watcher.rootIdentityId) as Hex,
          rootIdentityId: watcher.rootIdentityId as Hex,
          subIdentityId: watcher.identityId && watcher.identityId !== watcher.rootIdentityId ? (watcher.identityId as Hex) : undefined,
          action: "WATCH_UPDATED",
          actor: "analyzer-service",
          evidenceRefs: [],
          metadata: { watchId, status: watcher.status, phase: "scan_failed", error: watcher.lastError },
        }),
      );
      await saveStore(store);
    }
    throw error;
  } finally {
    activeWatchTicks.delete(watchId);
  }
}

export async function initializeAnalyzerWatchers() {
  const store = await loadStore();
  for (const watcher of Object.values(store.watchers)) {
    ensureWatcherTimer(watcher);
  }
  return Object.keys(store.watchers).length;
}

export function shutdownAnalyzerWatchers() {
  for (const watchId of watchTimers.keys()) {
    clearWatcherTimer(watchId);
  }
}

export async function backfillScan(input: BackfillScanInput) {
  const store = await loadStore();
  const result = await performBackfillScan(store, input);
  await saveStore(store);
  return result;
}

export async function manageWatchScan(input: WatchScanInput) {
  const action = input.action ?? "refresh";
  if (action === "refresh") {
    return backfillScan({
      rootIdentityId: input.rootIdentityId,
      identityId: input.identityId,
      fromBlock: input.fromBlock,
      toBlock: input.toBlock,
      recentBlocks: input.recentBlocks ?? analyzerConfig.defaultRecentBlocks,
    });
  }

  const store = await loadStore();
  const rootIdentityId = resolveRootIdentityId(store, input);
  const watchId = watchIdFor({ rootIdentityId, identityId: input.identityId });
  const watcher = store.watchers[watchId] ?? {
    watchId,
    scope: input.identityId ? "identity" : "root",
    identityId: input.identityId,
    rootIdentityId,
    recentBlocks: input.recentBlocks ?? analyzerConfig.defaultRecentBlocks,
    pollIntervalMs: input.pollIntervalMs ?? 15_000,
    status: "STOPPED",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  } satisfies AnalyzerWatcherRecord;

  watcher.recentBlocks = input.recentBlocks ?? watcher.recentBlocks;
  watcher.pollIntervalMs = input.pollIntervalMs ?? watcher.pollIntervalMs;
  watcher.updatedAt = nowIso();
  watcher.status = action === "start" ? "ACTIVE" : "STOPPED";
  store.watchers[watchId] = watcher;
  persistAudit(
    store,
    createAuditRecord({
      identityId: (watcher.identityId ?? watcher.rootIdentityId) as Hex,
      rootIdentityId: watcher.rootIdentityId as Hex,
      subIdentityId: watcher.identityId && watcher.identityId !== watcher.rootIdentityId ? (watcher.identityId as Hex) : undefined,
      action: "WATCH_UPDATED",
      actor: "analyzer-service",
      evidenceRefs: [],
      metadata: { watchId, scope: watcher.scope, status: watcher.status, recentBlocks: watcher.recentBlocks, pollIntervalMs: watcher.pollIntervalMs },
    }),
  );
  await saveStore(store);

  if (watcher.status === "ACTIVE") {
    ensureWatcherTimer(watcher);
    const scanResult = await tickWatcher(watchId);
    const latestStore = await loadStore();
    return {
      watcher: latestStore.watchers[watchId] ?? watcher,
      scanResult,
      items: Object.values(latestStore.watchers).sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    };
  }

  clearWatcherTimer(watchId);
  const latestStore = await loadStore();
  return {
    watcher: latestStore.watchers[watchId] ?? watcher,
    items: Object.values(latestStore.watchers).sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
  };
}

export async function refreshWatchScan(input: { rootIdentityId?: Hex; identityId?: Hex; recentBlocks?: number }) {
  return manageWatchScan({ ...input, action: "refresh" });
}

export async function getWatchStatus(input: { rootIdentityId?: Hex; identityId?: Hex } = {}) {
  const store = await loadStore();
  const items = Object.values(store.watchers)
    .filter((watcher) => {
      if (input.identityId && watcher.identityId !== input.identityId) return false;
      if (input.rootIdentityId && watcher.rootIdentityId !== input.rootIdentityId) return false;
      return true;
    })
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  return { items };
}

export async function recomputeIdentity(input: { identityId: Hex }) {
  const store = await loadStore();
  const record = getIdentityRecordOrThrow(store, input.identityId);
  await recomputeRootState(store, record.rootIdentity.identityId);
  await saveStore(store);
  return getRiskContext(input.identityId);
}

export async function applyManualListAction(input: ManualListAction) {
  const store = await loadStore();
  const record = getIdentityRecordOrThrow(store, input.identityId);
  record.manualListActions.push(input);
  persistAudit(
    store,
    createAuditRecord({
      identityId: input.identityId,
      rootIdentityId: input.rootIdentityId,
      subIdentityId: input.subIdentityId,
      action: "LIST_UPDATED",
      actor: input.actor,
      evidenceRefs: input.evidenceRefs,
      metadata: { listName: input.listName, action: input.action, reasonCode: input.reasonCode },
    }),
  );
  await recomputeRootState(store, record.rootIdentity.identityId);
  await saveStore(store);
  return getRiskContext(input.identityId);
}
export async function confirmReview(reviewItemId: string, input: ReviewConfirmationInput) {
  const store = await loadStore();
  const reviewItem = store.reviewQueue[reviewItemId];
  if (!reviewItem) throw new Error(`Unknown review item: ${reviewItemId}`);
  if (reviewItem.status !== "PENDING_REVIEW") throw new Error(`Review item ${reviewItemId} is not pending.`);
  const suggestion = store.aiSuggestions[reviewItem.sourceSuggestionId];
  if (!suggestion) throw new Error(`Missing source suggestion for review item ${reviewItemId}.`);
  const record = getIdentityRecordOrThrow(store, reviewItem.identityId);
  reviewItem.status = "CONFIRMED_SIGNAL";
  reviewItem.confirmedAt = nowIso();
  reviewItem.confirmedBy = input.actor;
  reviewItem.reason = input.note;

  const requestedState = input.requestedState ?? (suggestion.severity === "high" ? IdentityState.RESTRICTED : IdentityState.OBSERVED);
  record.manualSignals.push(
    createManualSignal({
      identityId: reviewItem.identityId,
      rootIdentityId: reviewItem.rootIdentityId,
      subIdentityId: reviewItem.subIdentityId,
      requestedState,
      reasonCode: input.reasonCode ?? "AI_CONFIRMED_SIGNAL",
      actor: input.actor,
      evidenceRefs: uniqueStrings([...reviewItem.evidenceRefs, ...suggestion.evidenceRefs]),
      note: input.note ?? suggestion.summary,
      category: "negative",
      severity: suggestion.severity === "high" ? "high" : suggestion.severity === "medium" ? "medium" : "low",
      sourceSuggestionId: suggestion.id,
    }),
  );
  persistAudit(store, createAuditRecord({ identityId: reviewItem.identityId, rootIdentityId: reviewItem.rootIdentityId, subIdentityId: reviewItem.subIdentityId, action: "AI_REVIEW_ITEM_CONFIRMED", actor: input.actor, evidenceRefs: reviewItem.evidenceRefs, aiSuggestionId: suggestion.id, reviewItemId }));
  persistAudit(store, createAuditRecord({ identityId: reviewItem.identityId, rootIdentityId: reviewItem.rootIdentityId, subIdentityId: reviewItem.subIdentityId, action: "CONFIRMED_SIGNAL_CREATED", actor: input.actor, ruleIds: [input.reasonCode ?? "AI_CONFIRMED_SIGNAL"], evidenceRefs: uniqueStrings([...reviewItem.evidenceRefs, ...suggestion.evidenceRefs]), aiSuggestionId: suggestion.id, reviewItemId }));
  await recomputeRootState(store, reviewItem.rootIdentityId);
  await saveStore(store);
  return getRiskContext(reviewItem.identityId);
}

export async function dismissReview(reviewItemId: string, actor: string, reason?: string) {
  const store = await loadStore();
  const reviewItem = store.reviewQueue[reviewItemId];
  if (!reviewItem) throw new Error(`Unknown review item: ${reviewItemId}`);
  reviewItem.status = "DISMISSED";
  reviewItem.dismissedAt = nowIso();
  reviewItem.dismissedBy = actor;
  reviewItem.reason = reason;
  persistAudit(store, createAuditRecord({ identityId: reviewItem.identityId, rootIdentityId: reviewItem.rootIdentityId, subIdentityId: reviewItem.subIdentityId, action: "AI_REVIEW_ITEM_DISMISSED", actor, evidenceRefs: reviewItem.evidenceRefs, aiSuggestionId: reviewItem.sourceSuggestionId, reviewItemId, metadata: { reason } }));
  await saveStore(store);
  return getRiskContext(reviewItem.identityId);
}

export async function applyManualRelease(input: ManualReleaseInput) {
  const store = await loadStore();
  const record = getIdentityRecordOrThrow(store, input.identityId);
  const currentState = record.riskRecord?.storedState ?? record.stateContext?.currentState ?? IdentityState.NORMAL;
  const manualReleaseWindow = buildManualReleaseWindow({ releasedAt: nowIso(), currentState });
  record.manualReleaseWindow = manualReleaseWindow;
  record.manualSignals.push(createManualSignal({ identityId: input.identityId, rootIdentityId: record.rootIdentity.identityId, subIdentityId: record.subIdentity?.identityId, requestedState: manualReleaseWindow.floorState, reasonCode: input.reasonCode, actor: input.actor, evidenceRefs: input.evidenceRefs, note: input.note, category: "positive", severity: "positive" }));
  persistAudit(store, createAuditRecord({ identityId: input.identityId, rootIdentityId: record.rootIdentity.identityId, subIdentityId: record.subIdentity?.identityId, action: "MANUAL_RELEASE_APPLIED", actor: input.actor, ruleIds: [input.reasonCode], evidenceRefs: input.evidenceRefs, metadata: { releasedFrom: IdentityState[currentState], floorState: IdentityState[manualReleaseWindow.floorState], floorUntil: manualReleaseWindow.floorUntil } }));
  await recomputeRootState(store, record.rootIdentity.identityId);
  await saveStore(store);
  return getRiskContext(input.identityId);
}

export async function flushAnchorQueue(input: { identityId?: Hex } = {}) {
  const store = await loadStore();
  const entries = Object.values(store.anchorQueue).filter((entry) => entry.status === "PENDING" && (!input.identityId || entry.identityId === input.identityId)).sort((a, b) => a.anchorSeq - b.anchorSeq);
  if (analyzerConfig.stateRegistryAddress === ZERO_ADDRESS) {
    return { synced: 0, skipped: entries.length, failed: 0, entries: entries.map((entry) => ({ anchorId: entry.anchorId, status: "SKIPPED" })) };
  }

  const results: Array<{ anchorId: string; status: string; transactionHash?: Hex; error?: string }> = [];
  for (const entry of entries) {
    try {
      let hash: Hex;
      try {
        hash = await walletClient.writeContract({
          chain: undefined,
          address: analyzerConfig.stateRegistryAddress,
          abi: anchorRegistryAbi,
          functionName: "setStateWithAnchorHashes",
          args: [entry.identityId, entry.storedState, entry.reasonCode, BigInt(entry.policyVersion), entry.stateHash, entry.evidenceBundleHash, entry.stateHash, entry.evidenceBundleHash],
        });
      } catch {
        try {
          hash = await walletClient.writeContract({
            chain: undefined,
            address: analyzerConfig.stateRegistryAddress,
            abi: anchorRegistryAbi,
            functionName: "setStateWithAnchors",
            args: [entry.identityId, entry.storedState, entry.reasonCode, BigInt(entry.policyVersion), entry.stateHash, entry.evidenceBundleHash],
          });
        } catch {
          hash = await walletClient.writeContract({
            chain: undefined,
            address: analyzerConfig.stateRegistryAddress,
            abi: anchorRegistryAbi,
            functionName: "setState",
            args: [entry.identityId, entry.storedState, entry.reasonCode, BigInt(entry.policyVersion)],
          });
        }
      }
      await publicClient.waitForTransactionReceipt({ hash });
      entry.status = "SYNCED";
      entry.syncedAt = nowIso();
      entry.transactionHash = hash;
      const record = getIdentityRecordOrThrow(store, entry.identityId);
      if (record.riskRecord) {
        record.riskRecord.anchoredState = entry.effectiveState;
        record.riskRecord.anchoredStateHash = entry.stateHash;
        record.riskRecord.lastEvidenceBundleHash = entry.evidenceBundleHash;
      }
      persistAudit(store, createAuditRecord({ identityId: entry.identityId, rootIdentityId: entry.rootIdentityId, subIdentityId: entry.subIdentityId, action: "ANCHOR_SYNCED", actor: analyzerConfig.riskManagerAccount.address, evidenceRefs: [`tx:${hash}`, `stateHash:${entry.stateHash}`, `evidenceBundleHash:${entry.evidenceBundleHash}`], metadata: { anchorId: entry.anchorId } }));
      results.push({ anchorId: entry.anchorId, status: entry.status, transactionHash: hash });
    } catch (error) {
      entry.status = "FAILED";
      entry.error = error instanceof Error ? error.message : "Unknown anchor failure";
      results.push({ anchorId: entry.anchorId, status: entry.status, error: entry.error });
    }
  }
  await saveStore(store);
  return { synced: results.filter((item) => item.status === "SYNCED").length, skipped: results.filter((item) => item.status === "SKIPPED").length, failed: results.filter((item) => item.status === "FAILED").length, entries: results };
}

export async function getRiskContext(identityId: Hex) {
  const store = await loadStore();
  const record = getIdentityRecordOrThrow(store, identityId);
  const rootIdentityId = record.rootIdentity.identityId;
  const rootContainer = getRootContainerOrThrow(store, rootIdentityId);
  const reviewQueue = getReviewsForIdentity(store, identityId);
  const summary = record.summary
    ? {
        ...record.summary,
        manualReleaseWindow: record.manualReleaseWindow ?? null,
        activeManualOverrides: summarizeActiveManualOverrides(record),
        watchStatus: summarizeWatchStatus(store, identityId),
        reviewQueueCounts: summarizeReviewQueueCounts(reviewQueue),
      }
    : null;
  return {
    identityId,
    kind: record.kind,
    rootIdentity: record.rootIdentity,
    subIdentity: record.subIdentity ?? null,
    riskRecord: record.riskRecord ?? null,
    summary,
    score: record.score ?? null,
    stateContext: record.stateContext ?? null,
    signals: record.signals,
    manualSignals: record.manualSignals,
    listEntries: record.listEntries,
    bindings: getBindingsForIdentity(store, identityId),
    aiSuggestions: getSuggestionsForIdentity(store, identityId),
    reviewQueue,
    anchors: getAnchorsForIdentity(store, identityId),
    audit: getAuditForIdentity(store, identityId),
    subtree: record.kind === "root" ? rootContainer.subIdentityIds.map((subIdentityId) => {
      const subRecord = store.identities[subIdentityId];
      return { identityId: subIdentityId, scope: subRecord?.subIdentity?.scope, type: subRecord?.subIdentity?.type, storedState: subRecord?.summary?.storedState, effectiveState: subRecord?.summary?.effectiveState, warnings: subRecord?.summary?.warnings ?? [], reasonCodes: subRecord?.summary?.reasonCodes ?? [] };
    }) : undefined,
  };
}

export async function getIdentityEvents(identityId: Hex) {
  const store = await loadStore();
  return getEventsForIdentity(store, identityId);
}
export async function exportIdentityAudit(identityId: Hex) {
  const store = await loadStore();
  return exportAuditBundle(Object.values(store.audits), identityId);
}
export async function listReviewQueue(identityId?: Hex) {
  const store = await loadStore();
  return Object.values(store.reviewQueue).filter((item) => !identityId || item.identityId === identityId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

