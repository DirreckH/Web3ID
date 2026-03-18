import { IdentityState } from "../../state/src/index.js";
import { keccak256, stringToHex, type Hex } from "viem";
import type { AiSuggestion, ManualListAction, RiskListEntry, RiskListName, RiskSummary } from "./types.js";

export const RISK_LIST_STATE_MATRIX = {
  watchlist: [IdentityState.OBSERVED],
  restricted_list: [IdentityState.RESTRICTED, IdentityState.HIGH_RISK],
  blacklist_or_frozen_list: [IdentityState.FROZEN],
} satisfies Record<RiskListName, IdentityState[]>;

export function statesForRiskList(listName: RiskListName) {
  return [...RISK_LIST_STATE_MATRIX[listName]];
}

export function primaryStateForRiskList(listName: RiskListName) {
  return RISK_LIST_STATE_MATRIX[listName][0];
}

export function listNameForIdentityState(state: IdentityState): RiskListName | null {
  if (state === IdentityState.OBSERVED) {
    return "watchlist";
  }
  if (state === IdentityState.RESTRICTED || state === IdentityState.HIGH_RISK) {
    return "restricted_list";
  }
  if (state === IdentityState.FROZEN) {
    return "blacklist_or_frozen_list";
  }
  return null;
}

export function normalizeRiskListEntryState(listName: RiskListName, state?: IdentityState) {
  if (state !== undefined && statesForRiskList(listName).some((allowedState) => allowedState === state)) {
    return state;
  }
  return primaryStateForRiskList(listName);
}

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

  const baseListName = listNameForIdentityState(input.state);
  if (baseListName) {
    entries.push({
      entryId: makeEntryId(input.identityId, baseListName, input.reasonCode),
      listName: baseListName,
      state: normalizeRiskListEntryState(baseListName, input.state),
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
      state: normalizeRiskListEntryState("watchlist"),
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
        state: normalizeRiskListEntryState(action.listName),
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
