import { keccak256, stringToHex, type Hex } from "viem";
import { getActiveConsequences, type ConsequenceRecord } from "./consequence.js";
import { IdentityState, type IdentityStateContext } from "./state.js";
import { createVersionEnvelope, type VersionEnvelope } from "./versioning.js";

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
  versionEnvelope?: VersionEnvelope;
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
  versionEnvelope?: VersionEnvelope;
};

export type StateSnapshotSource = {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  storedState: IdentityState;
  effectiveState: IdentityState;
  effectiveMode?: string;
  stateContext?: Pick<IdentityStateContext, "currentState" | "decisions" | "assessments" | "consequences"> | null;
  policyDecisions?: PolicyDecisionSnapshotSource[];
  propagationSummary?: string[];
  explanationAnchor?: string;
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

export type StateSnapshotAttestation = {
  signer: string;
  trustProfile: "local_demo" | "attested_sync";
  attestationDigest: string;
  metadata: Record<string, unknown>;
  issuedAt: string;
  expiresAt?: string;
  versionEnvelope: VersionEnvelope;
};

export type StateSnapshotV2 = StateSnapshot & {
  effectiveMode: string;
  consequenceSummary: string[];
  policySummary: string[];
  propagationSummary: string[];
  explanationAnchor?: string;
  registryVersion: number;
  policyVersion?: number;
  issuedAt: string;
  expiresAt?: string;
  attestation: StateSnapshotAttestation;
  versionEnvelope: VersionEnvelope;
};

export type CrossChainStateMessageV2 = CrossChainStateMessage & {
  sourceDomain: string;
  targetDomain: string;
  snapshotDigest: string;
  attestor: string;
  trustProfile: StateSnapshotAttestation["trustProfile"];
  attestationIssuedAt: string;
  attestationExpiresAt?: string;
  attestationProof: string;
  ttlSeconds: number;
  expiresAt?: string;
  replayProtectionKey: string;
  consumerPolicyHint: "warning_hint" | "review_trigger" | "risk_hint" | "eligibility_signal";
  versionEnvelope: VersionEnvelope;
};

export type CrossChainVerificationResult = {
  messageId: string;
  verified: boolean;
  reasonCode: "OK" | "TAMPERED" | "EXPIRED" | "REPLAYED" | "TRUST_PROFILE_REJECTED";
  explanation: string;
  verifiedAt: string;
  messageDigest: string;
  versionEnvelope: VersionEnvelope;
};

export type CrossChainConsumptionTrace = {
  traceId: string;
  messageId: string;
  consumerPolicyHint: CrossChainStateMessageV2["consumerPolicyHint"];
  effect: "hint_recorded" | "review_recommended" | "eligibility_noted";
  createdAt: string;
  explanation: string;
  versionEnvelope: VersionEnvelope;
};

export type CrossChainInboxItem = {
  inboxId: string;
  message: CrossChainStateMessageV2;
  verification: CrossChainVerificationResult;
  consumed: boolean;
  consumptionTrace?: CrossChainConsumptionTrace;
  versionEnvelope: VersionEnvelope;
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
    versionEnvelope: createVersionEnvelope({
      policyVersion: parsePolicyVersion(snapshotBody.policyContextVersion),
    }),
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
    versionEnvelope: createVersionEnvelope(),
  };
}

export function buildStateSnapshotV2(
  source: StateSnapshotSource,
  options: BuildStateSnapshotOptions & {
    signer?: string;
    trustProfile?: StateSnapshotAttestation["trustProfile"];
    expiresAt?: string;
  } = {},
): StateSnapshotV2 {
  const base = buildStateSnapshot(source, options);
  const issuedAt = options.generatedAt ?? new Date().toISOString();
  const attestation: StateSnapshotAttestation = {
    signer: options.signer ?? "web3id:local-attestor",
    trustProfile: options.trustProfile ?? "local_demo",
    attestationDigest: hashCanonical({
      snapshotId: base.snapshotId,
      rootIdentityId: base.rootIdentityId,
      subIdentityId: base.subIdentityId,
      issuedAt,
      expiresAt: options.expiresAt,
    }),
    metadata: {
      rootIdentityId: base.rootIdentityId,
      subIdentityId: base.subIdentityId,
      storedState: base.storedState,
      effectiveState: base.effectiveState,
    },
    issuedAt,
    expiresAt: options.expiresAt,
    versionEnvelope: createVersionEnvelope({
      policyVersion: parsePolicyVersion(base.policyContextVersion),
    }),
  };
  return {
    ...base,
    effectiveMode: source.effectiveMode ?? "UNRESOLVED",
    consequenceSummary: [...base.consequenceTypes],
    policySummary: (source.policyDecisions ?? []).map((item) => `${item.policyLabel}@${item.policyVersion}`),
    propagationSummary: [...(source.propagationSummary ?? [])],
    explanationAnchor: source.explanationAnchor,
    registryVersion: 1,
    policyVersion: parsePolicyVersion(base.policyContextVersion) ?? undefined,
    issuedAt,
    expiresAt: options.expiresAt,
    attestation,
    versionEnvelope: createVersionEnvelope({
      policyVersion: parsePolicyVersion(base.policyContextVersion),
    }),
  };
}

