import { keccak256, stringToHex, type Hex } from "viem";
import { getActiveConsequences, type ConsequenceRecord } from "./consequence.js";
import { IdentityState, type IdentityStateContext } from "./state.js";

export type ReservedHookGuardrail = {
  defaultMode: "default_off";
  lifecycle: "hook_only";
  safety: "mock_safe";
  writesState: false;
  policyFactSource: false;
};

export const crossChainHookGuardrails: ReservedHookGuardrail = {
  defaultMode: "default_off",
  lifecycle: "hook_only",
  safety: "mock_safe",
  writesState: false,
  policyFactSource: false,
};

export type PolicyDecisionSnapshotSource = {
  policyLabel: string;
  policyVersion: number;
  createdAt: string;
};

export type StateSnapshot = {
  snapshotId: string;
  rootIdentityId: string;
  subIdentityId?: string;
  storedState: string;
  effectiveState: string;
  consequenceTypes: string[];
  policyContextVersion: string;
  stateVersion: string;
  generatedAt: string;
  evidenceBundleHash?: string;
  guardrails: ReservedHookGuardrail;
};

export type StateMerkleCommitment = {
  commitmentId: string;
  snapshotId: string;
  merkleRoot: string;
  leafHash: string;
  hashAlgo: "keccak256" | "sha256";
  createdAt: string;
};

export type CrossChainStateMessage = {
  messageId: string;
  sourceChainId: number;
  targetChainId: number;
  rootIdentityId: string;
  subIdentityId?: string;
  snapshotRef: string;
  commitmentRef?: string;
  messageType: "state_sync" | "freeze_notice" | "restriction_notice";
  payloadHash: string;
  createdAt: string;
  guardrails: ReservedHookGuardrail;
};

export type StateSnapshotSource = {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  storedState: IdentityState;
  effectiveState: IdentityState;
  stateContext?: Pick<IdentityStateContext, "currentState" | "decisions" | "assessments" | "consequences"> | null;
  policyDecisions?: PolicyDecisionSnapshotSource[];
};

export type BuildStateSnapshotOptions = {
  generatedAt?: string;
};

export type BuildStateMerkleCommitmentOptions = {
  createdAt?: string;
  hashAlgo?: "keccak256" | "sha256";
};

export type BuildCrossChainStateMessageOptions = {
  sourceChainId?: number;
  commitmentRef?: string;
  commitment?: Pick<StateMerkleCommitment, "commitmentId"> | null;
  createdAt?: string;
  messageType?: CrossChainStateMessage["messageType"];
};

export function buildStateSnapshot(source: StateSnapshotSource, options: BuildStateSnapshotOptions = {}): StateSnapshot {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const storedState = resolveStoredState(source);
  const effectiveState = source.effectiveState;
  const consequences = resolveActiveConsequences(source);
  const latestDecision = source.stateContext?.decisions.at(-1);
  const snapshotBody = {
    rootIdentityId: source.rootIdentityId,
    subIdentityId: source.subIdentityId,
    storedState: IdentityState[storedState],
    effectiveState: IdentityState[effectiveState],
    consequenceTypes: consequences.map((consequence) => consequence.consequenceType).sort(),
    policyContextVersion: resolvePolicyContextVersion(source.policyDecisions ?? []),
    stateVersion: latestDecision?.decisionId ?? "state-context:init",
    evidenceBundleHash: latestDecision?.evidenceBundleHash,
  };

  return {
    snapshotId: hashCanonical(snapshotBody),
    rootIdentityId: source.rootIdentityId,
    subIdentityId: source.subIdentityId,
    storedState: snapshotBody.storedState,
    effectiveState: snapshotBody.effectiveState,
    consequenceTypes: snapshotBody.consequenceTypes,
    policyContextVersion: snapshotBody.policyContextVersion,
    stateVersion: snapshotBody.stateVersion,
    generatedAt,
    evidenceBundleHash: snapshotBody.evidenceBundleHash,
    guardrails: crossChainHookGuardrails,
  };
}

