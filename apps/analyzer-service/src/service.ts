
import {
  type ApprovalTicket,
  assertAuditExportConsistency,
  assertRiskContextExplainability,
  buildConfiguredPositiveSignals,
  buildAutomaticRecoverySignals,
  buildPolicyDecisionExplanation,
  buildPropagationExplanation,
  buildRecoveryProgressSummary,
  buildReviewQueueExplanation,
  buildRiskListHistoryExplanation,
  buildRiskSummaryExplanation,
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
  filterAuditByWindow,
  generateAiSuggestions,
  getOpenReviewItems,
  getRegistryVersion,
  getRuleDefinition,
  normalizeAuditExportBundle,
  queueSuggestionForReview,
  replaySignalTimeline,
  shouldAnchorState,
  summarizeLists,
  verifyBindingSubmission,
  type AuditExportBundle,
  type AiSuggestion,
  type BehaviorBinding,
  type BindingType,
  type ManualListAction,
  type OperatorDashboardSnapshot,
  type PolicyDecisionKind,
  type PolicyDecisionRecord,
  type PolicyModePath,
  type ReplayTrace,
  type RiskListHistoryItem,
  type RiskSignal,
  type RiskSummary,
  type ReviewQueueCounts,
  type DiffReport,
  type WatchStatusSummary,
} from "../../../packages/risk/src/index.js";
import {
  SubIdentityType,
  SUBJECT_AGGREGATE_SCHEMA_VERSION,
  createVersionEnvelope,
  normalizeControllerRef,
  type BreakGlassAction,
  type ChainControllerRef,
  type RecoveryAction,
  type RecoveryApprovalTicket,
  type RecoveryCase,
  type RootIdentity,
  type SameRootProof,
  type SubjectAggregate,
  type SubIdentity,
  type SubIdentityLinkProof,
} from "../../../packages/identity/src/index.js";
import {
  IdentityState,
  buildCrossChainStateMessageV2,
  buildStateSnapshotV2,
  createCrossChainConsumptionTrace,
  createCrossChainInboxItem,
  createRiskSignal,
  getActiveConsequences,
  verifyCrossChainStateMessageV2,
  withAuditBundleVersion,
  type CrossChainConsumptionTrace,
  type CrossChainInboxItem,
  type CrossChainStateMessageV2,
  type IdentityStateContext,
  type RiskSignalInput,
} from "../../../packages/state/src/index.js";
import { createPublicClient, createWalletClient, getAddress, http, keccak256, stringToHex, type Address, type Hex } from "viem";
import { analyzerConfig } from "./config.js";
import { loadStore, saveStore, type AnalyzerIdentityRecord, type AnalyzerStore, type AnalyzerWatcherRecord, type OperationReceipt, type WebhookOutboxItem } from "./store.js";

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
export type CreateSubjectAggregateInput = {
  subjectAggregateId?: string;
  actor?: string;
  evidenceRefs?: string[];
  auditBundleRef?: string;
  status?: SubjectAggregate["status"];
};
export type SubmitBindingInput = {
  challengeId: string;
  candidateSignature: string;
  linkProof?: SubIdentityLinkProof;
  sameRootProof?: SameRootProof;
  authorizerAddress?: Address;
  authorizerSignature?: string;
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
export type AuditExportInput = {
  identityId?: Hex;
  rootIdentityId?: Hex;
  subIdentityId?: Hex;
  from?: string;
  to?: string;
  policyId?: string;
  policyKind?: PolicyDecisionKind;
};
export type RiskListHistoryInput = {
  identityId?: Hex;
  rootIdentityId?: Hex;
  subIdentityId?: Hex;
  listName?: "watchlist" | "restricted_list" | "blacklist_or_frozen_list";
  action?: RiskListHistoryItem["action"];
  from?: string;
  to?: string;
};
export type PolicyDecisionSnapshotInput = {
  kind: PolicyDecisionKind;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  policyId: string;
  policyLabel: string;
  policyVersion: number;
  modePath: PolicyModePath;
  decision: PolicyDecisionRecord["decision"];
  reasons: string[];
  warnings: string[];
  evidenceRefs: string[];
  auditRecordIds?: string[];
  createdAt?: string;
  explanation?: PolicyDecisionRecord["explanation"];
};
export type RecoveryCaseInput = {
  rootIdentityId: Hex;
  targetIdentityId?: Hex;
  targetSubIdentityId?: Hex;
  action: RecoveryAction;
  requestedBy: string;
  scope: "selected_sub_identity" | "capability" | "consequence" | "access_path";
  breakGlassAction?: BreakGlassAction;
  idempotencyKey?: string;
};
export type RecoveryEvidenceInput = {
  caseId: string;
  actor: string;
  actorRole: "requester" | "guardian" | "operator" | "governance_reviewer" | "auditor";
  kind: "binding_proof" | "guardian_attestation" | "policy_basis" | "audit_ref" | "manual_note";
  summary: string;
  evidenceRefs: string[];
  idempotencyKey?: string;
};
export type RecoveryDecisionInput = {
  caseId: string;
  actor: string;
  actorRole: "guardian" | "operator" | "governance_reviewer" | "auditor";
  outcome: "approved" | "rejected" | "revoked";
  reasonCode: string;
  explanation: string;
  evidenceRefs: string[];
  idempotencyKey?: string;
};
export type RecoveryExecutionInput = {
  caseId: string;
  actor: string;
  action: RecoveryAction;
  breakGlassAction?: BreakGlassAction;
  idempotencyKey?: string;
};
export type CrossChainMessageCreateInput = {
  identityId: Hex;
  targetChainId: number;
  sourceDomain?: string;
  targetDomain?: string;
  ttlSeconds?: number;
  consumerPolicyHint?: CrossChainStateMessageV2["consumerPolicyHint"];
  idempotencyKey?: string;
};
export type CrossChainMessageIngestInput = {
  message: CrossChainStateMessageV2;
  idempotencyKey?: string;
};
export type CrossChainMessageConsumeInput = {
  inboxId: string;
  actor: string;
  effect?: CrossChainConsumptionTrace["effect"];
  idempotencyKey?: string;
};
export type ApprovalTicketInput = {
  action: ApprovalTicket["action"];
  rootIdentityId: Hex;
  identityId?: Hex;
  requiredRoles: ApprovalTicket["requiredRoles"];
  requiredApprovals: number;
  reasonCode: string;
  explanation: string;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  idempotencyKey?: string;
};
export type ApprovalDecisionInput = {
  ticketId: string;
  actor: string;
  decision: "approve" | "reject" | "cancel";
  idempotencyKey?: string;
};

function nowIso() { return new Date().toISOString(); }
function uniqueStrings(values: string[]) { return [...new Set(values.filter(Boolean))]; }
function strongerState(left: IdentityState, right: IdentityState) { return Number(left) >= Number(right) ? left : right; }
function defaultInitialStateForSub(subIdentity?: SubIdentity) { return subIdentity?.type === SubIdentityType.ANONYMOUS_LOWRISK ? IdentityState.OBSERVED : IdentityState.NORMAL; }
function toBytes32(value?: string) {
  if (!value) return `0x${"0".repeat(64)}` as Hex;
  return (value.startsWith("0x") && value.length === 66 ? value : keccak256(stringToHex(value))) as Hex;
}

function controllerIndexKey(controllerRef: Pick<ChainControllerRef, "chainFamily" | "networkId" | "normalizedAddress">) {
  return `${controllerRef.chainFamily}:${controllerRef.networkId}:${controllerRef.normalizedAddress.toLowerCase()}`;
}

function sanitizeRegisteredRootIdentity(store: AnalyzerStore, rootIdentity: RootIdentity) {
  const aggregateId = rootIdentity.subjectAggregateId;
  if (!aggregateId) {
    return rootIdentity;
  }
  const activeAggregateBinding = Object.values(store.bindings).find(
    (binding) =>
      binding.status === "ACTIVE" &&
      binding.type === "subject_aggregate_link" &&
      binding.rootIdentityId === rootIdentity.identityId &&
      binding.subjectAggregateId === aggregateId,
  );
  if (activeAggregateBinding) {
    return rootIdentity;
  }
  return {
    ...rootIdentity,
    subjectAggregateId: undefined,
  };
}

function ensureRootContainer(store: AnalyzerStore, rootIdentity: RootIdentity) {
  const sanitizedRoot = sanitizeRegisteredRootIdentity(store, rootIdentity);
  const existing = store.roots[sanitizedRoot.identityId] ?? { rootIdentity: sanitizedRoot, subIdentityIds: [] };
  existing.rootIdentity = sanitizedRoot;
  store.roots[sanitizedRoot.identityId] = existing;
  return existing;
}

function ensureIdentityRecord(store: AnalyzerStore, input: { rootIdentity: RootIdentity; subIdentity?: SubIdentity }): AnalyzerIdentityRecord {
  const sanitizedRoot = sanitizeRegisteredRootIdentity(store, input.rootIdentity);
  const identityId = input.subIdentity?.identityId ?? sanitizedRoot.identityId;
  const existing = store.identities[identityId];
  if (existing) {
    existing.kind = input.subIdentity ? "sub" : "root";
    existing.rootIdentity = sanitizedRoot;
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
    rootIdentity: sanitizedRoot,
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
function setRootSubjectAggregate(store: AnalyzerStore, rootIdentityId: Hex, subjectAggregateId?: string) {
  const rootContainer = getRootContainerOrThrow(store, rootIdentityId);
  rootContainer.rootIdentity = {
    ...rootContainer.rootIdentity,
    subjectAggregateId,
  };
  const rootRecord = store.identities[rootIdentityId];
  if (rootRecord) {
    rootRecord.rootIdentity = rootContainer.rootIdentity;
  }
  for (const subIdentityId of rootContainer.subIdentityIds) {
    const subRecord = store.identities[subIdentityId];
    if (subRecord) {
      subRecord.rootIdentity = rootContainer.rootIdentity;
    }
  }
}
function getSubjectAggregateOrThrow(store: AnalyzerStore, subjectAggregateId: string) {
  const subjectAggregate = store.subjectAggregates[subjectAggregateId];
  if (!subjectAggregate) {
    throw new Error(`Unknown subject aggregate: ${subjectAggregateId}`);
  }
  return subjectAggregate;
}
function summarizeSubjectAggregate(store: AnalyzerStore, subjectAggregateId: string) {
  const subjectAggregate = getSubjectAggregateOrThrow(store, subjectAggregateId);
  return {
    ...subjectAggregate,
    rootSummaries: subjectAggregate.linkedRootIds.map((rootIdentityId) => {
      const rootRecord = store.identities[rootIdentityId];
      return {
        rootIdentityId,
        storedState: rootRecord?.summary?.storedState ?? null,
        effectiveState: rootRecord?.summary?.effectiveState ?? null,
        reasonCodes: rootRecord?.summary?.reasonCodes ?? [],
        warnings: rootRecord?.summary?.warnings ?? [],
      };
    }),
    linkedBindings: Object.values(store.bindings).filter(
      (binding) => binding.type === "subject_aggregate_link" && binding.status === "ACTIVE" && binding.subjectAggregateId === subjectAggregateId,
    ).map((binding) => ({
      bindingId: binding.bindingId,
      rootIdentityId: binding.rootIdentityId,
      proofHash: binding.proofHash ?? null,
      challengeHash: binding.challengeHash ?? null,
      createdAt: binding.createdAt,
    })),
  };
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
function getStoredReceipt(store: AnalyzerStore, idempotencyKey?: string) {
  if (!idempotencyKey) return undefined;
  return store.operationReceipts[idempotencyKey];
}
function storeReceipt(store: AnalyzerStore, receipt: OperationReceipt) {
  store.operationReceipts[receipt.idempotencyKey] = receipt;
}
function queueWebhookEvent(store: AnalyzerStore, topic: string, payload: Record<string, unknown>, createdAt = nowIso()) {
  const event: WebhookOutboxItem = {
    eventId: keccak256(stringToHex([topic, createdAt, JSON.stringify(payload)].join(":"))),
    topic,
    status: "PENDING",
    attemptCount: 0,
    payload,
    createdAt,
  };
  store.webhookOutbox[event.eventId] = event;
  return event;
}
function createApprovalTicketRecord(input: ApprovalTicketInput): ApprovalTicket {
  const createdAt = nowIso();
  return {
    ticketId: keccak256(stringToHex([input.action, input.rootIdentityId, input.identityId ?? input.rootIdentityId, createdAt].join(":"))),
    action: input.action,
    rootIdentityId: input.rootIdentityId,
    identityId: input.identityId,
    requiredRoles: input.requiredRoles,
    requiredApprovals: input.requiredApprovals,
    approvedBy: [],
    status: "pending",
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
    reasonCode: input.reasonCode,
    explanation: input.explanation,
    createdAt,
    updatedAt: createdAt,
    versionEnvelope: createVersionEnvelope(),
  };
}
function createRecoveryApprovalTickets(caseId: string, ticket: ApprovalTicket): RecoveryApprovalTicket[] {
  return ticket.requiredRoles.map((requiredRole, index) => ({
    ticketId: `${ticket.ticketId}:${index + 1}`,
    caseId,
    rootIdentityId: ticket.rootIdentityId,
    requiredRole: requiredRole === "governance_reviewer" ? "governance_reviewer" : "operator",
    requiredApprovals: 1,
    approvedBy: [],
    status: ticket.status === "cancelled" ? "rejected" : ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    versionEnvelope: ticket.versionEnvelope,
  }));
}
function ensureAllowedBreakGlassAction(action?: BreakGlassAction) {
  if (!action) return;
  if (action !== "queue_unblock" && action !== "temporary_release" && action !== "consequence_rollback") {
    throw new Error("Phase4 break-glass is limited to queue_unblock, temporary_release, and consequence_rollback.");
  }
}
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
      item.explanation = buildReviewQueueExplanation({
        reviewItemId: item.reviewItemId,
        status: item.status,
        evidenceRefs: item.evidenceRefs,
        sourceSuggestionId: item.sourceSuggestionId,
      });
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
function getPolicyDecisionsForIdentity(store: AnalyzerStore, identityId: Hex) {
  return Object.values(store.policyDecisions)
    .filter((item) => item.identityId === identityId || item.rootIdentityId === identityId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
function resolveAuditIdentityIds(store: AnalyzerStore, input: AuditExportInput) {
  if (input.subIdentityId) {
    return [input.subIdentityId];
  }
  if (input.identityId) {
    const record = getIdentityRecordOrThrow(store, input.identityId);
    if (record.kind === "root") {
      const root = getRootContainerOrThrow(store, input.identityId);
      return [input.identityId, ...root.subIdentityIds.map((item) => item as Hex)];
    }
    return [input.identityId];
  }
  if (input.rootIdentityId) {
    const root = getRootContainerOrThrow(store, input.rootIdentityId);
    return [input.rootIdentityId, ...root.subIdentityIds.map((item) => item as Hex)];
  }
  return Object.keys(store.identities).map((item) => item as Hex);
}
function summarizePropagation(record: AnalyzerIdentityRecord): RiskSummary["propagation"] {
  return record.summary?.propagation;
}
function buildRiskListHistory(record: AnalyzerIdentityRecord, now = nowIso()) {
  const items: RiskListHistoryItem[] = [];
  for (const entry of record.listEntries) {
    items.push({
      itemId: `${entry.entryId}:added`,
      entryId: entry.entryId,
      identityId: entry.identityId,
      rootIdentityId: entry.rootIdentityId,
      subIdentityId: entry.subIdentityId,
      listName: entry.listName,
      state: entry.state,
      action: entry.addedBy === "risk-engine" || entry.addedBy === "ai-assistant" ? "auto_added" : "manually_added",
      timestamp: entry.addedAt,
      reasonCode: entry.reasonCode,
      actor: entry.addedBy,
      evidenceRefs: entry.evidenceRefs,
      expiresAt: entry.expiresAt,
      sourceDecisionId: entry.sourceDecisionId,
      explanation: buildRiskListHistoryExplanation({
        reasonCode: entry.reasonCode,
        action: entry.addedBy === "risk-engine" || entry.addedBy === "ai-assistant" ? "auto_added" : "manually_added",
        listName: entry.listName,
        evidenceRefs: entry.evidenceRefs,
        sourceDecisionId: entry.sourceDecisionId,
        actor: entry.addedBy,
      }),
    });
    if (entry.removedAt) {
      items.push({
        itemId: `${entry.entryId}:removed`,
        entryId: entry.entryId,
        identityId: entry.identityId,
        rootIdentityId: entry.rootIdentityId,
        subIdentityId: entry.subIdentityId,
        listName: entry.listName,
        state: entry.state,
        action: "removed",
        timestamp: entry.removedAt,
        reasonCode: entry.removalReason ?? entry.reasonCode,
        actor: entry.addedBy,
        evidenceRefs: entry.evidenceRefs,
        removalReason: entry.removalReason,
        sourceDecisionId: entry.sourceDecisionId,
        explanation: buildRiskListHistoryExplanation({
          reasonCode: entry.removalReason ?? entry.reasonCode,
          action: "removed",
          listName: entry.listName,
          evidenceRefs: entry.evidenceRefs,
          sourceDecisionId: entry.sourceDecisionId,
          actor: entry.addedBy,
        }),
      });
    } else if (entry.expiresAt && Date.parse(entry.expiresAt) <= Date.parse(now)) {
      items.push({
        itemId: `${entry.entryId}:expired`,
        entryId: entry.entryId,
        identityId: entry.identityId,
        rootIdentityId: entry.rootIdentityId,
        subIdentityId: entry.subIdentityId,
        listName: entry.listName,
        state: entry.state,
        action: "expired",
        timestamp: entry.expiresAt,
        reasonCode: entry.reasonCode,
        actor: entry.addedBy,
        evidenceRefs: entry.evidenceRefs,
        expiresAt: entry.expiresAt,
        sourceDecisionId: entry.sourceDecisionId,
        explanation: buildRiskListHistoryExplanation({
          reasonCode: entry.reasonCode,
          action: "expired",
          listName: entry.listName,
          evidenceRefs: entry.evidenceRefs,
          sourceDecisionId: entry.sourceDecisionId,
          actor: entry.addedBy,
        }),
      });
    }
  }
  return items.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

async function computeLocalRecord(store: AnalyzerStore, record: AnalyzerIdentityRecord, now = nowIso()): Promise<LocalComputation> {
  const identityId = (record.subIdentity?.identityId ?? record.rootIdentity.identityId) as Hex;
  const events = getEventsForIdentity(store, identityId);
  const rootIdentityId = record.rootIdentity.identityId;
  const subIdentityId = record.subIdentity?.identityId;
  const score = buildScoreBreakdown({ identityId, rootIdentityId, subIdentityId, events, now });
  const deterministicSignals = buildDeterministicSignals({ rootIdentityId, subIdentityId, events, score, now });
  const baseSignals = mergeSignals(deterministicSignals, record.manualSignals);
  const positiveSignals = buildConfiguredPositiveSignals({
    identityId,
    rootIdentityId,
    subIdentityId,
    signals: baseSignals,
    score,
    now,
  });
  const preRecoverySignals = mergeSignals(baseSignals, positiveSignals);
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
  propagation?: RiskSummary["propagation"];
  now: string;
}) {
  const previousRiskRecord = input.record.riskRecord;
  const previousScore = input.record.score;
  const previousListSignature = (input.record.listEntries ?? []).map((entry) => `${entry.entryId}:${entry.removedAt ?? "active"}`).join("|");
  const nextListSignature = input.listEntries.map((entry) => `${entry.entryId}:${entry.removedAt ?? "active"}`).join("|");
  const summaryReasonCodes = uniqueStrings(input.reasonCodes);
  const summaryWarnings = uniqueStrings([...input.warnings, ...input.aiSuggestions.map((suggestion) => suggestion.summary)]);
  const summaryEvidenceRefs = uniqueStrings(input.evidenceRefs);
  const latestAssessmentId = input.stateContext.assessments.at(-1)?.assessmentId ?? null;
  const latestDecisionId = input.stateContext.decisions.at(-1)?.decisionId ?? input.stateContext.lastDecisionRef ?? null;
  const positiveSummary = {
    ...buildRecoveryProgressSummary({
      signals: input.stateContext.signals as RiskSignal[],
      consequences: input.stateContext.consequences,
      manualReleaseWindow: input.record.manualReleaseWindow ?? null,
      now: input.now,
    }),
  };
  const activePositiveSummary = getActiveConsequences(input.stateContext.consequences, input.now);

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
    reasonCodes: summaryReasonCodes,
    warnings: summaryWarnings,
    evidenceRefs: summaryEvidenceRefs,
    ...summarizeLists(input.listEntries),
    manualReleaseWindow: input.record.manualReleaseWindow ?? null,
    activeManualOverrides: summarizeActiveManualOverrides(input.record, input.now),
    watchStatus: summarizeWatchStatus(input.store, input.identityId),
    reviewQueueCounts: summarizeReviewQueueCounts(getReviewsForIdentity(input.store, input.identityId)),
    positiveSummary: {
      activePositiveSignals: input.stateContext.signals.filter((signal) => signal.category === "positive") as RiskSignal[],
      activeUnlocks: activePositiveSummary.filter((consequence) =>
        ["trust_boost", "limit_relaxation", "access_unlock", "reputation_badge"].includes(consequence.consequenceType),
      ),
      activeRestrictions: activePositiveSummary.filter((consequence) =>
        ["warn", "limit", "freeze", "review_required", "trust_decrease"].includes(consequence.consequenceType),
      ),
      demoDefaults: true,
    },
    recoveryProgress: positiveSummary,
    propagation: input.propagation
      ? {
          ...input.propagation,
          explanation: input.propagation.explanation ?? buildPropagationExplanation({
            reasonCodes: input.propagation.reasonCodes,
            warnings: input.propagation.warnings,
            evidenceRefs: summaryEvidenceRefs,
            sourceDecisionId: latestDecisionId,
            sourceRegistryVersion: getRegistryVersion(),
          }),
        }
      : undefined,
    explanation: buildRiskSummaryExplanation({
      summary: {
        storedState: input.storedState,
        effectiveState: input.effectiveState,
        reasonCodes: summaryReasonCodes,
        evidenceRefs: summaryEvidenceRefs,
      },
      sourceAssessmentId: latestAssessmentId,
      sourceDecisionId: latestDecisionId,
      sourceRegistryVersion: getRegistryVersion(),
      actorType: "system",
      actorId: "analyzer-service",
      aiContribution: input.aiSuggestions.length > 0,
      manualOverride: input.record.manualSignals.some((signal) => signal.signalType === "MANUAL_REVIEW_RESULT" || signal.sourceType === "governance"),
    }),
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
  const rootSummaryReasonCodes = uniqueStrings(rootReasonCodes);
  const rootSummaryEvidenceRefs = uniqueStrings(rootEvidenceRefs);
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
      reasonCodes: rootSummaryReasonCodes,
      warnings: rootWarnings,
      evidenceRefs: rootSummaryEvidenceRefs,
      watchlist: [],
      restrictedList: [],
      blacklistOrFrozenList: [],
      explanation: buildRiskSummaryExplanation({
        summary: {
          storedState: rootStoredState,
          effectiveState: rootStoredState,
          reasonCodes: rootSummaryReasonCodes,
          evidenceRefs: rootSummaryEvidenceRefs,
        },
        sourceAssessmentId: rootLocal.stateContext.assessments.at(-1)?.assessmentId ?? null,
        sourceDecisionId: rootLocal.stateContext.decisions.at(-1)?.decisionId ?? rootLocal.stateContext.lastDecisionRef ?? null,
        sourceRegistryVersion: getRegistryVersion(),
        actorType: "system",
        actorId: "analyzer-service",
      }),
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
    reasonCodes: rootSummaryReasonCodes,
    warnings: rootWarnings,
    evidenceRefs: rootSummaryEvidenceRefs,
    aiSuggestions: rootAiSuggestions,
    listEntries: rootListEntries,
    propagation: {
      reasonCodes: rootSummaryReasonCodes,
      warnings: rootWarnings,
      explanation: buildPropagationExplanation({
        reasonCodes: rootSummaryReasonCodes,
        warnings: rootWarnings,
        evidenceRefs: rootSummaryEvidenceRefs,
        sourceDecisionId: rootLocal.stateContext.decisions.at(-1)?.decisionId ?? rootLocal.stateContext.lastDecisionRef ?? null,
        sourceRegistryVersion: getRegistryVersion(),
      }),
    },
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
        explanation: buildRiskSummaryExplanation({
          summary: {
            storedState: local.storedState,
            effectiveState,
            reasonCodes,
            evidenceRefs: local.evidenceRefs,
          },
          sourceAssessmentId: local.stateContext.assessments.at(-1)?.assessmentId ?? null,
          sourceDecisionId: local.stateContext.decisions.at(-1)?.decisionId ?? local.stateContext.lastDecisionRef ?? null,
          sourceRegistryVersion: getRegistryVersion(),
          actorType: "system",
          actorId: "analyzer-service",
        }),
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
      propagation: {
        reasonCodes: subPropagationReasons.get(local.identityId) ?? [],
        warnings,
        siblingOverlayState,
        rootEffectiveFloorState: effectiveState > overlayedLocalState ? effectiveState : undefined,
        explanation: buildPropagationExplanation({
          reasonCodes: subPropagationReasons.get(local.identityId) ?? [],
          warnings,
          evidenceRefs: local.evidenceRefs,
          sourceDecisionId: local.stateContext.decisions.at(-1)?.decisionId ?? local.stateContext.lastDecisionRef ?? null,
          sourceRegistryVersion: getRegistryVersion(),
        }),
      },
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
  return { rootIdentity: rootContainer.rootIdentity, subIdentities: input.subIdentities };
}

export async function createSubjectAggregate(input: CreateSubjectAggregateInput = {}) {
  const store = await loadStore();
  const createdAt = nowIso();
  const subjectAggregateId =
    input.subjectAggregateId ??
    keccak256(stringToHex(["subject-aggregate", createdAt, Math.random().toString(16).slice(2)].join(":")));
  const existing = store.subjectAggregates[subjectAggregateId];
  if (existing) {
    return summarizeSubjectAggregate(store, subjectAggregateId);
  }

  const subjectAggregate: SubjectAggregate = {
    subjectAggregateId,
    status: input.status ?? "ACTIVE",
    linkedRootIds: [],
    controllerSummary: [],
    bindingGraphVersion: 1,
    createdAt,
    updatedAt: createdAt,
    evidenceRefs: uniqueStrings(input.evidenceRefs ?? []),
    auditBundleRef: input.auditBundleRef,
    schemaVersion: SUBJECT_AGGREGATE_SCHEMA_VERSION,
  };
  store.subjectAggregates[subjectAggregateId] = subjectAggregate;
  persistAudit(
    store,
    createAuditRecord({
      identityId: toBytes32(subjectAggregateId),
      rootIdentityId: toBytes32(subjectAggregateId),
      action: "SUBJECT_AGGREGATE_CREATED",
      actor: input.actor ?? "analyzer-service",
      evidenceRefs: subjectAggregate.evidenceRefs,
      metadata: { subjectAggregateId },
    }),
  );
  await saveStore(store);
  return summarizeSubjectAggregate(store, subjectAggregateId);
}

export async function getSubjectAggregate(subjectAggregateId: string) {
  const store = await loadStore();
  return summarizeSubjectAggregate(store, subjectAggregateId);
}

export async function listSubjectAggregateRoots(subjectAggregateId: string) {
  const store = await loadStore();
  return summarizeSubjectAggregate(store, subjectAggregateId).rootSummaries;
}

export async function listSubjectAggregateControllers(subjectAggregateId: string) {
  const store = await loadStore();
  return summarizeSubjectAggregate(store, subjectAggregateId).controllerSummary;
}

export async function createBindingChallengeRecord(input: {
  bindingType: BindingType;
  controllerRef?: ChainControllerRef;
  candidateAddress?: Address;
  rootIdentityId?: Hex;
  subIdentityId?: Hex;
  subjectAggregateId?: string;
}) {
  const store = await loadStore();
  const rootContainer = input.rootIdentityId ? getRootContainerOrThrow(store, input.rootIdentityId) : undefined;
  if (input.subIdentityId && (!rootContainer || !rootContainer.subIdentityIds.includes(input.subIdentityId))) {
    throw new Error("Unknown sub identity for the provided root.");
  }
  if (input.subjectAggregateId) {
    getSubjectAggregateOrThrow(store, input.subjectAggregateId);
  }
  const controllerRef = input.controllerRef
    ? normalizeControllerRef(input.controllerRef)
    : rootContainer
      ? rootContainer.rootIdentity.primaryControllerRef
      : input.candidateAddress
        ? normalizeControllerRef({
            chainFamily: "evm",
            networkId: 31337,
            address: input.candidateAddress,
          })
        : undefined;
  if (!controllerRef) {
    throw new Error("Binding challenge requires either controllerRef or a known root identity.");
  }
  const challenge = createBindingChallenge({
    bindingType: input.bindingType,
    controllerRef,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    subjectAggregateId: input.subjectAggregateId,
  });
  store.bindingChallenges[challenge.challengeId] = challenge;
  persistAudit(
    store,
    createAuditRecord({
      identityId: input.subIdentityId ?? input.rootIdentityId ?? toBytes32(input.subjectAggregateId),
      rootIdentityId: input.rootIdentityId ?? toBytes32(input.subjectAggregateId),
      subIdentityId: input.subIdentityId,
      action: "BINDING_CHALLENGE_CREATED",
      actor: "analyzer-service",
      evidenceRefs: [`challenge:${challenge.challengeHash}`],
      metadata: {
        bindingType: input.bindingType,
        candidateAddress: challenge.candidateAddress,
        controllerRef: challenge.controllerRef,
        subjectAggregateId: input.subjectAggregateId,
        replayKey: challenge.replayKey,
      },
    }),
  );
  await saveStore(store);
  return challenge;
}

export async function submitBinding(input: SubmitBindingInput) {
  const store = await loadStore();
  const challenge = store.bindingChallenges[input.challengeId];
  if (!challenge) throw new Error(`Unknown binding challenge: ${input.challengeId}`);
  const rootContainer = challenge.rootIdentityId ? getRootContainerOrThrow(store, challenge.rootIdentityId) : undefined;
  const subRecord = challenge.subIdentityId ? getIdentityRecordOrThrow(store, challenge.subIdentityId) : undefined;
  const verification = await verifyBindingSubmission({
    challenge,
    candidateSignature: input.candidateSignature,
    rootIdentity: rootContainer?.rootIdentity,
    subIdentity: subRecord?.subIdentity,
    linkProof: input.linkProof,
    sameRootProof: input.sameRootProof,
    authorizerAddress: input.authorizerAddress,
    authorizerSignature: input.authorizerSignature,
    activeBindings: Object.values(store.bindings).filter((binding) => challenge.rootIdentityId ? binding.rootIdentityId === challenge.rootIdentityId : true),
    consumedReplayKeys: new Set(Object.keys(store.bindingReplayKeys)),
  });
  const resolvedRootIdentity = rootContainer?.rootIdentity ?? verification.derivedRootIdentity;
  const resolvedRootContainer = ensureRootContainer(store, resolvedRootIdentity);
  ensureIdentityRecord(store, { rootIdentity: resolvedRootIdentity });

  if (challenge.subjectAggregateId && store.subjectAggregateRootIndex[resolvedRootIdentity.identityId]) {
    const existingAggregateId = store.subjectAggregateRootIndex[resolvedRootIdentity.identityId];
    if (existingAggregateId !== challenge.subjectAggregateId) {
      throw new Error(`Root identity ${resolvedRootIdentity.identityId} is already linked to subject aggregate ${existingAggregateId}.`);
    }
  }
  if (challenge.bindingType === "subject_aggregate_link" && challenge.subjectAggregateId) {
    const existingBinding = Object.values(store.bindings).find(
      (binding) =>
        binding.status === "ACTIVE" &&
        binding.type === "subject_aggregate_link" &&
        binding.rootIdentityId === resolvedRootIdentity.identityId &&
        binding.subjectAggregateId === challenge.subjectAggregateId &&
        binding.controllerRef.normalizedAddress.toLowerCase() === challenge.controllerRef.normalizedAddress.toLowerCase(),
    );
    if (existingBinding) {
      store.bindingReplayKeys[challenge.replayKey] = nowIso();
      delete store.bindingChallenges[input.challengeId];
      await saveStore(store);
      return existingBinding;
    }
  }

  const binding: BehaviorBinding = {
    bindingId: verification.bindingHash,
    type: challenge.bindingType,
    status: "ACTIVE",
    address: challenge.candidateAddress ? getAddress(challenge.candidateAddress) : undefined,
    controllerRef: challenge.controllerRef,
    rootIdentityId: resolvedRootIdentity.identityId,
    subIdentityId: challenge.subIdentityId,
    subjectAggregateId: challenge.subjectAggregateId,
    authorizerAddress: input.authorizerAddress ? getAddress(input.authorizerAddress) : undefined,
    createdAt: nowIso(),
    evidenceRefs: verification.evidenceRefs,
    bindingHash: verification.bindingHash,
    challengeHash: challenge.challengeHash,
    proofHash: verification.proofHash,
    metadata: input.metadata,
  };
  store.bindings[binding.bindingId] = binding;
  store.bindingReplayKeys[challenge.replayKey] = nowIso();
  delete store.bindingChallenges[input.challengeId];

  if (binding.type === "subject_aggregate_link" && binding.subjectAggregateId) {
    const subjectAggregate = getSubjectAggregateOrThrow(store, binding.subjectAggregateId);
    subjectAggregate.linkedRootIds = uniqueStrings([...subjectAggregate.linkedRootIds, binding.rootIdentityId]) as Hex[];
    subjectAggregate.controllerSummary = [
      ...subjectAggregate.controllerSummary.filter((item) => item.rootIdentityId !== binding.rootIdentityId),
      {
        rootIdentityId: binding.rootIdentityId,
        rootId: resolvedRootContainer.rootIdentity.rootId,
        controllerRef: binding.controllerRef,
        linkedAt: binding.createdAt,
      },
    ];
    subjectAggregate.bindingGraphVersion += 1;
    subjectAggregate.updatedAt = nowIso();
    subjectAggregate.evidenceRefs = uniqueStrings([...subjectAggregate.evidenceRefs, ...binding.evidenceRefs]);
    store.subjectAggregateRootIndex[binding.rootIdentityId] = binding.subjectAggregateId;
    store.subjectAggregateControllerIndex[controllerIndexKey(binding.controllerRef)] = binding.subjectAggregateId;
    setRootSubjectAggregate(store, binding.rootIdentityId, binding.subjectAggregateId);
  }

  persistAudit(
    store,
    createAuditRecord({
      identityId: challenge.subIdentityId ?? challenge.rootIdentityId ?? toBytes32(challenge.subjectAggregateId),
      rootIdentityId: resolvedRootIdentity.identityId,
      subIdentityId: challenge.subIdentityId,
      action: "BINDING_CREATED",
      actor: binding.address ?? binding.controllerRef.normalizedAddress,
      evidenceRefs: verification.evidenceRefs,
      metadata: {
        bindingId: binding.bindingId,
        bindingType: binding.type,
        subjectAggregateId: binding.subjectAggregateId,
        controllerRef: binding.controllerRef,
        challengeFields: challenge.challengeFields,
      },
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
  reviewItem.explanation = buildReviewQueueExplanation({
    reviewItemId: reviewItem.reviewItemId,
    status: reviewItem.status,
    evidenceRefs: reviewItem.evidenceRefs,
    sourceSuggestionId: reviewItem.sourceSuggestionId,
    reason: input.note,
    actor: input.actor,
  });

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
  reviewItem.explanation = buildReviewQueueExplanation({
    reviewItemId: reviewItem.reviewItemId,
    status: reviewItem.status,
    evidenceRefs: reviewItem.evidenceRefs,
    sourceSuggestionId: reviewItem.sourceSuggestionId,
    reason,
    actor,
  });
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
  const subjectAggregate = record.rootIdentity.subjectAggregateId
    ? summarizeSubjectAggregate(store, record.rootIdentity.subjectAggregateId)
    : null;
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
  const context = {
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
    subjectAggregate,
    listEntries: record.listEntries,
    bindings: getBindingsForIdentity(store, identityId),
    aiSuggestions: getSuggestionsForIdentity(store, identityId),
    reviewQueue,
    anchors: getAnchorsForIdentity(store, identityId),
    audit: getAuditForIdentity(store, identityId),
    listHistory: buildRiskListHistory(record),
    policyDecisions: getPolicyDecisionsForIdentity(store, identityId),
    recoveryCases: getRecoveryCasesForIdentity(store, identityId),
    crossChainInbox: getCrossChainInboxForIdentity(store, identityId),
    approvalTickets: getApprovalTicketsForIdentity(store, identityId),
    subtree: record.kind === "root" ? rootContainer.subIdentityIds.map((subIdentityId) => {
      const subRecord = store.identities[subIdentityId];
      return { identityId: subIdentityId, scope: subRecord?.subIdentity?.scope, type: subRecord?.subIdentity?.type, storedState: subRecord?.summary?.storedState, effectiveState: subRecord?.summary?.effectiveState, warnings: subRecord?.summary?.warnings ?? [], reasonCodes: subRecord?.summary?.reasonCodes ?? [] };
    }) : undefined,
  };
  return assertRiskContextExplainability(context);
}

export async function getIdentityEvents(identityId: Hex) {
  const store = await loadStore();
  return getEventsForIdentity(store, identityId);
}
export async function recordPolicyDecisionSnapshot(input: PolicyDecisionSnapshotInput) {
  const store = await loadStore();
  const record = getIdentityRecordOrThrow(store, input.identityId);
  const createdAt = input.createdAt ?? nowIso();
  const decisionId = keccak256(stringToHex([input.kind, input.identityId, input.policyId, createdAt].join(":")));
  const snapshot: PolicyDecisionRecord = {
    decisionId,
    kind: input.kind,
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    policyId: input.policyId,
    policyLabel: input.policyLabel,
    policyVersion: input.policyVersion,
    modePath: input.modePath,
    decision: input.decision,
    reasons: [...new Set(input.reasons)],
    warnings: [...new Set(input.warnings)],
    evidenceRefs: [...new Set(input.evidenceRefs)],
    createdAt,
    auditRecordIds: input.auditRecordIds ?? [],
    explanation: input.explanation ?? buildPolicyDecisionExplanation({
      decision: input.decision,
      state: record.summary?.effectiveState ?? record.riskRecord?.effectiveState ?? IdentityState.NORMAL,
      reasons: [...new Set(input.reasons)],
      warnings: [...new Set(input.warnings)],
      evidenceRefs: [...new Set(input.evidenceRefs)],
      policyVersion: input.policyVersion,
      policyLabel: input.policyLabel,
      sourceDecisionId: record.riskRecord?.lastDecisionId ?? null,
      sourceRegistryVersion: getRegistryVersion(),
      modePath: input.modePath,
      actorType: "policy_engine",
      actorId: "policy-api",
    }),
  };
  store.policyDecisions[snapshot.decisionId] = snapshot;
  const audit = createAuditRecord({
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    action: "POLICY_DECISION_MADE",
    actor: "policy-api",
    evidenceRefs: snapshot.evidenceRefs,
    policyVersion: input.policyVersion,
    metadata: {
      policyId: input.policyId,
      policyLabel: input.policyLabel,
      policyKind: input.kind,
      decision: input.decision,
      modePath: input.modePath,
      snapshotId: snapshot.decisionId,
    },
    timestamp: createdAt,
  });
  persistAudit(store, audit);
  snapshot.auditRecordIds = [...snapshot.auditRecordIds, audit.auditId];
  const identityHistory = record.summary?.warnings ?? [];
  record.summary = record.summary ? { ...record.summary, warnings: uniqueStrings(identityHistory) } : record.summary;
  await saveStore(store);
  return snapshot;
}
function getRecoveryCasesForIdentity(store: AnalyzerStore, identityId: Hex) {
  return Object.values(store.recoveryCases)
    .filter((item) => item.rootIdentityId === identityId || item.targetIdentityId === identityId || item.targetSubIdentityId === identityId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}
function getCrossChainInboxForIdentity(store: AnalyzerStore, identityId: Hex) {
  return Object.values(store.crossChainInbox)
    .filter((item) => item.message.rootIdentityId === identityId || item.message.subIdentityId === identityId)
    .sort((left, right) => Date.parse(right.message.createdAt) - Date.parse(left.message.createdAt));
}
function getApprovalTicketsForIdentity(store: AnalyzerStore, identityId: Hex) {
  return Object.values(store.approvalTickets)
    .filter((item) => item.rootIdentityId === identityId || item.identityId === identityId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export async function createRecoveryCaseRecord(input: RecoveryCaseInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as RecoveryCase;
  }
  ensureAllowedBreakGlassAction(input.breakGlassAction);
  const root = getRootContainerOrThrow(store, input.rootIdentityId);
  if (input.targetSubIdentityId && !root.subIdentityIds.includes(input.targetSubIdentityId)) {
    throw new Error("Recovery target sub identity does not belong to the selected root.");
  }
  const createdAt = nowIso();
  const caseId = keccak256(stringToHex([input.rootIdentityId, input.targetIdentityId ?? input.targetSubIdentityId ?? input.rootIdentityId, input.action, createdAt].join(":")));
  const ticket = createApprovalTicketRecord({
    action: "recovery_execution",
    rootIdentityId: input.rootIdentityId,
    identityId: input.targetIdentityId ?? input.targetSubIdentityId,
    requiredRoles: input.breakGlassAction ? ["operator", "governance_reviewer"] : ["operator", "governance_reviewer"],
    requiredApprovals: input.breakGlassAction ? 2 : 2,
    reasonCode: `RECOVERY_${input.action.toUpperCase()}`,
    explanation: input.breakGlassAction
      ? `Recovery case ${caseId} requires governed break-glass approval before execution.`
      : `Recovery case ${caseId} requires governed approval before execution.`,
  });
  const recoveryApprovalTickets = createRecoveryApprovalTickets(caseId, ticket);
  const recoveryCase: RecoveryCase = {
    caseId,
    rootIdentityId: input.rootIdentityId,
    targetIdentityId: input.targetIdentityId,
    targetSubIdentityId: input.targetSubIdentityId,
    action: input.action,
    status: "initiated",
    requestedBy: input.requestedBy,
    breakGlassAction: input.breakGlassAction,
    scope: input.scope,
    evidence: [],
    decisions: [],
    executions: [],
    outcomes: [],
    approvalTickets: recoveryApprovalTickets,
    createdAt,
    updatedAt: createdAt,
    versionEnvelope: createVersionEnvelope(),
  };
  store.recoveryCases[caseId] = recoveryCase;
  store.approvalTickets[ticket.ticketId] = ticket;
  persistAudit(store, createAuditRecord({
    identityId: (input.targetIdentityId ?? input.targetSubIdentityId ?? input.rootIdentityId) as Hex,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.targetSubIdentityId,
    action: "RECOVERY_CASE_CREATED",
    actor: input.requestedBy,
    metadata: { caseId, action: input.action, breakGlassAction: input.breakGlassAction, scope: input.scope },
  }));
  persistAudit(store, createAuditRecord({
    identityId: (input.targetIdentityId ?? input.targetSubIdentityId ?? input.rootIdentityId) as Hex,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.targetSubIdentityId,
    action: "APPROVAL_TICKET_CREATED",
    actor: input.requestedBy,
    metadata: { ticketId: ticket.ticketId, caseId, action: ticket.action },
  }));
  queueWebhookEvent(store, "recovery.case.created", { caseId, rootIdentityId: input.rootIdentityId, targetIdentityId: input.targetIdentityId, targetSubIdentityId: input.targetSubIdentityId });
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "createRecoveryCaseRecord",
      createdAt,
      result: recoveryCase as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return recoveryCase;
}

export async function listRecoveryCases(input: { rootIdentityId?: Hex; identityId?: Hex } = {}) {
  const store = await loadStore();
  const items = Object.values(store.recoveryCases).filter((item) =>
    (!input.rootIdentityId || item.rootIdentityId === input.rootIdentityId) &&
    (!input.identityId || item.targetIdentityId === input.identityId || item.targetSubIdentityId === input.identityId || item.rootIdentityId === input.identityId)
  );
  return items.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export async function listApprovalTickets(input: { rootIdentityId?: Hex; identityId?: Hex } = {}) {
  const store = await loadStore();
  return Object.values(store.approvalTickets)
    .filter((item) =>
      (!input.rootIdentityId || item.rootIdentityId === input.rootIdentityId) &&
      (!input.identityId || item.identityId === input.identityId || item.rootIdentityId === input.identityId)
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export async function appendRecoveryCaseEvidence(input: RecoveryEvidenceInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as RecoveryCase;
  }
  const recoveryCase = store.recoveryCases[input.caseId];
  if (!recoveryCase) {
    throw new Error(`Unknown recovery case: ${input.caseId}`);
  }
  const createdAt = nowIso();
  recoveryCase.evidence.push({
    evidenceId: keccak256(stringToHex([input.caseId, input.kind, input.actor, createdAt].join(":"))),
    caseId: input.caseId,
    rootIdentityId: recoveryCase.rootIdentityId,
    targetIdentityId: recoveryCase.targetIdentityId ?? recoveryCase.targetSubIdentityId,
    kind: input.kind,
    summary: input.summary,
    evidenceRefs: uniqueStrings(input.evidenceRefs),
    submittedBy: input.actor,
    submittedRole: input.actorRole,
    createdAt,
    versionEnvelope: createVersionEnvelope(),
  });
  recoveryCase.status = "evidence_collecting";
  recoveryCase.updatedAt = createdAt;
  persistAudit(store, createAuditRecord({
    identityId: (recoveryCase.targetIdentityId ?? recoveryCase.targetSubIdentityId ?? recoveryCase.rootIdentityId) as Hex,
    rootIdentityId: recoveryCase.rootIdentityId as Hex,
    subIdentityId: recoveryCase.targetSubIdentityId as Hex | undefined,
    action: "RECOVERY_EVIDENCE_ADDED",
    actor: input.actor,
    evidenceRefs: input.evidenceRefs,
    metadata: { caseId: input.caseId, kind: input.kind },
  }));
  queueWebhookEvent(store, "recovery.evidence.added", { caseId: input.caseId, actor: input.actor, kind: input.kind });
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "appendRecoveryCaseEvidence",
      createdAt,
      result: recoveryCase as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return recoveryCase;
}

export async function recordRecoveryCaseDecision(input: RecoveryDecisionInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as RecoveryCase;
  }
  const recoveryCase = store.recoveryCases[input.caseId];
  if (!recoveryCase) {
    throw new Error(`Unknown recovery case: ${input.caseId}`);
  }
  const createdAt = nowIso();
  recoveryCase.decisions.push({
    decisionId: keccak256(stringToHex([input.caseId, input.outcome, input.actor, createdAt].join(":"))),
    caseId: input.caseId,
    rootIdentityId: recoveryCase.rootIdentityId,
    actorId: input.actor,
    actorRole: input.actorRole,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    explanation: input.explanation,
    evidenceRefs: uniqueStrings(input.evidenceRefs),
    createdAt,
    versionEnvelope: createVersionEnvelope(),
  });
  recoveryCase.status = input.outcome === "approved" ? "approved" : input.outcome;
  recoveryCase.updatedAt = createdAt;
  persistAudit(store, createAuditRecord({
    identityId: (recoveryCase.targetIdentityId ?? recoveryCase.targetSubIdentityId ?? recoveryCase.rootIdentityId) as Hex,
    rootIdentityId: recoveryCase.rootIdentityId as Hex,
    subIdentityId: recoveryCase.targetSubIdentityId as Hex | undefined,
    action: "RECOVERY_DECISION_RECORDED",
    actor: input.actor,
    evidenceRefs: input.evidenceRefs,
    metadata: { caseId: input.caseId, outcome: input.outcome, reasonCode: input.reasonCode },
  }));
  queueWebhookEvent(store, "recovery.decision.recorded", { caseId: input.caseId, outcome: input.outcome, actor: input.actor });
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "recordRecoveryCaseDecision",
      createdAt,
      result: recoveryCase as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return recoveryCase;
}

export async function executeRecoveryCase(input: RecoveryExecutionInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as RecoveryCase;
  }
  const recoveryCase = store.recoveryCases[input.caseId];
  if (!recoveryCase) {
    throw new Error(`Unknown recovery case: ${input.caseId}`);
  }
  ensureAllowedBreakGlassAction(input.breakGlassAction ?? recoveryCase.breakGlassAction);
  if (recoveryCase.approvalTickets.some((ticket) => ticket.status !== "approved")) {
    throw new Error("Recovery case cannot execute until all approval tickets are approved.");
  }
  if (recoveryCase.decisions.every((decision) => decision.outcome !== "approved")) {
    throw new Error("Recovery case requires an approved decision before execution.");
  }
  const targetIdentityId = (recoveryCase.targetIdentityId ?? recoveryCase.targetSubIdentityId ?? recoveryCase.rootIdentityId) as Hex;
  const record = getIdentityRecordOrThrow(store, targetIdentityId);
  const createdAt = nowIso();
  let effect: ReturnType<typeof determineRecoveryEffect>;
  if (input.action === "rebind") {
    effect = { effect: "binding_update", notes: ["Recovery execution recorded a governed rebind intent."] };
  } else {
    const currentState = record.summary?.effectiveState ?? record.riskRecord?.effectiveState ?? IdentityState.NORMAL;
    if (currentState > IdentityState.NORMAL) {
      const manualReleaseWindow = buildManualReleaseWindow({ releasedAt: createdAt, currentState });
      record.manualReleaseWindow = manualReleaseWindow;
      record.manualSignals.push(createManualSignal({
        identityId: targetIdentityId,
        rootIdentityId: record.rootIdentity.identityId,
        subIdentityId: record.subIdentity?.identityId,
        requestedState: manualReleaseWindow.floorState,
        reasonCode: input.breakGlassAction ? `BREAK_GLASS_${input.breakGlassAction.toUpperCase()}` : `RECOVERY_${input.action.toUpperCase()}`,
        actor: input.actor,
        evidenceRefs: [`phase4://recovery/${recoveryCase.caseId}`],
        note: `Governed recovery execution applied ${input.action}.`,
        category: "positive",
        severity: "positive",
      }));
    }
    effect = determineRecoveryEffect(input.action, input.breakGlassAction ?? recoveryCase.breakGlassAction);
  }
  recoveryCase.executions.push({
    executionId: keccak256(stringToHex([input.caseId, input.action, input.actor, createdAt].join(":"))),
    caseId: input.caseId,
    rootIdentityId: recoveryCase.rootIdentityId,
    actorId: input.actor,
    action: input.action,
    breakGlassAction: input.breakGlassAction ?? recoveryCase.breakGlassAction,
    effect: effect.effect,
    status: "completed",
    createdAt,
    versionEnvelope: createVersionEnvelope(),
  });
  recoveryCase.outcomes.push({
    outcomeId: keccak256(stringToHex([input.caseId, effect.effect, createdAt].join(":"))),
    caseId: input.caseId,
    rootIdentityId: recoveryCase.rootIdentityId,
    targetIdentityId,
    action: input.action,
    status: "applied",
    notes: effect.notes,
    createdAt,
    versionEnvelope: createVersionEnvelope(),
  });
  recoveryCase.status = "executed";
  recoveryCase.updatedAt = createdAt;
  persistAudit(store, createAuditRecord({
    identityId: targetIdentityId,
    rootIdentityId: recoveryCase.rootIdentityId as Hex,
    subIdentityId: recoveryCase.targetSubIdentityId as Hex | undefined,
    action: "RECOVERY_EXECUTED",
    actor: input.actor,
    evidenceRefs: [`phase4://recovery/${recoveryCase.caseId}`],
    metadata: { caseId: input.caseId, action: input.action, breakGlassAction: input.breakGlassAction ?? recoveryCase.breakGlassAction, effect: effect.effect },
  }));
  persistAudit(store, createAuditRecord({
    identityId: targetIdentityId,
    rootIdentityId: recoveryCase.rootIdentityId as Hex,
    subIdentityId: recoveryCase.targetSubIdentityId as Hex | undefined,
    action: "RECOVERY_OUTCOME_RECORDED",
    actor: input.actor,
    evidenceRefs: [`phase4://recovery/${recoveryCase.caseId}`],
    metadata: { caseId: input.caseId, notes: effect.notes },
  }));
  queueWebhookEvent(store, "recovery.executed", { caseId: input.caseId, action: input.action, effect: effect.effect });
  await recomputeRootState(store, recoveryCase.rootIdentityId as Hex);
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "executeRecoveryCase",
      createdAt,
      result: recoveryCase as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return recoveryCase;
}

export async function createApprovalTicket(input: ApprovalTicketInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as ApprovalTicket;
  }
  const ticket = createApprovalTicketRecord(input);
  store.approvalTickets[ticket.ticketId] = ticket;
  persistAudit(store, createAuditRecord({
    identityId: (input.identityId ?? input.rootIdentityId) as Hex,
    rootIdentityId: input.rootIdentityId,
    action: "APPROVAL_TICKET_CREATED",
    actor: "analyzer-service",
    metadata: { ticketId: ticket.ticketId, action: ticket.action, requiredRoles: ticket.requiredRoles },
  }));
  queueWebhookEvent(store, "approval.ticket.created", { ticketId: ticket.ticketId, action: ticket.action, rootIdentityId: input.rootIdentityId, identityId: input.identityId });
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "createApprovalTicket",
      createdAt: ticket.createdAt,
      result: ticket as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return ticket;
}

export async function decideApprovalTicket(input: ApprovalDecisionInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as ApprovalTicket;
  }
  const ticket = store.approvalTickets[input.ticketId];
  if (!ticket) {
    throw new Error(`Unknown approval ticket: ${input.ticketId}`);
  }
  if (input.decision === "approve") {
    if (!ticket.approvedBy.includes(input.actor)) {
      ticket.approvedBy.push(input.actor);
    }
    if (ticket.approvedBy.length >= ticket.requiredApprovals) {
      ticket.status = "approved";
    }
  } else if (input.decision === "reject") {
    ticket.status = "rejected";
  } else {
    ticket.status = "cancelled";
  }
  ticket.updatedAt = nowIso();
  for (const recoveryCase of Object.values(store.recoveryCases)) {
    const linkedTickets = recoveryCase.approvalTickets.filter((item) => item.ticketId.startsWith(`${ticket.ticketId}:`));
    if (!linkedTickets.length) continue;
    for (const linkedTicket of linkedTickets) {
      linkedTicket.approvedBy = [...ticket.approvedBy];
      linkedTicket.status = ticket.status === "cancelled" ? "rejected" : ticket.status === "approved" ? "approved" : "pending";
      linkedTicket.updatedAt = ticket.updatedAt;
    }
    recoveryCase.updatedAt = ticket.updatedAt;
  }
  const action = input.decision === "approve" ? "APPROVAL_TICKET_APPROVED" : input.decision === "reject" ? "APPROVAL_TICKET_REJECTED" : "APPROVAL_TICKET_CANCELLED";
  persistAudit(store, createAuditRecord({
    identityId: (ticket.identityId ?? ticket.rootIdentityId) as Hex,
    rootIdentityId: ticket.rootIdentityId,
    action,
    actor: input.actor,
    metadata: { ticketId: input.ticketId, decision: input.decision },
  }));
  queueWebhookEvent(store, "approval.ticket.updated", { ticketId: input.ticketId, decision: input.decision, actor: input.actor });
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "decideApprovalTicket",
      createdAt: ticket.updatedAt,
      result: ticket as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return ticket;
}

export async function createCrossChainMessageRecord(input: CrossChainMessageCreateInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as { snapshot: ReturnType<typeof buildStateSnapshotV2>; message: CrossChainStateMessageV2 };
  }
  const context = await getRiskContext(input.identityId);
  const source = {
    identityId: input.identityId,
    rootIdentityId: context.rootIdentity.identityId,
    subIdentityId: context.subIdentity?.identityId,
    storedState: context.summary?.storedState ?? IdentityState.NORMAL,
    effectiveState: context.summary?.effectiveState ?? IdentityState.NORMAL,
    effectiveMode: context.subIdentity?.capabilities.preferredMode ?? context.rootIdentity.capabilities.preferredMode,
    stateContext: context.stateContext,
    policyDecisions: (context.policyDecisions ?? []).map((item) => ({
      policyLabel: item.policyLabel,
      policyVersion: item.policyVersion,
      createdAt: item.createdAt,
    })),
    propagationSummary: context.summary?.propagation?.reasonCodes ?? [],
    explanationAnchor: context.summary?.explanation.sourceDecisionId ?? undefined,
  };
  const snapshot = buildStateSnapshotV2(source, {
    signer: "web3id:analyzer-service",
    trustProfile: "attested_sync",
  });
  const message = buildCrossChainStateMessageV2(snapshot, {
    targetChainId: input.targetChainId,
    sourceChainId: context.rootIdentity.chainId,
    sourceDomain: input.sourceDomain,
    targetDomain: input.targetDomain,
    ttlSeconds: input.ttlSeconds,
    consumerPolicyHint: input.consumerPolicyHint,
  });
  persistAudit(store, createAuditRecord({
    identityId: input.identityId,
    rootIdentityId: context.rootIdentity.identityId,
    subIdentityId: context.subIdentity?.identityId,
    action: "CROSS_CHAIN_MESSAGE_CREATED",
    actor: "analyzer-service",
    metadata: { messageId: message.messageId, targetChainId: input.targetChainId, consumerPolicyHint: message.consumerPolicyHint },
  }));
  queueWebhookEvent(store, "crosschain.message.created", { identityId: input.identityId, messageId: message.messageId, targetChainId: input.targetChainId });
  const result = { snapshot, message };
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "createCrossChainMessageRecord",
      createdAt: message.createdAt,
      result: result as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return result;
}

export async function ingestCrossChainMessage(input: CrossChainMessageIngestInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as CrossChainInboxItem;
  }
  const verification = verifyCrossChainStateMessageV2(input.message, {
    expectedTargetDomain: input.message.targetDomain,
    seenReplayProtectionKeys: new Set(Object.values(store.crossChainInbox).map((item) => item.message.replayProtectionKey)),
  });
  const inboxItem = createCrossChainInboxItem(input.message, verification);
  store.crossChainInbox[inboxItem.inboxId] = inboxItem;
  persistAudit(store, createAuditRecord({
    identityId: (input.message.subIdentityId ?? input.message.rootIdentityId) as Hex,
    rootIdentityId: input.message.rootIdentityId as Hex,
    subIdentityId: input.message.subIdentityId as Hex | undefined,
    action: "CROSS_CHAIN_MESSAGE_INGESTED",
    actor: "analyzer-service",
    metadata: { inboxId: inboxItem.inboxId, messageId: input.message.messageId, verified: verification.verified, reasonCode: verification.reasonCode },
  }));
  queueWebhookEvent(store, "crosschain.message.ingested", { inboxId: inboxItem.inboxId, messageId: input.message.messageId, verified: verification.verified });
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "ingestCrossChainMessage",
      createdAt: verification.verifiedAt,
      result: inboxItem as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return inboxItem;
}

export async function listCrossChainInbox(input: { identityId?: Hex; rootIdentityId?: Hex } = {}) {
  const store = await loadStore();
  return Object.values(store.crossChainInbox)
    .filter((item) =>
      (!input.identityId || item.message.rootIdentityId === input.identityId || item.message.subIdentityId === input.identityId) &&
      (!input.rootIdentityId || item.message.rootIdentityId === input.rootIdentityId)
    )
    .sort((left, right) => Date.parse(right.message.createdAt) - Date.parse(left.message.createdAt));
}

export async function consumeCrossChainMessage(input: CrossChainMessageConsumeInput) {
  const store = await loadStore();
  const receipt = getStoredReceipt(store, input.idempotencyKey);
  if (receipt) {
    return receipt.result as unknown as CrossChainInboxItem;
  }
  const inboxItem = store.crossChainInbox[input.inboxId];
  if (!inboxItem) {
    throw new Error(`Unknown cross-chain inbox item: ${input.inboxId}`);
  }
  if (!inboxItem.verification.verified) {
    throw new Error("Cross-chain inbox item must verify before it can be consumed.");
  }
  const effect = input.effect ?? (inboxItem.message.consumerPolicyHint === "review_trigger" ? "review_recommended" : inboxItem.message.consumerPolicyHint === "eligibility_signal" ? "eligibility_noted" : "hint_recorded");
  inboxItem.consumptionTrace = createCrossChainConsumptionTrace(inboxItem.message, effect);
  inboxItem.consumed = true;
  persistAudit(store, createAuditRecord({
    identityId: (inboxItem.message.subIdentityId ?? inboxItem.message.rootIdentityId) as Hex,
    rootIdentityId: inboxItem.message.rootIdentityId as Hex,
    subIdentityId: inboxItem.message.subIdentityId as Hex | undefined,
    action: "CROSS_CHAIN_MESSAGE_CONSUMED",
    actor: input.actor,
    metadata: { inboxId: input.inboxId, effect, consumerPolicyHint: inboxItem.message.consumerPolicyHint },
  }));
  queueWebhookEvent(store, "crosschain.message.consumed", { inboxId: input.inboxId, effect, actor: input.actor });
  if (input.idempotencyKey) {
    storeReceipt(store, {
      idempotencyKey: input.idempotencyKey,
      operation: "consumeCrossChainMessage",
      createdAt: inboxItem.consumptionTrace.createdAt,
      result: inboxItem as unknown as Record<string, unknown>,
    });
  }
  await saveStore(store);
  return inboxItem;
}

export async function getRuntimeMetrics() {
  const store = await loadStore();
  return {
    ...store.runtimeMetrics,
    pendingWebhookEvents: Object.values(store.webhookOutbox).filter((item) => item.status === "PENDING").length,
    deliveredWebhookEvents: Object.values(store.webhookOutbox).filter((item) => item.status === "DELIVERED").length,
    failedWebhookEvents: Object.values(store.webhookOutbox).filter((item) => item.status === "FAILED").length,
    recoveryCases: Object.keys(store.recoveryCases).length,
    crossChainInboxItems: Object.keys(store.crossChainInbox).length,
    approvalTickets: Object.keys(store.approvalTickets).length,
  };
}

export async function listWebhookOutbox() {
  const store = await loadStore();
  return Object.values(store.webhookOutbox).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function buildReplayTraceFromStore(store: AnalyzerStore, identityId: Hex, asOf: string): ReplayTrace {
  const record = getIdentityRecordOrThrow(store, identityId);
  const initialState = record.kind === "sub" ? defaultInitialStateForSub(record.subIdentity) : IdentityState.NORMAL;
  const replayedSignals = sortedSignals(record.signals.filter((signal) => Date.parse(signal.observedAt) <= Date.parse(asOf)));
  const replayedContext = replaySignalTimeline(identityId, initialState, replayedSignals);
  const policyDecisions = getPolicyDecisionsForIdentity(store, identityId).filter((item) => Date.parse(item.createdAt) <= Date.parse(asOf));
  const recoveryCases = getRecoveryCasesForIdentity(store, identityId)
    .filter((item) => Date.parse(item.createdAt) <= Date.parse(asOf))
    .map((item) => ({
      caseId: item.caseId,
      action: item.action,
      status: item.status,
      updatedAt: item.updatedAt,
    }));
  const crossChainInbox = getCrossChainInboxForIdentity(store, identityId)
    .filter((item) => Date.parse(item.message.createdAt) <= Date.parse(asOf))
    .map((item) => ({
      inboxId: item.inboxId,
      verified: item.verification.verified,
      consumed: item.consumed,
      reasonCode: item.verification.reasonCode,
      createdAt: item.message.createdAt,
    }));
  const auditRecords = getAuditForIdentity(store, identityId).filter((item) => Date.parse(item.timestamp) <= Date.parse(asOf));
  const reasonCodes = uniqueStrings(replayedSignals.map((signal) => signal.reasonCode));
  const warnings = uniqueStrings([
    ...policyDecisions.flatMap((item) => item.warnings),
    ...crossChainInbox.filter((item) => !item.verified).map((item) => item.reasonCode),
  ]);
  const stateLabel = IdentityState[replayedContext.currentState];

  return {
    identityId,
    rootIdentityId: record.rootIdentity.identityId,
    asOf,
    storedState: replayedContext.currentState ?? null,
    effectiveState: replayedContext.currentState ?? null,
    reasonCodes,
    warnings,
    policyDecisions,
    recoveryCases,
    crossChainInbox,
    auditRecords,
    explanation: [
      `Replay rebuilt ${replayedSignals.length} signals up to ${asOf}.`,
      `The reconstructed stored/effective state at this timepoint is ${stateLabel}.`,
      `Observed ${policyDecisions.length} policy snapshots, ${recoveryCases.length} recovery cases, and ${crossChainInbox.length} cross-chain inbox items in the read-only replay window.`,
    ],
    versionEnvelope: createVersionEnvelope(),
  };
}

export async function replayIdentity(input: { identityId: Hex; asOf?: string }): Promise<ReplayTrace> {
  const store = await loadStore();
  return buildReplayTraceFromStore(store, input.identityId, input.asOf ?? nowIso());
}

export async function diffIdentityReplay(input: { identityId: Hex; from: string; to: string }): Promise<DiffReport> {
  const store = await loadStore();
  const fromTrace = buildReplayTraceFromStore(store, input.identityId, input.from);
  const toTrace = buildReplayTraceFromStore(store, input.identityId, input.to);
  const changes: DiffReport["changes"] = [];

  const pushChange = (field: string, before: unknown, after: unknown, explanation: string) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    changes.push({ field, before, after, explanation });
  };

  pushChange(
    "storedState",
    fromTrace.storedState === null ? null : IdentityState[fromTrace.storedState],
    toTrace.storedState === null ? null : IdentityState[toTrace.storedState],
    "Replay compares reconstructed stored state across the selected timepoints.",
  );
  pushChange(
    "effectiveState",
    fromTrace.effectiveState === null ? null : IdentityState[fromTrace.effectiveState],
    toTrace.effectiveState === null ? null : IdentityState[toTrace.effectiveState],
    "Replay keeps effective state read-only and explanation-first.",
  );
  pushChange(
    "reasonCodes",
    fromTrace.reasonCodes,
    toTrace.reasonCodes,
    "Reason-code diff highlights which policy, risk, or recovery facts entered or left the explanation chain.",
  );
  pushChange(
    "policyDecisionCount",
    fromTrace.policyDecisions.length,
    toTrace.policyDecisions.length,
    "Policy snapshot count changed between the replay windows.",
  );
  pushChange(
    "recoveryStatuses",
    fromTrace.recoveryCases.map((item) => `${item.caseId}:${item.status}`),
    toTrace.recoveryCases.map((item) => `${item.caseId}:${item.status}`),
    "Recovery diff is read-only and tracks governed status progression only.",
  );
  pushChange(
    "crossChainConsumption",
    fromTrace.crossChainInbox.map((item) => `${item.inboxId}:${item.consumed}`),
    toTrace.crossChainInbox.map((item) => `${item.inboxId}:${item.consumed}`),
    "Cross-chain diff shows hint ingestion/consumption changes without treating them as state rewrites.",
  );

  return {
    identityId: input.identityId,
    from: fromTrace,
    to: toTrace,
    changes,
    summary: changes.length
      ? `Detected ${changes.length} replay-visible changes between ${input.from} and ${input.to}.`
      : `No replay-visible changes were detected between ${input.from} and ${input.to}.`,
    versionEnvelope: createVersionEnvelope(),
  };
}

export async function exportIdentityAudit(identityId: Hex) {
  return exportStructuredAudit({ identityId });
}
export async function exportStructuredAudit(input: AuditExportInput): Promise<AuditExportBundle> {
  const store = await loadStore();
  const identityIds = resolveAuditIdentityIds(store, input);
  const subjectAggregateIds = (() => {
    if (!input.identityId && !input.rootIdentityId && !input.subIdentityId) {
      return Object.keys(store.subjectAggregates);
    }

    const aggregateIds = new Set<string>();
    for (const identityId of identityIds) {
      const record = store.identities[identityId];
      if (record?.rootIdentity.subjectAggregateId) {
        aggregateIds.add(record.rootIdentity.subjectAggregateId);
      }
    }
    return [...aggregateIds];
  })();
  const aggregateAuditIds = new Set(subjectAggregateIds.map((item) => toBytes32(item)));
  const policyDecisions = Object.values(store.policyDecisions)
    .filter((item) => identityIds.includes(item.identityId))
    .filter((item) => !input.policyId || item.policyId === input.policyId)
    .filter((item) => !input.policyKind || item.kind === input.policyKind)
    .filter((item) => !input.from || Date.parse(item.createdAt) >= Date.parse(input.from))
    .filter((item) => !input.to || Date.parse(item.createdAt) <= Date.parse(input.to))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const records = filterAuditByWindow(
    Object.values(store.audits).filter((record) => {
      if (identityIds.includes(record.identityId)) {
        return true;
      }
      if (aggregateAuditIds.has(record.identityId)) {
        return true;
      }
      const metadata = record.metadata as Record<string, unknown> | undefined;
      return typeof metadata?.subjectAggregateId === "string" && subjectAggregateIds.includes(metadata.subjectAggregateId);
    }),
    { from: input.from, to: input.to },
  )
    .filter((record) => {
      if (!input.policyId && !input.policyKind) {
        return true;
      }
      const metadata = record.metadata as Record<string, unknown> | undefined;
      if (!metadata) {
        return false;
      }
      if (input.policyId && metadata.policyId !== input.policyId) {
        return false;
      }
      if (input.policyKind && metadata.policyKind !== input.policyKind) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const includedRecords = identityIds
    .map((identityId) => store.identities[identityId])
    .filter((record): record is AnalyzerIdentityRecord => Boolean(record));

  const bundle = normalizeAuditExportBundle({
    generatedAt: nowIso(),
    filters: input,
    identities: identityIds,
    subjectAggregates: subjectAggregateIds.map((subjectAggregateId) => summarizeSubjectAggregate(store, subjectAggregateId)),
    signals: includedRecords.flatMap((record) => record.signals),
    assessments: includedRecords.flatMap((record) => record.stateContext?.assessments ?? []),
    decisions: includedRecords.flatMap((record) => record.stateContext?.decisions ?? []),
    consequences: includedRecords.flatMap((record) => record.stateContext?.consequences ?? []),
    propagation: includedRecords.map((record) => ({
      identityId: (record.subIdentity?.identityId ?? record.rootIdentity.identityId) as Hex,
      summary: summarizePropagation(record) ?? null,
    })),
    reentryRecovery: includedRecords.map((record) => ({
      identityId: (record.subIdentity?.identityId ?? record.rootIdentity.identityId) as Hex,
      manualReleaseWindow: record.manualReleaseWindow ?? null,
      recoveryProgress: record.summary?.recoveryProgress,
      positiveSummary: record.summary?.positiveSummary,
    })),
    aiSuggestions: includedRecords.flatMap((record) => getSuggestionsForIdentity(store, (record.subIdentity?.identityId ?? record.rootIdentity.identityId) as Hex)),
    reviewQueue: includedRecords.flatMap((record) => getReviewsForIdentity(store, (record.subIdentity?.identityId ?? record.rootIdentity.identityId) as Hex)),
    policyDecisions,
    anchors: includedRecords.flatMap((record) => getAnchorsForIdentity(store, (record.subIdentity?.identityId ?? record.rootIdentity.identityId) as Hex)),
    crossChainInbox: includedRecords.flatMap((record) => getCrossChainInboxForIdentity(store, (record.subIdentity?.identityId ?? record.rootIdentity.identityId) as Hex)),
    auditRecords: records,
    records,
    approvalTickets: identityIds.flatMap((identityId) => getApprovalTicketsForIdentity(store, identityId as Hex)),
  });
  bundle.versionEnvelope = withAuditBundleVersion(createVersionEnvelope());
  assertAuditExportConsistency(bundle);
  return bundle;
}
export async function listRiskHistory(input: RiskListHistoryInput = {}) {
  const store = await loadStore();
  const identityIds = resolveAuditIdentityIds(store, {
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
  });
  return identityIds
    .flatMap((identityId) => {
      const record = store.identities[identityId];
      return record ? buildRiskListHistory(record) : [];
    })
    .filter((item) => !input.listName || item.listName === input.listName)
    .filter((item) => !input.action || item.action === input.action)
    .filter((item) => !input.from || Date.parse(item.timestamp) >= Date.parse(input.from))
    .filter((item) => !input.to || Date.parse(item.timestamp) <= Date.parse(input.to))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
export async function getOperatorDashboard(): Promise<OperatorDashboardSnapshot> {
  const store = await loadStore();
  const identities = Object.values(store.identities);
  const audits = Object.values(store.audits).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const policyDecisions = Object.values(store.policyDecisions).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const highRiskIdentities = identities.filter((record) => (record.summary?.effectiveState ?? IdentityState.NORMAL) >= IdentityState.HIGH_RISK).length;
  const frozenIdentities = identities.filter((record) => (record.summary?.effectiveState ?? IdentityState.NORMAL) === IdentityState.FROZEN).length;
  const pendingReviewItems = Object.values(store.reviewQueue).filter((item) => item.status === "PENDING_REVIEW").length;
  return {
    generatedAt: nowIso(),
    counts: {
      highRiskIdentities,
      frozenIdentities,
      pendingReviewItems,
      pendingAiReviews: pendingReviewItems,
      activeWatchers: Object.values(store.watchers).filter((watcher) => watcher.status === "ACTIVE").length,
      pendingRecoveryCases: Object.values(store.recoveryCases).filter((item) => item.status !== "executed" && item.status !== "rejected" && item.status !== "expired").length,
      pendingApprovalTickets: Object.values(store.approvalTickets).filter((item) => item.status === "pending").length,
      activePositiveUplifts: identities.flatMap((record) => record.summary?.positiveSummary?.activeUnlocks ?? []).length,
    },
    recentStateEscalations: audits.filter((audit) => audit.action === "STATE_COMPUTED").slice(0, 8),
    recentHighRiskOrFrozen: audits.filter((audit) => {
      const metadata = audit.metadata as Record<string, unknown> | undefined;
      const effectiveState = typeof metadata?.effectiveState === "string" ? metadata.effectiveState : undefined;
      return effectiveState === "HIGH_RISK" || effectiveState === "FROZEN";
    }).slice(0, 8),
    recentManualReleases: audits.filter((audit) => audit.action === "MANUAL_RELEASE_APPLIED").slice(0, 8),
    recentWarningPolicies: policyDecisions.filter((decision) => decision.kind === "warning").slice(0, 8),
    recentPolicyDecisions: policyDecisions.slice(0, 8),
    recentApprovalTickets: Object.values(store.approvalTickets).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 8),
    positiveUpliftNotes: identities
      .flatMap((record) => record.summary?.positiveSummary?.activeUnlocks ?? [])
      .slice(0, 8)
      .map((item) => `${item.identityId}: ${item.consequenceType}`),
    versionEnvelope: createVersionEnvelope(),
  };
}
export async function listReviewQueue(identityId?: Hex) {
  const store = await loadStore();
  return Object.values(store.reviewQueue).filter((item) => !identityId || item.identityId === identityId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function determineRecoveryEffect(action: RecoveryAction, breakGlassAction?: BreakGlassAction) {
  if (breakGlassAction === "queue_unblock") {
    return { effect: "queued" as const, notes: ["Queued unblock recorded without raw state rewrite."] };
  }
  if (breakGlassAction === "temporary_release") {
    return { effect: "temporary_release" as const, notes: ["Temporary release applied through manual release floor and audit-linked recovery flow."] };
  }
  if (breakGlassAction === "consequence_rollback") {
    return { effect: "consequence_rollback" as const, notes: ["Consequence rollback recorded through governed recovery execution."] };
  }
  if (action === "rebind") {
    return { effect: "binding_update" as const, notes: ["Governed sub-identity rebind intent recorded."] };
  }
  if (action === "capability_restore") {
    return { effect: "capability_restore" as const, notes: ["Capability restore recorded as a governed positive uplift."] };
  }
  return { effect: "access_unlock" as const, notes: ["Access path unlock recorded as a governed positive uplift."] };
}

