import { readFile, rename, rm, writeFile } from "node:fs/promises";
import type { RecoveryCase, RootIdentity, SubjectAggregate, SubIdentity } from "../../../packages/identity/src/index.js";
import type {
  ApprovalTicket,
  AiSuggestion,
  AnchorQueueEntry,
  AuditRecord,
  BehaviorBinding,
  BehaviorEvent,
  BindingChallenge,
  IdentityRiskRecord,
  ManualReleaseWindow,
  ManualListAction,
  PolicyDecisionRecord,
  ReviewQueueItem,
  RiskListEntry,
  RiskSignal,
  RiskSummary,
  ScoreBreakdown,
} from "../../../packages/risk/src/index.js";
import {
  buildPolicyDecisionExplanation,
  buildPropagationExplanation,
  buildRecoveryExplanation,
  buildReviewQueueExplanation,
  buildRiskSummaryExplanation,
  normalizeAiSuggestion,
} from "../../../packages/risk/src/index.js";
import { IdentityState, type CrossChainInboxItem, type IdentityStateContext } from "../../../packages/state/src/index.js";
import { analyzerConfig } from "./config.js";

export type AnalyzerIdentityRecord = {
  kind: "root" | "sub";
  rootIdentity: RootIdentity;
  subIdentity?: SubIdentity;
  riskRecord?: IdentityRiskRecord;
  summary?: RiskSummary;
  score?: ScoreBreakdown;
  stateContext?: IdentityStateContext;
  signals: RiskSignal[];
  manualSignals: RiskSignal[];
  listEntries: RiskListEntry[];
  manualListActions: ManualListAction[];
  manualReleaseWindow?: ManualReleaseWindow;
  lastComputedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AnalyzerWatcherRecord = {
  watchId: string;
  scope: "root" | "identity";
  identityId?: string;
  rootIdentityId: string;
  recentBlocks: number;
  pollIntervalMs: number;
  status: "ACTIVE" | "STOPPED";
  createdAt: string;
  updatedAt: string;
  lastScanStartedAt?: string;
  lastScanCompletedAt?: string;
  lastError?: string;
};

export type OperationReceipt = {
  idempotencyKey: string;
  operation: string;
  createdAt: string;
  result: Record<string, unknown>;
};

export type WebhookOutboxItem = {
  eventId: string;
  topic: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
  attemptCount: number;
  payload: Record<string, unknown>;
  createdAt: string;
  deliveredAt?: string;
  lastError?: string;
};

export type AnalyzerRuntimeMetrics = {
  startedAt: string;
  storeReads: number;
  storeWrites: number;
  lastReadAt?: string;
  lastWriteAt?: string;
  lastWriteDurationMs?: number;
  queuedWebhookEvents: number;
};

export type AnalyzerStore = {
  roots: Record<string, { rootIdentity: RootIdentity; subIdentityIds: string[] }>;
  identities: Record<string, AnalyzerIdentityRecord>;
  subjectAggregates: Record<string, SubjectAggregate>;
  subjectAggregateRootIndex: Record<string, string>;
  subjectAggregateControllerIndex: Record<string, string>;
  bindings: Record<string, BehaviorBinding>;
  bindingChallenges: Record<string, BindingChallenge>;
  bindingReplayKeys: Record<string, string>;
  events: Record<string, BehaviorEvent>;
  aiSuggestions: Record<string, AiSuggestion>;
  reviewQueue: Record<string, ReviewQueueItem>;
  audits: Record<string, AuditRecord>;
  anchorQueue: Record<string, AnchorQueueEntry>;
  watchers: Record<string, AnalyzerWatcherRecord>;
  policyDecisions: Record<string, PolicyDecisionRecord>;
  recoveryCases: Record<string, RecoveryCase>;
  crossChainInbox: Record<string, CrossChainInboxItem>;
  approvalTickets: Record<string, ApprovalTicket>;
  operationReceipts: Record<string, OperationReceipt>;
  webhookOutbox: Record<string, WebhookOutboxItem>;
  runtimeMetrics: AnalyzerRuntimeMetrics;
};

function createEmptyStore(): AnalyzerStore {
  return {
    roots: {},
    identities: {},
    subjectAggregates: {},
    subjectAggregateRootIndex: {},
    subjectAggregateControllerIndex: {},
    bindings: {},
    bindingChallenges: {},
    bindingReplayKeys: {},
    events: {},
    aiSuggestions: {},
    reviewQueue: {},
    audits: {},
    anchorQueue: {},
    watchers: {},
    policyDecisions: {},
    recoveryCases: {},
    crossChainInbox: {},
    approvalTickets: {},
    operationReceipts: {},
    webhookOutbox: {},
    runtimeMetrics: {
      startedAt: new Date().toISOString(),
      storeReads: 0,
      storeWrites: 0,
      queuedWebhookEvents: 0,
    },
  };
}

const STORE_READ_RETRIES = 2;
const STORE_READ_RETRY_DELAY_MS = 25;
let storeWriteQueue: Promise<void> = Promise.resolve();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeIdentityRecord(record: AnalyzerIdentityRecord): AnalyzerIdentityRecord {
  if (!record.summary) {
    return record;
  }

  const latestAssessmentId = record.stateContext?.assessments.at(-1)?.assessmentId ?? null;
  const latestDecisionId = record.stateContext?.decisions.at(-1)?.decisionId ?? record.stateContext?.lastDecisionRef ?? record.riskRecord?.lastDecisionId ?? null;
  const summaryEvidenceRefs = record.summary.evidenceRefs ?? [];
  const summaryReasonCodes = record.summary.reasonCodes ?? [];

  return {
    ...record,
    summary: {
      ...record.summary,
      recoveryProgress: record.summary.recoveryProgress
        ? {
            ...record.summary.recoveryProgress,
            explanation: record.summary.recoveryProgress.explanation ?? buildRecoveryExplanation({
              releaseFloorActive: record.summary.recoveryProgress.releaseFloorActive,
              floorUntil: record.summary.recoveryProgress.floorUntil,
              helpfulPositiveSignals: record.summary.recoveryProgress.helpfulPositiveSignals,
              evidenceRefs: summaryEvidenceRefs,
              sourceDecisionId: latestDecisionId,
            }),
          }
        : undefined,
      propagation: record.summary.propagation
        ? {
            ...record.summary.propagation,
            explanation: record.summary.propagation.explanation ?? buildPropagationExplanation({
              reasonCodes: record.summary.propagation.reasonCodes,
              warnings: record.summary.propagation.warnings,
              evidenceRefs: summaryEvidenceRefs,
              sourceDecisionId: latestDecisionId,
            }),
          }
        : undefined,
      explanation: record.summary.explanation ?? buildRiskSummaryExplanation({
        summary: {
          storedState: record.summary.storedState,
          effectiveState: record.summary.effectiveState,
          reasonCodes: summaryReasonCodes,
          evidenceRefs: summaryEvidenceRefs,
        },
        sourceAssessmentId: latestAssessmentId,
        sourceDecisionId: latestDecisionId,
        actorType: "system",
        actorId: "analyzer-store",
      }),
    },
  };
}

function normalizeReviewQueueItem(item: ReviewQueueItem): ReviewQueueItem {
  return {
    ...item,
    explanation: item.explanation ?? buildReviewQueueExplanation({
      reviewItemId: item.reviewItemId,
      status: item.status,
      evidenceRefs: item.evidenceRefs ?? [],
      sourceSuggestionId: item.sourceSuggestionId,
      reason: item.reason,
      actor: item.confirmedBy ?? item.dismissedBy ?? null,
    }),
  };
}

function normalizePolicyDecisionRecord(record: PolicyDecisionRecord, identityRecord?: AnalyzerIdentityRecord): PolicyDecisionRecord {
  return {
    ...record,
    explanation: record.explanation ?? buildPolicyDecisionExplanation({
      decision: record.decision,
      state: identityRecord?.summary?.effectiveState ?? identityRecord?.riskRecord?.effectiveState ?? IdentityState.NORMAL,
      reasons: record.reasons ?? [],
      warnings: record.warnings ?? [],
      evidenceRefs: record.evidenceRefs ?? [],
      policyVersion: record.policyVersion,
      policyLabel: record.policyLabel,
      sourceDecisionId: identityRecord?.riskRecord?.lastDecisionId ?? null,
      modePath: record.modePath,
      actorType: "policy_engine",
      actorId: "analyzer-store",
    }),
  };
}

function normalizeStore(parsed: Partial<AnalyzerStore>): AnalyzerStore {
  const normalizedIdentities = Object.fromEntries(
    Object.entries(parsed.identities ?? {}).map(([id, record]) => [
      id,
      normalizeIdentityRecord(record as AnalyzerIdentityRecord),
    ]),
  );
  const normalizedAiSuggestions = Object.fromEntries(
    Object.entries(parsed.aiSuggestions ?? {}).map(([id, suggestion]) => [
      id,
      normalizeAiSuggestion({
        ...(suggestion as AiSuggestion),
        id: suggestion.id ?? id,
      }),
    ]),
  );
  const normalizedReviewQueue = Object.fromEntries(
    Object.entries(parsed.reviewQueue ?? {}).map(([id, item]) => [
      id,
      normalizeReviewQueueItem(item as ReviewQueueItem),
    ]),
  );
  const normalizedPolicyDecisions = Object.fromEntries(
    Object.entries(parsed.policyDecisions ?? {}).map(([id, item]) => [
      id,
      normalizePolicyDecisionRecord(item as PolicyDecisionRecord, normalizedIdentities[(item as PolicyDecisionRecord).identityId]),
    ]),
  );

  return {
    roots: parsed.roots ?? {},
    identities: normalizedIdentities,
    subjectAggregates: parsed.subjectAggregates ?? {},
    subjectAggregateRootIndex: parsed.subjectAggregateRootIndex ?? {},
    subjectAggregateControllerIndex: parsed.subjectAggregateControllerIndex ?? {},
    bindings: parsed.bindings ?? {},
    bindingChallenges: parsed.bindingChallenges ?? {},
    bindingReplayKeys: parsed.bindingReplayKeys ?? {},
    events: parsed.events ?? {},
    aiSuggestions: normalizedAiSuggestions,
    reviewQueue: normalizedReviewQueue,
    audits: parsed.audits ?? {},
    anchorQueue: parsed.anchorQueue ?? {},
    watchers: parsed.watchers ?? {},
    policyDecisions: normalizedPolicyDecisions,
    recoveryCases: parsed.recoveryCases ?? {},
    crossChainInbox: parsed.crossChainInbox ?? {},
    approvalTickets: parsed.approvalTickets ?? {},
    operationReceipts: parsed.operationReceipts ?? {},
    webhookOutbox: parsed.webhookOutbox ?? {},
    runtimeMetrics: {
      startedAt: parsed.runtimeMetrics?.startedAt ?? new Date().toISOString(),
      storeReads: parsed.runtimeMetrics?.storeReads ?? 0,
      storeWrites: parsed.runtimeMetrics?.storeWrites ?? 0,
      lastReadAt: parsed.runtimeMetrics?.lastReadAt,
      lastWriteAt: parsed.runtimeMetrics?.lastWriteAt,
      lastWriteDurationMs: parsed.runtimeMetrics?.lastWriteDurationMs,
      queuedWebhookEvents: parsed.runtimeMetrics?.queuedWebhookEvents ?? Object.keys(parsed.webhookOutbox ?? {}).length,
    },
  };
}

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    return { __bigint: value.toString() };
  }
  return value;
}

