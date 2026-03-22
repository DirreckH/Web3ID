import type { Address, Hex } from "viem";
import type {
  ConsequenceRecord,
  CrossChainInboxItem,
  ExplanationBlock,
  IdentityState,
  RiskAssessment,
  RiskSignal as BaseRiskSignal,
  StateTransitionDecision,
  VersionEnvelope,
} from "../../state/src/index.js";
import type { ChainControllerRef, ControllerBindingType, ControllerChallengeFields } from "../../identity/src/index.js";

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
export type BindingType = ControllerBindingType;
export type BindingStatus = "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";
export type IdentityRecordKind = "root" | "sub";
export type ReviewQueueStatus = "PENDING_REVIEW" | "CONFIRMED_SIGNAL" | "DISMISSED" | "EXPIRED";
export type AuditAction =
  | "SUBJECT_AGGREGATE_CREATED"
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
  | "WATCH_UPDATED"
  | "RECOVERY_CASE_CREATED"
  | "RECOVERY_EVIDENCE_ADDED"
  | "RECOVERY_DECISION_RECORDED"
  | "RECOVERY_EXECUTED"
  | "RECOVERY_OUTCOME_RECORDED"
  | "APPROVAL_TICKET_CREATED"
  | "APPROVAL_TICKET_APPROVED"
  | "APPROVAL_TICKET_REJECTED"
  | "APPROVAL_TICKET_CANCELLED"
  | "CROSS_CHAIN_MESSAGE_CREATED"
  | "CROSS_CHAIN_MESSAGE_INGESTED"
  | "CROSS_CHAIN_MESSAGE_CONSUMED"
  | "WEBHOOK_EVENT_QUEUED";
export type WarningDecisionLevel = "info" | "warn" | "high_warn";
export type AccessDecisionLevel = "allow" | "restrict" | "deny";
export type AiSuggestionKind = "risk_hint" | "pattern_flag" | "explanation";
export type AiRecommendedAction = "watch" | "review" | "warn_only";
export type PolicyDecisionKind = "access" | "warning";
export type PolicyModePath = "DEFAULT_BEHAVIOR_MODE" | "COMPLIANCE_MODE" | "UNRESOLVED";

