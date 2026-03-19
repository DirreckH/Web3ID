import type { Hex } from "viem";
import { createVersionEnvelope, type VersionEnvelope } from "./versioning.js";

export type RecoveryHookGuardrails = {
  defaultMode: "default_off";
  lifecycle: "hook_only";
  safety: "mock_safe";
  participatesInAccessPolicy: false;
  executesRecoveryAction: false;
};

export const recoveryHookGuardrails: RecoveryHookGuardrails = {
  defaultMode: "default_off",
  lifecycle: "hook_only",
  safety: "mock_safe",
  participatesInAccessPolicy: false,
  executesRecoveryAction: false,
};

export type GuardianMetadata = {
  guardianId: string;
  guardianType: "address" | "subIdentity" | "entity";
  guardianRef: string;
  role: "primary" | "secondary" | "observer";
  weight: number;
  addedAt: string;
  status: "active" | "revoked";
};

export type RecoveryPolicySlot = {
  policySlotId: string;
  rootIdentityId: string;
  enabled: boolean;
  minGuardianApprovals: number;
  cooldownSeconds: number;
  scope: "root_only" | "selected_sub_ids";
  allowedRecoveryActions: RecoveryAction[];
  createdAt: string;
  updatedAt: string;
  versionEnvelope?: VersionEnvelope;
};

export type RecoveryIntent = {
  intentId: string;
  rootIdentityId: string;
  targetSubIdentityId?: string;
  action: RecoveryAction;
  initiatedBy: string;
  status: "draft" | "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  blockedReason?: string;
  versionEnvelope?: VersionEnvelope;
};

export type RecoveryAction =
  | "unlock"
  | "rebind"
  | "controller_rotate"
  | "capability_restore"
  | "consequence_release"
  | "access_path_unlock";

export type BreakGlassAction = "queue_unblock" | "temporary_release" | "consequence_rollback";

export type RecoveryCaseStatus =
  | "initiated"
  | "evidence_collecting"
  | "guardian_review"
  | "operator_review"
  | "governance_review"
  | "approved"
  | "rejected"
  | "executed"
  | "revoked"
  | "expired";

export type RecoveryActorRole = "requester" | "guardian" | "operator" | "governance_reviewer" | "auditor";

export type RecoveryEvidence = {
  evidenceId: string;
  caseId: string;
  rootIdentityId: string;
  targetIdentityId?: string;
  kind: "binding_proof" | "guardian_attestation" | "policy_basis" | "audit_ref" | "manual_note";
  summary: string;
  evidenceRefs: string[];
  submittedBy: string;
  submittedRole: RecoveryActorRole;
  createdAt: string;
  versionEnvelope: VersionEnvelope;
};

export type RecoveryDecision = {
  decisionId: string;
  caseId: string;
  rootIdentityId: string;
  actorId: string;
  actorRole: Exclude<RecoveryActorRole, "requester">;
  outcome: "approved" | "rejected" | "revoked";
  reasonCode: string;
  explanation: string;
  evidenceRefs: string[];
  createdAt: string;
  versionEnvelope: VersionEnvelope;
};

export type RecoveryExecutionRecord = {
  executionId: string;
  caseId: string;
  rootIdentityId: string;
  actorId: string;
  action: RecoveryAction;
  breakGlassAction?: BreakGlassAction;
  effect: "queued" | "temporary_release" | "consequence_rollback" | "binding_update" | "capability_restore" | "access_unlock";
  status: "queued" | "completed" | "rejected";
  createdAt: string;
  versionEnvelope: VersionEnvelope;
};

export type RecoveryOutcome = {
  outcomeId: string;
  caseId: string;
  rootIdentityId: string;
  targetIdentityId?: string;
  action: RecoveryAction;
  status: "pending_effect" | "applied" | "rejected";
  resultingDecisionId?: string;
  resultingConsequenceId?: string;
  resultingListEntryId?: string;
  notes: string[];
  createdAt: string;
  versionEnvelope: VersionEnvelope;
};

export type RecoveryApprovalTicket = {
  ticketId: string;
  caseId: string;
  rootIdentityId: string;
  requiredRole: Exclude<RecoveryActorRole, "requester" | "auditor">;
  requiredApprovals: number;
  approvedBy: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  versionEnvelope: VersionEnvelope;
};

export type RecoveryCase = {
  caseId: string;
  rootIdentityId: string;
  targetIdentityId?: string;
  targetSubIdentityId?: string;
  action: RecoveryAction;
  status: RecoveryCaseStatus;
  requestedBy: string;
  breakGlassAction?: BreakGlassAction;
  scope: "selected_sub_identity" | "capability" | "consequence" | "access_path";
  evidence: RecoveryEvidence[];
  decisions: RecoveryDecision[];
  executions: RecoveryExecutionRecord[];
  outcomes: RecoveryOutcome[];
  approvalTickets: RecoveryApprovalTicket[];
  createdAt: string;
  updatedAt: string;
  versionEnvelope: VersionEnvelope;
};