function jsonReviver(_key: string, value: unknown) {
  if (value && typeof value === "object" && "__bigint" in (value as Record<string, unknown>)) {
    return BigInt((value as { __bigint: string }).__bigint);
  }
  return value;
}

export async function loadStore(): Promise<AnalyzerStore> {
  for (let attempt = 0; attempt <= STORE_READ_RETRIES; attempt += 1) {
    try {
      const raw = await readFile(analyzerConfig.dataFile, "utf8");
      const parsed = JSON.parse(raw, jsonReviver) as Partial<AnalyzerStore>;
      const store = normalizeStore(parsed);
      store.runtimeMetrics.storeReads += 1;
      store.runtimeMetrics.lastReadAt = new Date().toISOString();
      return store;
    } catch (error) {
      const errorCode = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
      if (errorCode === "ENOENT") {
        return createEmptyStore();
      }
      if (error instanceof SyntaxError && attempt < STORE_READ_RETRIES) {
        await delay(STORE_READ_RETRY_DELAY_MS);
        continue;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to load analyzer store at ${analyzerConfig.dataFile}: ${error.message}`, { cause: error });
      }
      throw new Error(`Failed to load analyzer store at ${analyzerConfig.dataFile}.`);
    }
  }

  return createEmptyStore();
}

export async function saveStore(store: AnalyzerStore) {
  const writeStartedAt = Date.now();
  store.runtimeMetrics.storeWrites += 1;
  store.runtimeMetrics.lastWriteAt = new Date().toISOString();
  store.runtimeMetrics.queuedWebhookEvents = Object.values(store.webhookOutbox).filter((item) => item.status === "PENDING").length;
  const payload = JSON.stringify(store, jsonReplacer, 2);
  const tempFile = `${analyzerConfig.dataFile}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  const writeOperation = storeWriteQueue
    .catch(() => undefined)
    .then(async () => {
      let renamed = false;
      await writeFile(tempFile, payload, "utf8");
      try {
        await rename(tempFile, analyzerConfig.dataFile);
        renamed = true;
      } catch {
        await rm(analyzerConfig.dataFile, { force: true });
        await rename(tempFile, analyzerConfig.dataFile);
        renamed = true;
      } finally {
        if (!renamed) {
          await rm(tempFile, { force: true }).catch(() => undefined);
        }
      }
    });

  storeWriteQueue = writeOperation;
  await writeOperation;
  store.runtimeMetrics.lastWriteDurationMs = Date.now() - writeStartedAt;
}