export function buildStateMerkleCommitment(
  snapshot: StateSnapshot,
  options: BuildStateMerkleCommitmentOptions = {},
): StateMerkleCommitment {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const hashAlgo = options.hashAlgo ?? "keccak256";
  if (hashAlgo === "sha256") {
    throw new Error("sha256 commitments are reserved for a future phase. P2 only supports keccak256 mock commitments.");
  }

  const leafHash = hashCanonical({
    snapshotId: snapshot.snapshotId,
    rootIdentityId: snapshot.rootIdentityId,
    subIdentityId: snapshot.subIdentityId,
    storedState: snapshot.storedState,
    effectiveState: snapshot.effectiveState,
    consequenceTypes: snapshot.consequenceTypes,
    policyContextVersion: snapshot.policyContextVersion,
    stateVersion: snapshot.stateVersion,
    evidenceBundleHash: snapshot.evidenceBundleHash,
  });
  const merkleRoot = leafHash;

  return {
    commitmentId: hashCanonical({
      snapshotId: snapshot.snapshotId,
      leafHash,
      merkleRoot,
      hashAlgo,
    }),
    snapshotId: snapshot.snapshotId,
    merkleRoot,
    leafHash,
    hashAlgo,
    createdAt,
  };
}

export function buildCrossChainStateMessage(
  snapshot: StateSnapshot,
  targetChainId: number,
  options: BuildCrossChainStateMessageOptions = {},
): CrossChainStateMessage {
  const sourceChainId = options.sourceChainId ?? 31337;
  const createdAt = options.createdAt ?? new Date().toISOString();
  const messageType = options.messageType ?? selectMessageType(snapshot.effectiveState);
  const commitmentRef = options.commitmentRef ?? options.commitment?.commitmentId ?? undefined;
  const payloadHash = hashCanonical({
    sourceChainId,
    targetChainId,
    rootIdentityId: snapshot.rootIdentityId,
    subIdentityId: snapshot.subIdentityId,
    snapshotRef: snapshot.snapshotId,
    commitmentRef,
    messageType,
    storedState: snapshot.storedState,
    effectiveState: snapshot.effectiveState,
    consequenceTypes: snapshot.consequenceTypes,
    policyContextVersion: snapshot.policyContextVersion,
    stateVersion: snapshot.stateVersion,
    evidenceBundleHash: snapshot.evidenceBundleHash,
  });

  return {
    messageId: hashCanonical({
      payloadHash,
      sourceChainId,
      targetChainId,
      snapshotRef: snapshot.snapshotId,
      commitmentRef,
      messageType,
    }),
    sourceChainId,
    targetChainId,
    rootIdentityId: snapshot.rootIdentityId,
    subIdentityId: snapshot.subIdentityId,
    snapshotRef: snapshot.snapshotId,
    commitmentRef,
    messageType,
    payloadHash,
    createdAt,
    guardrails: crossChainHookGuardrails,
  };
}

export function assertCrossChainHookGuardrails(metadata: ReservedHookGuardrail = crossChainHookGuardrails) {
  if (metadata.writesState) {
    throw new Error("Cross-chain hooks must remain read-only and must not write state.");
  }
  if (metadata.policyFactSource) {
    throw new Error("Cross-chain hooks must not become a required policy fact source.");
  }
  return metadata;
}

function resolveStoredState(source: StateSnapshotSource) {
  return source.stateContext?.currentState ?? source.storedState;
}

function resolveActiveConsequences(source: StateSnapshotSource): ConsequenceRecord[] {
  return getActiveConsequences(source.stateContext?.consequences ?? []);
}

function resolvePolicyContextVersion(policyDecisions: PolicyDecisionSnapshotSource[]) {
  const latest = [...policyDecisions].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)).at(-1);
  return latest ? `${latest.policyLabel}@${latest.policyVersion}` : "policy-context:unbound";
}

function selectMessageType(effectiveState: string) {
  if (effectiveState === IdentityState[IdentityState.FROZEN]) {
    return "freeze_notice";
  }
  if (effectiveState === IdentityState[IdentityState.RESTRICTED] || effectiveState === IdentityState[IdentityState.HIGH_RISK]) {
    return "restriction_notice";
  }
  return "state_sync";
}

function hashCanonical(value: unknown) {
  return keccak256(stringToHex(stableStringify(value)));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForCanonicalization(value));
}

function sortForCanonicalization(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortForCanonicalization(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortForCanonicalization(nested)]),
    );
  }
  return value;
}