export type RecoveryConstraintContext = {
  governanceEmergencyFreeze?: boolean;
  propagationLevel?: "LOCAL_ONLY" | "SAME_SCOPE_CLASS" | "ROOT_ESCALATION" | "GLOBAL_LOCKDOWN";
};

const recoveryPolicySlots = new Map<string, RecoveryPolicySlot>();
const recoveryGuardians = new Map<string, GuardianMetadata[]>();
const recoveryIntents = new Map<string, RecoveryIntent[]>();
const recoveryCases = new Map<string, RecoveryCase>();

export function registerRecoveryPolicySlot(slot: RecoveryPolicySlot) {
  const next = {
    ...slot,
    versionEnvelope: slot.versionEnvelope ?? createVersionEnvelope(),
  };
  recoveryPolicySlots.set(slot.policySlotId, next);
  return next;
}

export function getRecoveryPolicySlot(policySlotId: string) {
  return recoveryPolicySlots.get(policySlotId);
}

export function registerRecoveryGuardians(rootIdentityId: Hex | string, guardians: GuardianMetadata[]) {
  const next = [...guardians].sort((left, right) => left.guardianId.localeCompare(right.guardianId));
  recoveryGuardians.set(rootIdentityId, next);
  return next;
}

export function listRecoveryGuardians(rootIdentityId: Hex | string) {
  return [...(recoveryGuardians.get(rootIdentityId) ?? [])];
}

export function createRecoveryIntent(
  input: Omit<RecoveryIntent, "status" | "blockedReason"> & { status?: RecoveryIntent["status"] },
  context: RecoveryConstraintContext = {},
) {
  const blockedReason = resolveBlockedReason(context);
  const intent: RecoveryIntent = {
    ...input,
    status: blockedReason ? "rejected" : (input.status ?? "pending"),
    blockedReason,
    versionEnvelope: input.versionEnvelope ?? createVersionEnvelope(),
  };
  const current = recoveryIntents.get(input.rootIdentityId) ?? [];
  recoveryIntents.set(input.rootIdentityId, [...current, intent]);
  return intent;
}

export function createRecoveryCase(
  input: Omit<RecoveryCase, "status" | "evidence" | "decisions" | "executions" | "outcomes" | "approvalTickets" | "updatedAt" | "versionEnvelope"> & {
    status?: RecoveryCaseStatus;
    versionEnvelope?: VersionEnvelope;
  },
) {
  const recoveryCase: RecoveryCase = {
    ...input,
    status: input.status ?? "initiated",
    evidence: [],
    decisions: [],
    executions: [],
    outcomes: [],
    approvalTickets: [],
    updatedAt: input.createdAt,
    versionEnvelope: input.versionEnvelope ?? createVersionEnvelope(),
  };
  recoveryCases.set(recoveryCase.caseId, recoveryCase);
  return recoveryCase;
}

export function getRecoveryCase(caseId: string) {
  return recoveryCases.get(caseId);
}