export function buildCrossChainStateMessageV2(
  snapshot: StateSnapshotV2,
  input: {
    sourceChainId?: number;
    targetChainId: number;
    sourceDomain?: string;
    targetDomain?: string;
    createdAt?: string;
    ttlSeconds?: number;
    consumerPolicyHint?: CrossChainStateMessageV2["consumerPolicyHint"];
  },
): CrossChainStateMessageV2 {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const ttlSeconds = input.ttlSeconds ?? 3600;
  const expiresAt = snapshot.expiresAt ?? new Date(Date.parse(createdAt) + ttlSeconds * 1000).toISOString();
  const base = buildCrossChainStateMessage(snapshot, input.targetChainId, {
    sourceChainId: input.sourceChainId,
    createdAt,
  });
  const sourceDomain = input.sourceDomain ?? `chain:${input.sourceChainId ?? 31337}`;
  const targetDomain = input.targetDomain ?? `chain:${input.targetChainId}`;
  const snapshotDigest = hashCanonical({
    snapshotId: snapshot.snapshotId,
    attestationDigest: snapshot.attestation.attestationDigest,
    issuedAt: snapshot.attestation.issuedAt,
    expiresAt: snapshot.attestation.expiresAt,
  });
  return {
    ...base,
    sourceDomain,
    targetDomain,
    snapshotDigest,
    attestor: snapshot.attestation.signer,
    trustProfile: snapshot.attestation.trustProfile,
    attestationIssuedAt: snapshot.attestation.issuedAt,
    attestationExpiresAt: snapshot.attestation.expiresAt,
    attestationProof: hashCanonical({
      snapshotDigest,
      signer: snapshot.attestation.signer,
      trustProfile: snapshot.attestation.trustProfile,
    }),
    ttlSeconds,
    expiresAt,
    replayProtectionKey: hashCanonical({
      messageId: base.messageId,
      sourceDomain,
      targetDomain,
      snapshotDigest,
    }),
    consumerPolicyHint: input.consumerPolicyHint ?? "warning_hint",
    versionEnvelope: createVersionEnvelope({
      policyVersion: snapshot.policyVersion,
    }),
  };
}