export type BehaviorBinding = {
  bindingId: string;
  type: BindingType;
  status: BindingStatus;
  address?: Address;
  controllerRef: ChainControllerRef;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  subjectAggregateId?: string;
  authorizerAddress?: Address;
  createdAt: string;
  expiresAt?: string;
  evidenceRefs: string[];
  bindingHash: Hex;
  challengeHash?: Hex;
  proofHash?: Hex;
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
  explanation?: ExplanationBlock;
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
  versionEnvelope?: VersionEnvelope;
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
  explanation: ExplanationBlock;
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
  explanation: ExplanationBlock;
  versionEnvelope?: VersionEnvelope;
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

export type PositiveSummary = {
  activePositiveSignals: RiskSignal[];
  activeUnlocks: ConsequenceRecord[];
  activeRestrictions: ConsequenceRecord[];
  demoDefaults: boolean;
};

export type RecoveryProgressSummary = {
  releaseFloorActive: boolean;
  floorUntil: string | null;
  cooldownRemainingDays: number;
  activeRestrictions: string[];
  activeUnlocks: string[];
  helpfulPositiveSignals: string[];
  explanation: ExplanationBlock;
};

export type PropagationSummary = {
  reasonCodes: string[];
  warnings: string[];
  siblingOverlayState?: IdentityState;
  rootEffectiveFloorState?: IdentityState;
  explanation: ExplanationBlock;
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
  positiveSummary?: PositiveSummary;
  recoveryProgress?: RecoveryProgressSummary;
  propagation?: PropagationSummary;
  explanation: ExplanationBlock;
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
  explanation: ExplanationBlock;
};

export type PolicyDecisionRecord = {
  decisionId: string;
  kind: PolicyDecisionKind;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  policyId: string;
  policyLabel: string;
  policyVersion: number;
  modePath: PolicyModePath;
  decision: AccessDecisionLevel | WarningDecisionLevel;
  reasons: string[];
  warnings: string[];
  evidenceRefs: string[];
  createdAt: string;
  auditRecordIds: string[];
  explanation: ExplanationBlock;
  versionEnvelope?: VersionEnvelope;
};

export type OperatorRole =
  | "viewer"
  | "analyst"
  | "operator"
  | "recovery_operator"
  | "governance_reviewer"
  | "auditor"
  | "admin";

export type ApprovalAction =
  | "recovery_execution"
  | "break_glass"
  | "positive_uplift"
  | "policy_exception"
  | "cross_chain_consume";

export type ApprovalTicket = {
  ticketId: string;
  action: ApprovalAction;
  rootIdentityId: Hex;
  identityId?: Hex;
  requiredRoles: OperatorRole[];
  requiredApprovals: number;
  approvedBy: string[];
  status: "pending" | "approved" | "rejected" | "cancelled";
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  reasonCode: string;
  explanation: string;
  createdAt: string;
  updatedAt: string;
  versionEnvelope: VersionEnvelope;
};

export type BindingChallenge = {
  challengeId: string;
  challengeHash: Hex;
  challengeMessage: string;
  challengeFields: ControllerChallengeFields;
  bindingType: BindingType;
  candidateAddress?: Address;
  controllerRef: ChainControllerRef;
  rootIdentityId?: Hex;
  subIdentityId?: Hex;
  subjectAggregateId?: string;
  replayKey: string;
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

export type RiskListHistoryItem = {
  itemId: string;
  entryId?: string;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  listName: RiskListName;
  state: IdentityState;
  action: "auto_added" | "manually_added" | "removed" | "expired";
  timestamp: string;
  reasonCode: string;
  actor: string;
  evidenceRefs: string[];
  sourceDecisionId?: string;
  removalReason?: string;
  expiresAt?: string;
  explanation: ExplanationBlock;
};

export type ExplanationChainEntry = {
  objectKind:
    | "signal"
    | "assessment"
    | "decision"
    | "consequence"
    | "policy_decision"
    | "ai_review"
    | "propagation"
    | "recovery";
  objectId: string;
  identityId: Hex;
  explanation: ExplanationBlock;
  linkedTo: string[];
};

export type AuditExportConsistency = {
  complete: boolean;
  missingSegments: string[];
  unavailableSegments: string[];
};

export type OperatorDashboardSnapshot = {
  generatedAt: string;
  counts: {
    highRiskIdentities: number;
    frozenIdentities: number;
    pendingReviewItems: number;
    pendingAiReviews: number;
    activeWatchers: number;
    pendingRecoveryCases?: number;
    pendingApprovalTickets?: number;
    activePositiveUplifts?: number;
  };
  recentStateEscalations: AuditRecord[];
  recentHighRiskOrFrozen: AuditRecord[];
  recentManualReleases: AuditRecord[];
  recentWarningPolicies: PolicyDecisionRecord[];
  recentPolicyDecisions: PolicyDecisionRecord[];
  recentApprovalTickets?: ApprovalTicket[];
  positiveUpliftNotes?: string[];
  versionEnvelope?: VersionEnvelope;
};

export type AuditExportBundle = {
  generatedAt: string;
  filters: {
    identityId?: Hex;
    rootIdentityId?: Hex;
    subIdentityId?: Hex;
    from?: string;
    to?: string;
    policyId?: string;
    policyKind?: PolicyDecisionKind;
  };
  identities: Hex[];
  subjectAggregates?: Array<Record<string, unknown>>;
  signals: RiskSignal[];
  assessments: RiskAssessment[];
  decisions: StateTransitionDecision[];
  consequences: ConsequenceRecord[];
  propagation: Array<{ identityId: Hex; summary: PropagationSummary | null }>;
  reentryRecovery: Array<{
    identityId: Hex;
    manualReleaseWindow?: ManualReleaseWindow | null;
    recoveryProgress?: RecoveryProgressSummary;
    positiveSummary?: PositiveSummary;
  }>;
  aiSuggestions: AiSuggestion[];
  reviewQueue: ReviewQueueItem[];
  policyDecisions: PolicyDecisionRecord[];
  anchors: AnchorQueueEntry[];
  crossChainInbox?: CrossChainInboxItem[];
  auditRecords: AuditRecord[];
  records: AuditRecord[];
  explanationChain: ExplanationChainEntry[];
  consistency: AuditExportConsistency;
  approvalTickets?: ApprovalTicket[];
  versionEnvelope?: VersionEnvelope;
};

export type ReplayTrace = {
  identityId: Hex;
  rootIdentityId: Hex;
  asOf: string;
  storedState: IdentityState | null;
  effectiveState: IdentityState | null;
  reasonCodes: string[];
  warnings: string[];
  policyDecisions: PolicyDecisionRecord[];
  recoveryCases: Array<{
    caseId: string;
    action: string;
    status: string;
    updatedAt: string;
  }>;
  crossChainInbox: Array<{
    inboxId: string;
    verified: boolean;
    consumed: boolean;
    reasonCode: string;
    createdAt: string;
  }>;
  auditRecords: AuditRecord[];
  explanation: string[];
  versionEnvelope: VersionEnvelope;
};

export type DiffChange = {
  field: string;
  before: unknown;
  after: unknown;
  explanation: string;
};

export type DiffReport = {
  identityId: Hex;
  from: ReplayTrace;
  to: ReplayTrace;
  changes: DiffChange[];
  summary: string;
  versionEnvelope: VersionEnvelope;
};

export type PositiveSignalThresholds = {
  long_term_good_standing: {
    daysWithoutIncident: number;
    minReputationScore: number;
  };
  repeated_governance_participation: {
    lookbackDays: number;
    minEvents: number;
  };
  trusted_protocol_usage: {
    lookbackDays: number;
    minEvents: number;
  };
  no_risk_incident_days: {
    daysWithoutIncident: number;
  };
};
