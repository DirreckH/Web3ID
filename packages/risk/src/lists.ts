import { IdentityState } from "../../state/src/index.js";
import { keccak256, stringToHex, type Hex } from "viem";
import type { AiSuggestion, ManualListAction, RiskListEntry, RiskSummary } from "./types.js";

function makeEntryId(identityId: Hex, listName: string, reasonCode: string) {
  return keccak256(stringToHex([identityId, listName, reasonCode].join(":")));
}

export function deriveListEntries(input: {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  state: IdentityState;
  reasonCode: string;
  sourceSignalIds: string[];
  sourceDecisionId?: string;
  evidenceRefs: string[];
  aiSuggestions?: AiSuggestion[];
  manualActions?: ManualListAction[];
  now?: string;
}): RiskListEntry[] {
  const now = input.now ?? new Date().toISOString();
  const entries: RiskListEntry[] = [];
  const base = {
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    reasonCode: input.reasonCode,
    sourceDecisionId: input.sourceDecisionId,
    sourceSignalIds: input.sourceSignalIds,
    addedBy: "risk-engine",
    addedAt: now,
    evidenceRefs: input.evidenceRefs,
  };

  if (input.state === IdentityState.OBSERVED) {
    entries.push({
      entryId: makeEntryId(input.identityId, "watchlist", input.reasonCode),
      listName: "watchlist",
      state: input.state,
      ...base,
    });
  }
  if (input.state === IdentityState.RESTRICTED || input.state === IdentityState.HIGH_RISK) {
    entries.push({
      entryId: makeEntryId(input.identityId, "restricted_list", input.reasonCode),
      listName: "restricted_list",
      state: input.state,
      ...base,
    });
  }
  if (input.state === IdentityState.FROZEN) {
    entries.push({
      entryId: makeEntryId(input.identityId, "blacklist_or_frozen_list", input.reasonCode),
      listName: "blacklist_or_frozen_list",
      state: input.state,
      ...base,
    });
  }

  for (const suggestion of input.aiSuggestions ?? []) {
    if (!suggestion.recommendedAction || suggestion.recommendedAction === "warn_only") {
      continue;
    }
    entries.push({
      entryId: makeEntryId(input.identityId, "watchlist", suggestion.id),
      listName: "watchlist",
      identityId: input.identityId,
      rootIdentityId: input.rootIdentityId,
      subIdentityId: input.subIdentityId,
      state: input.state,
      reasonCode: suggestion.recommendedAction === "review" ? "AI_REVIEW_QUEUE" : "AI_WATCH_HINT",
      sourceSignalIds: [],
      sourceSuggestionId: suggestion.id,
      addedBy: "ai-assistant",
      addedAt: suggestion.createdAt,
      evidenceRefs: suggestion.evidenceRefs,
    });
  }

  return applyManualListActions(entries, input.manualActions ?? [], now);
}

export function applyManualListActions(entries: RiskListEntry[], manualActions: ManualListAction[], now = new Date().toISOString()) {
  let next = [...entries];
  for (const action of manualActions) {
    if (action.action === "add") {
      next.push({
        entryId: makeEntryId(action.identityId, action.listName, action.reasonCode),
        listName: action.listName,
        identityId: action.identityId,
        rootIdentityId: action.rootIdentityId,
        subIdentityId: action.subIdentityId,
        state: IdentityState.OBSERVED,
        reasonCode: action.reasonCode,
        sourceSignalIds: [],
        addedBy: action.actor,
        addedAt: now,
        expiresAt: action.expiresAt,
        evidenceRefs: action.evidenceRefs,
      });
      continue;
    }

    next = next.map((entry) =>
      entry.identityId === action.identityId && entry.listName === action.listName
        ? {
            ...entry,
            removedAt: now,
            removalReason: action.reasonCode,
          }
        : entry,
    );
  }
  return next;
}

export function summarizeLists(entries: RiskListEntry[]) {
  return {
    watchlist: entries.filter((entry) => entry.listName === "watchlist" && !entry.removedAt),
    restrictedList: entries.filter((entry) => entry.listName === "restricted_list" && !entry.removedAt),
    blacklistOrFrozenList: entries.filter((entry) => entry.listName === "blacklist_or_frozen_list" && !entry.removedAt),
  } satisfies Pick<RiskSummary, "watchlist" | "restrictedList" | "blacklistOrFrozenList">;
}
