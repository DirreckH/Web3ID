import type { Address, Hex } from "viem";
import type { IdentityState, RiskSignal as BaseRiskSignal } from "../../state/src/index.js";

export type BehaviorKind =
  | "native_transfer"
  | "erc20_transfer"
  | "nft_transfer"
  | "contract_call"
  | "dex_interaction"
  | "lending_interaction"
  | "governance_vote"
  | "governance_delegate"
  | "bridge_interaction"
  | "mixer_interaction"
  | "sanctioned_interaction"
  | "high_risk_counterparty"
  | "trusted_defi_interaction"
  | "unknown_contract_repetition";

export type BehaviorDirection = "incoming" | "outgoing" | "self" | "unknown";
export type BindingType = "root_controller" | "sub_identity_link" | "same_root_extension";
export type BindingStatus = "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";
export type IdentityRecordKind = "root" | "sub";
export type ReviewQueueStatus = "PENDING_REVIEW" | "CONFIRMED_SIGNAL" | "DISMISSED" | "EXPIRED";
export type AuditAction =
  | "BINDING_CHALLENGE_CREATED"
  | "BINDING_CREATED"
  | "BINDING_REJECTED"
  | "BEHAVIOR_INGESTED"
  | "RULE_MATCHED"
  | "SCORE_COMPUTED"
  | "STATE_COMPUTED"
  | "LIST_UPDATED"
  | "ANCHOR_QUEUED"
  | "ANCHOR_SYNCED"
  | "AI_SUGGESTION_CREATED"
  | "AI_REVIEW_ITEM_OPENED"
  | "AI_REVIEW_ITEM_CONFIRMED"
  | "AI_REVIEW_ITEM_EXPIRED"
  | "AI_REVIEW_ITEM_DISMISSED"
  | "CONFIRMED_SIGNAL_CREATED"
  | "MANUAL_RELEASE_APPLIED"
  | "POLICY_DECISION_MADE"
  | "WATCH_UPDATED";
export type WarningDecisionLevel = "info" | "warn" | "high_warn";
export type AccessDecisionLevel = "allow" | "restrict" | "deny";
export type AiSuggestionKind = "risk_hint" | "pattern_flag" | "explanation";
export type AiRecommendedAction = "watch" | "review" | "warn_only";

export type BehaviorBinding = {
  bindingId: string;
  type: BindingType;
  status: BindingStatus;
  address: Address;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  authorizerAddress?: Address;
  createdAt: string;
  expiresAt?: string;
  evidenceRefs: string[];
  bindingHash: Hex;
  metadata?: Record<string, unknown>;
};

export type BehaviorEvent = {
  eventId: string;
  chainId: number;
  txHash: Hex;
  txIndex: number;
  logIndex?: number;
  blockNumber: bigint;
  blockTimestamp: string;
  address: Address;
  direction: BehaviorDirection;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  bindingId: string;
  kind: BehaviorKind;
  label: string;
  protocolTags: string[];
  counterparty?: Address;
  counterpartyLabel?: string;
  contractAddress?: Address;
  value: bigint;
  rawRef: string;
  evidenceRefs: string[];
  metadata?: Record<string, unknown>;
};

export type RiskSignal = BaseRiskSignal & {
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  registryVersion: number;
  ruleId: string;
  ruleFamily: string;
  ruleWeight: number;
  sourceEventId?: string;
  sourceSuggestionId?: string;
  signalClass: "deterministic" | "confirmed_ai" | "manual" | "synthetic_reentry";
  evidenceRefs: string[];
};

export type ScoreContribution = {
  ruleId: string;
  behaviorEventId?: string;
  signalId?: string;
  riskDelta: number;
  reputationDelta: number;
  confidenceDelta: number;
  decayFactor: number;
  effectiveRiskDelta: number;
  effectiveReputationDelta: number;
  effectiveConfidenceDelta: number;
  reason: string;
};

export type ScoreBreakdown = {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  registryVersion: number;
  scoringVersion: number;
  evaluatedAt: string;
  riskScore: number;
  reputationScore: number;
  confidenceScore: number;
  finalInternalScore: number;
  positiveSignalCount: number;
  negativeSignalCount: number;
  contributionCount: number;
  contributions: ScoreContribution[];
};

export type RiskListName = "watchlist" | "restricted_list" | "blacklist_or_frozen_list";

export type RiskListEntry = {
  entryId: string;
  listName: RiskListName;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  state: IdentityState;
  reasonCode: string;
  sourceDecisionId?: string;
  sourceSignalIds: string[];
  sourceSuggestionId?: string;
  addedBy: string;
  addedAt: string;
  expiresAt?: string;
  removedAt?: string;
  removalReason?: string;
  evidenceRefs: string[];
};

