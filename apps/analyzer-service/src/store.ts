import { readFile, rename, rm, writeFile } from "node:fs/promises";
import type { RootIdentity, SubIdentity } from "../../../packages/identity/src/index.js";
import type {
  AiSuggestion,
  AnchorQueueEntry,
  AuditRecord,
  BehaviorBinding,
  BehaviorEvent,
  BindingChallenge,
  IdentityRiskRecord,
  ManualReleaseWindow,
  ManualListAction,
  ReviewQueueItem,
  RiskListEntry,
  RiskSignal,
  RiskSummary,
  ScoreBreakdown,
} from "../../../packages/risk/src/index.js";
import { normalizeAiSuggestion } from "../../../packages/risk/src/index.js";
import type { IdentityStateContext } from "../../../packages/state/src/index.js";
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

export type AnalyzerStore = {
  roots: Record<string, { rootIdentity: RootIdentity; subIdentityIds: string[] }>;
  identities: Record<string, AnalyzerIdentityRecord>;
  bindings: Record<string, BehaviorBinding>;
  bindingChallenges: Record<string, BindingChallenge>;
  events: Record<string, BehaviorEvent>;
  aiSuggestions: Record<string, AiSuggestion>;
  reviewQueue: Record<string, ReviewQueueItem>;
  audits: Record<string, AuditRecord>;
  anchorQueue: Record<string, AnchorQueueEntry>;
  watchers: Record<string, AnalyzerWatcherRecord>;
};

function createEmptyStore(): AnalyzerStore {
  return {
    roots: {},
    identities: {},
    bindings: {},
    bindingChallenges: {},
    events: {},
    aiSuggestions: {},
    reviewQueue: {},
    audits: {},
    anchorQueue: {},
    watchers: {},
  };
}

const STORE_READ_RETRIES = 2;
const STORE_READ_RETRY_DELAY_MS = 25;
let storeWriteQueue: Promise<void> = Promise.resolve();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStore(parsed: Partial<AnalyzerStore>): AnalyzerStore {
  const normalizedAiSuggestions = Object.fromEntries(
    Object.entries(parsed.aiSuggestions ?? {}).map(([id, suggestion]) => [
      id,
      normalizeAiSuggestion({
        ...(suggestion as AiSuggestion),
        id: suggestion.id ?? id,
      }),
    ]),
  );

  return {
    roots: parsed.roots ?? {},
    identities: parsed.identities ?? {},
    bindings: parsed.bindings ?? {},
    bindingChallenges: parsed.bindingChallenges ?? {},
    events: parsed.events ?? {},
    aiSuggestions: normalizedAiSuggestions,
    reviewQueue: parsed.reviewQueue ?? {},
    audits: parsed.audits ?? {},
    anchorQueue: parsed.anchorQueue ?? {},
    watchers: parsed.watchers ?? {},
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
      return normalizeStore(parsed);
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
}