export function verifyCrossChainStateMessageV2(
  message: CrossChainStateMessageV2,
  options: {
    expectedTargetDomain?: string;
    seenReplayProtectionKeys?: Set<string>;
    now?: string;
    allowedTrustProfiles?: StateSnapshotAttestation["trustProfile"][];
  } = {},
): CrossChainVerificationResult {
  const now = options.now ?? new Date().toISOString();
  const expectedTargetDomain = options.expectedTargetDomain ?? message.targetDomain;
  const seenKeys = options.seenReplayProtectionKeys;
  const trustProfiles = options.allowedTrustProfiles ?? ["local_demo", "attested_sync"];
  if (!trustProfiles.includes(message.trustProfile)) {
    return buildVerificationResult(message, false, "TRUST_PROFILE_REJECTED", now, "Message trust profile is not allowed by the local verifier.");
  }
  if (message.targetDomain !== expectedTargetDomain) {
    return buildVerificationResult(message, false, "TAMPERED", now, "Target domain mismatch.");
  }
  if (message.expiresAt && Date.parse(message.expiresAt) <= Date.parse(now)) {
    return buildVerificationResult(message, false, "EXPIRED", now, "Cross-domain message has expired.");
  }
  const expectedAttestationDigest = hashCanonical({
    snapshotId: message.snapshotRef,
    rootIdentityId: message.rootIdentityId,
    subIdentityId: message.subIdentityId,
    issuedAt: message.attestationIssuedAt,
    expiresAt: message.attestationExpiresAt,
  });
  const expectedSnapshotDigest = hashCanonical({
    snapshotId: message.snapshotRef,
    attestationDigest: expectedAttestationDigest,
    issuedAt: message.attestationIssuedAt,
    expiresAt: message.attestationExpiresAt,
  });
  if (message.snapshotDigest !== expectedSnapshotDigest) {
    return buildVerificationResult(message, false, "TAMPERED", now, "Snapshot digest verification failed.");
  }
  const expectedAttestationProof = hashCanonical({
    snapshotDigest: expectedSnapshotDigest,
    signer: message.attestor,
    trustProfile: message.trustProfile,
  });
  if (message.attestationProof !== expectedAttestationProof) {
    return buildVerificationResult(message, false, "TAMPERED", now, "Attestation proof verification failed.");
  }
  const expectedMessageId = hashCanonical({
    payloadHash: message.payloadHash,
    sourceChainId: message.sourceChainId,
    targetChainId: message.targetChainId,
    snapshotRef: message.snapshotRef,
    commitmentRef: message.commitmentRef,
    messageType: message.messageType,
  });
  if (message.messageId !== expectedMessageId) {
    return buildVerificationResult(message, false, "TAMPERED", now, "Message identity verification failed.");
  }
  const expectedReplayProtectionKey = hashCanonical({
    messageId: expectedMessageId,
    sourceDomain: message.sourceDomain,
    targetDomain: message.targetDomain,
    snapshotDigest: expectedSnapshotDigest,
  });
  if (message.replayProtectionKey !== expectedReplayProtectionKey) {
    return buildVerificationResult(message, false, "TAMPERED", now, "Replay protection key verification failed.");
  }
  if (seenKeys?.has(message.replayProtectionKey)) {
    return buildVerificationResult(message, false, "REPLAYED", now, "Replay protection rejected a duplicate message.");
  }
  return buildVerificationResult(message, true, "OK", now, "Cross-domain message verified and can be consumed as a local hint.");
}

export function createCrossChainInboxItem(
  message: CrossChainStateMessageV2,
  verification: CrossChainVerificationResult,
  consumptionTrace?: CrossChainConsumptionTrace,
): CrossChainInboxItem {
  return {
    inboxId: hashCanonical({
      messageId: message.messageId,
      verifiedAt: verification.verifiedAt,
    }),
    message,
    verification,
    consumed: Boolean(consumptionTrace),
    consumptionTrace,
    versionEnvelope: createVersionEnvelope({
      policyVersion: message.versionEnvelope.policyVersion,
    }),
  };
}

export function createCrossChainConsumptionTrace(
  message: CrossChainStateMessageV2,
  effect: CrossChainConsumptionTrace["effect"],
  createdAt = new Date().toISOString(),
): CrossChainConsumptionTrace {
  return {
    traceId: hashCanonical({
      messageId: message.messageId,
      effect,
      createdAt,
    }),
    messageId: message.messageId,
    consumerPolicyHint: message.consumerPolicyHint,
    effect,
    createdAt,
    explanation: `Cross-domain message ${message.messageId} was consumed as ${effect}. Local policy remains the final decision-maker.`,
    versionEnvelope: createVersionEnvelope({
      policyVersion: message.versionEnvelope.policyVersion,
    }),
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

function parsePolicyVersion(policyContextVersion: string) {
  const match = /@(\d+)$/.exec(policyContextVersion);
  return match ? Number(match[1]) : undefined;
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

function buildVerificationResult(
  message: CrossChainStateMessageV2,
  verified: boolean,
  reasonCode: CrossChainVerificationResult["reasonCode"],
  verifiedAt: string,
  explanation: string,
): CrossChainVerificationResult {
  return {
    messageId: message.messageId,
    verified,
    reasonCode,
    explanation,
    verifiedAt,
    messageDigest: hashCanonical({
      messageId: message.messageId,
      snapshotDigest: message.snapshotDigest,
      attestationProof: message.attestationProof,
      replayProtectionKey: message.replayProtectionKey,
    }),
    versionEnvelope: createVersionEnvelope({
      policyVersion: message.versionEnvelope.policyVersion,
    }),
  };
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