export function listRecoveryCases(rootIdentityId?: Hex | string) {
  return [...recoveryCases.values()]
    .filter((item) => !rootIdentityId || item.rootIdentityId === rootIdentityId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function appendRecoveryEvidence(caseId: string, evidence: Omit<RecoveryEvidence, "versionEnvelope"> & { versionEnvelope?: VersionEnvelope }) {
  const recoveryCase = getRecoveryCaseOrThrow(caseId);
  const nextEvidence: RecoveryEvidence = {
    ...evidence,
    versionEnvelope: evidence.versionEnvelope ?? createVersionEnvelope(),
  };
  recoveryCase.evidence.push(nextEvidence);
  recoveryCase.status = recoveryCase.status === "initiated" ? "evidence_collecting" : recoveryCase.status;
  recoveryCase.updatedAt = nextEvidence.createdAt;
  return recoveryCase;
}

export function addRecoveryApprovalTicket(
  caseId: string,
  ticket: Omit<RecoveryApprovalTicket, "approvedBy" | "status" | "updatedAt" | "versionEnvelope"> & {
    approvedBy?: string[];
    status?: RecoveryApprovalTicket["status"];
    versionEnvelope?: VersionEnvelope;
  },
) {
  const recoveryCase = getRecoveryCaseOrThrow(caseId);
  const nextTicket: RecoveryApprovalTicket = {
    ...ticket,
    approvedBy: ticket.approvedBy ?? [],
    status: ticket.status ?? "pending",
    updatedAt: ticket.createdAt,
    versionEnvelope: ticket.versionEnvelope ?? createVersionEnvelope(),
  };
  recoveryCase.approvalTickets.push(nextTicket);
  recoveryCase.updatedAt = nextTicket.updatedAt;
  return recoveryCase;
}

export function approveRecoveryTicket(caseId: string, ticketId: string, actorId: string, updatedAt = new Date().toISOString()) {
  const recoveryCase = getRecoveryCaseOrThrow(caseId);
  const ticket = recoveryCase.approvalTickets.find((item) => item.ticketId === ticketId);
  if (!ticket) throw new Error(`Unknown recovery approval ticket: ${ticketId}`);
  if (!ticket.approvedBy.includes(actorId)) ticket.approvedBy.push(actorId);
  if (ticket.approvedBy.length >= ticket.requiredApprovals) {
    ticket.status = "approved";
  }
  ticket.updatedAt = updatedAt;
  recoveryCase.updatedAt = updatedAt;
  return recoveryCase;
}

export function recordRecoveryDecision(caseId: string, decision: Omit<RecoveryDecision, "versionEnvelope"> & { versionEnvelope?: VersionEnvelope }) {
  const recoveryCase = getRecoveryCaseOrThrow(caseId);
  const nextDecision: RecoveryDecision = {
    ...decision,
    versionEnvelope: decision.versionEnvelope ?? createVersionEnvelope(),
  };
  recoveryCase.decisions.push(nextDecision);
  recoveryCase.status = nextDecision.outcome === "approved" ? "approved" : nextDecision.outcome;
  recoveryCase.updatedAt = nextDecision.createdAt;
  return recoveryCase;
}

export function recordRecoveryExecution(caseId: string, execution: Omit<RecoveryExecutionRecord, "versionEnvelope"> & { versionEnvelope?: VersionEnvelope }) {
  const recoveryCase = getRecoveryCaseOrThrow(caseId);
  if (execution.breakGlassAction && !isAllowedBreakGlassAction(execution.breakGlassAction)) {
    throw new Error("Break-glass action is not allowed by Phase4 guardrails.");
  }
  const nextExecution: RecoveryExecutionRecord = {
    ...execution,
    versionEnvelope: execution.versionEnvelope ?? createVersionEnvelope(),
  };
  recoveryCase.executions.push(nextExecution);
  recoveryCase.status = nextExecution.status === "completed" ? "executed" : recoveryCase.status;
  recoveryCase.updatedAt = nextExecution.createdAt;
  return recoveryCase;
}

export function recordRecoveryOutcome(caseId: string, outcome: Omit<RecoveryOutcome, "versionEnvelope"> & { versionEnvelope?: VersionEnvelope }) {
  const recoveryCase = getRecoveryCaseOrThrow(caseId);
  const nextOutcome: RecoveryOutcome = {
    ...outcome,
    versionEnvelope: outcome.versionEnvelope ?? createVersionEnvelope(),
  };
  recoveryCase.outcomes.push(nextOutcome);
  recoveryCase.updatedAt = nextOutcome.createdAt;
  return recoveryCase;
}

export function assertRecoveryHooksRemainPassive(metadata: RecoveryHookGuardrails = recoveryHookGuardrails) {
  if (metadata.participatesInAccessPolicy) {
    throw new Error("Recovery hooks must remain outside the access policy decision path.");
  }
  if (metadata.executesRecoveryAction) {
    throw new Error("Recovery hooks must remain passive metadata and must not execute recovery actions.");
  }
  return metadata;
}

export function listRecoveryIntents(rootIdentityId: Hex | string) {
  return [...(recoveryIntents.get(rootIdentityId) ?? [])].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function clearRecoveryHooksForTests() {
  recoveryPolicySlots.clear();
  recoveryGuardians.clear();
  recoveryIntents.clear();
  recoveryCases.clear();
}

function resolveBlockedReason(context: RecoveryConstraintContext) {
  if (context.governanceEmergencyFreeze) {
    return "governance emergency freeze is active";
  }
  if (context.propagationLevel === "GLOBAL_LOCKDOWN") {
    return "global lockdown is active";
  }
  return undefined;
}

function getRecoveryCaseOrThrow(caseId: string) {
  const recoveryCase = recoveryCases.get(caseId);
  if (!recoveryCase) {
    throw new Error(`Unknown recovery case: ${caseId}`);
  }
  return recoveryCase;
}

function isAllowedBreakGlassAction(action: BreakGlassAction) {
  return action === "queue_unblock" || action === "temporary_release" || action === "consequence_rollback";
}
