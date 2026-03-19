import type { Hex } from "viem";

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
  allowedRecoveryActions: Array<"unlock" | "rebind" | "controller_rotate">;
  createdAt: string;
  updatedAt: string;
};

export type RecoveryIntent = {
  intentId: string;
  rootIdentityId: string;
  targetSubIdentityId?: string;
  action: "unlock" | "rebind" | "controller_rotate";
  initiatedBy: string;
  status: "draft" | "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  blockedReason?: string;
};

export type RecoveryConstraintContext = {
  governanceEmergencyFreeze?: boolean;
  propagationLevel?: "LOCAL_ONLY" | "SAME_SCOPE_CLASS" | "ROOT_ESCALATION" | "GLOBAL_LOCKDOWN";
};

const recoveryPolicySlots = new Map<string, RecoveryPolicySlot>();
const recoveryGuardians = new Map<string, GuardianMetadata[]>();
const recoveryIntents = new Map<string, RecoveryIntent[]>();

export function registerRecoveryPolicySlot(slot: RecoveryPolicySlot) {
  recoveryPolicySlots.set(slot.policySlotId, slot);
  return slot;
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
  };
  const current = recoveryIntents.get(input.rootIdentityId) ?? [];
  recoveryIntents.set(input.rootIdentityId, [...current, intent]);
  return intent;
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