export type AuditRecord = {
  auditId: string;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  action: AuditAction;
  timestamp: string;
  actor: string;
  ruleIds: string[];
  evidenceRefs: string[];
  policyVersion?: number;
  registryVersion?: number;
  aiSuggestionId?: string;
  reviewItemId?: string;
  metadata?: Record<string, unknown>;
};

export type AiSuggestionAudit = {
  provider: string;
  model: string;
  modelVersion: string;
  promptVersion: string;
  inputHash: Hex;
  evidenceRefs: string[];
  outputSummary: string;
  confidence: number;
  recommendedAction: AiRecommendedAction;
};

export type AiSuggestion = {
  id: string;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  kind: AiSuggestionKind;
  severity: "low" | "medium" | "high";
  summary: string;
  evidenceRefs: string[];
  recommendedAction?: AiRecommendedAction;
  audit: AiSuggestionAudit;
  modelInfo?: {
    provider: string;
    model: string;
    promptVersion: string;
  };
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type ReviewQueueItem = {
  reviewItemId: string;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  sourceSuggestionId: string;
  status: ReviewQueueStatus;
  createdAt: string;
  expiresAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  expiredAt?: string;
  reason?: string;
  evidenceRefs: string[];
};

export type ReviewQueueCounts = {
  pending: number;
  confirmed: number;
  dismissed: number;
  expired: number;
};

export type ManualReleaseWindow = {
  releasedAt: string;
  floorState: IdentityState;
  floorUntil: string;
};

export type ActiveManualOverridesSummary = {
  activeManualSignals: RiskSignal[];
  activeManualListActions: ManualListAction[];
  releaseFloorActive: boolean;
};

export type WatchSummaryItem = {
  watchId: string;
  scope: "root" | "identity";
  identityId?: Hex;
  rootIdentityId: Hex;
  status: "ACTIVE" | "STOPPED";
  recentBlocks: number;
  pollIntervalMs: number;
  lastScanStartedAt?: string;
  lastScanCompletedAt?: string;
  lastError?: string;
};

export type WatchStatusSummary = {
  active: boolean;
  items: WatchSummaryItem[];
};

export type RiskSummary = {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  storedState: IdentityState;
  effectiveState: IdentityState;
  anchoredState?: IdentityState;
  riskScore: number;
  reputationScore: number;
  confidenceScore: number;
  finalInternalScore: number;
  reasonCodes: string[];
  warnings: string[];
  evidenceRefs: string[];
  watchlist: RiskListEntry[];
  restrictedList: RiskListEntry[];
  blacklistOrFrozenList: RiskListEntry[];
  manualReleaseWindow?: ManualReleaseWindow | null;
  activeManualOverrides?: ActiveManualOverridesSummary;
  watchStatus?: WatchStatusSummary;
  reviewQueueCounts?: ReviewQueueCounts;
};

export type CredentialDecisionReason = {
  code: string;
  message: string;
};

export type PolicyDecision = {
  decision: AccessDecisionLevel | WarningDecisionLevel;
  state: IdentityState;
  reasons: string[];
  warnings: string[];
  evidenceRefs: string[];
  policyVersion: number;
  credentialReasons?: CredentialDecisionReason[];
  riskReasons?: CredentialDecisionReason[];
  policyReasons?: CredentialDecisionReason[];
  auditRecordIds?: string[];
};

export type BindingChallenge = {
  challengeId: string;
  challengeHash: Hex;
  challengeMessage: string;
  bindingType: BindingType;
  candidateAddress: Address;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  createdAt: string;
  expiresAt: string;
};

export type AnchorQueueStatus = "PENDING" | "SYNCED" | "FAILED" | "SKIPPED";

export type AnchorQueueEntry = {
  anchorId: string;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  storedState: IdentityState;
  effectiveState: IdentityState;
  stateHash: Hex;
  evidenceBundleHash: Hex;
  reasonCode: Hex;
  policyVersion: number;
  registryVersion: number;
  anchorSeq: number;
  queuedAt: string;
  status: AnchorQueueStatus;
  shouldMaterializeState: boolean;
  syncedAt?: string;
  transactionHash?: Hex;
  error?: string;
};

export type ManualListAction = {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  listName: RiskListName;
  actor: string;
  action: "add" | "remove";
  reasonCode: string;
  evidenceRefs: string[];
  expiresAt?: string;
};

export type IdentityRiskRecord = {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  kind: IdentityRecordKind;
  storedState: IdentityState;
  effectiveState: IdentityState;
  anchoredState?: IdentityState;
  anchoredStateHash?: Hex;
  lastEvidenceBundleHash?: Hex;
  lastDecisionId?: string;
  updatedAt: string;
};
