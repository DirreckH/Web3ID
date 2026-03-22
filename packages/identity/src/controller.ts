import { keccak256, stringToHex, type Address, type Hex } from "viem";
import { normalizeLegacyCandidateSignature, parseControllerProofEnvelope } from "./controller-proof-envelope.js";
import { getControllerRegistryEntry, verifyControllerProof } from "./controller-registry.js";
import {
  CONTROLLER_CHALLENGE_DOMAIN_TAG,
  CONTROLLER_CHALLENGE_VERSION,
  CONTROLLER_REF_VERSION,
  IdentityMode,
  ROOT_IDENTITY_SCHEMA_VERSION,
  type ChainControllerRef,
  type ChainControllerRefInput,
  type ControllerChallengeLike,
  type ControllerChallengeFields,
  type ControllerProofEnvelope,
  type ControllerVerificationResult,
  type ControllerVerifierContext,
  type RootIdentity,
} from "./types.js";

function normalizeNetworkId(networkId: number | string) {
  const normalized = String(networkId).trim();
  if (!normalized) {
    throw new Error("Controller networkId is required.");
  }
  return normalized;
}

export function normalizeControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const chainFamily = input.chainFamily;
  const registryEntry = getControllerRegistryEntry(chainFamily);
  const normalizedInput: ChainControllerRefInput = {
    ...input,
    networkId: normalizeNetworkId(input.networkId),
    address: input.address.trim(),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
  const normalized = registryEntry.normalizeControllerRef(normalizedInput);
  return {
    ...normalized,
    capabilityFlags: normalized.capabilityFlags ?? registryEntry.capabilityFlags,
    didLikeId: normalized.didLikeId || registryEntry.buildDidLikeId(normalized),
  };
}

export function computeRootIdFromDidLikeId(didLikeId: string): Hex {
  return keccak256(stringToHex(didLikeId));
}

export function computeRootIdFromControllerRef(controllerRef: ChainControllerRef): Hex {
  return computeRootIdFromDidLikeId(controllerRef.didLikeId);
}

export function deriveRootIdentityFromControllerRef(
  controllerRef: ChainControllerRef,
  createdAt = new Date().toISOString(),
): RootIdentity {
  const rootId = computeRootIdFromControllerRef(controllerRef);
  const isEvm = controllerRef.chainFamily === "evm";
  const controllerAddress = isEvm ? (controllerRef.normalizedAddress as Address) : undefined;
  const chainId = isEvm ? Number(controllerRef.networkId) : undefined;

  return {
    rootId,
    identityId: keccak256(rootId),
    controllerAddress,
    legacyControllerAddress: controllerAddress,
    didLikeId: controllerRef.didLikeId,
    chainId,
    primaryControllerRef: controllerRef,
    schemaVersion: ROOT_IDENTITY_SCHEMA_VERSION,
    createdAt,
    capabilities: {
      supportsHolderBinding: true,
      supportsIssuerValidation: false,
      hasLinkedCredentials: false,
      supportedProofKinds: ["holder_bound_proof"],
      preferredMode: IdentityMode.DEFAULT_BEHAVIOR_MODE,
    },
  };
}

export function buildControllerChallengeReplayScope(input: {
  bindingType: ControllerChallengeFields["bindingType"];
  controllerRef: Pick<ChainControllerRef, "chainFamily" | "networkId" | "normalizedAddress">;
  rootIdentityId?: string | null;
  subjectAggregateId?: string | null;
}) {
  return [
    CONTROLLER_CHALLENGE_DOMAIN_TAG,
    input.bindingType,
    input.controllerRef.chainFamily,
    input.controllerRef.networkId,
    input.controllerRef.normalizedAddress,
    input.rootIdentityId || "-",
    input.subjectAggregateId || "-",
  ].join(":");
}

export function buildControllerChallengeFields(input: {
  bindingType: ControllerChallengeFields["bindingType"];
  controllerRef: ChainControllerRef;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  rootIdentityId?: string | null;
  subjectAggregateId?: string | null;
}): ControllerChallengeFields {
  return {
    domainTag: CONTROLLER_CHALLENGE_DOMAIN_TAG,
    challengeVersion: CONTROLLER_CHALLENGE_VERSION,
    bindingType: input.bindingType,
    chainFamily: input.controllerRef.chainFamily,
    networkId: input.controllerRef.networkId,
    normalizedAddress: input.controllerRef.normalizedAddress,
    proofType: input.controllerRef.proofType,
    rootIdentityId: input.rootIdentityId ?? "",
    subjectAggregateId: input.subjectAggregateId ?? "",
    nonce: input.nonce,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    replayScope: buildControllerChallengeReplayScope(input),
  };
}

export function buildControllerChallengeMessage(fields: ControllerChallengeFields) {
  return getControllerRegistryEntry(fields.chainFamily).buildChallengeMessage(fields);
}

export async function verifyControllerChallenge(input: {
  challenge: ControllerChallengeLike;
  candidateSignature?: string;
  candidateProof?: ControllerProofEnvelope | unknown;
  consumedReplayKeys?: Set<string>;
  context?: ControllerVerifierContext;
}): Promise<ControllerVerificationResult> {
  if (Date.parse(input.challenge.expiresAt) < Date.now()) {
    throw new Error("Binding challenge expired.");
  }
  if (input.challenge.replayKey && input.consumedReplayKeys?.has(input.challenge.replayKey)) {
    throw new Error("Binding challenge replay detected.");
  }

  const proofEnvelope = input.candidateProof
    ? parseControllerProofEnvelope(input.candidateProof)
    : input.candidateSignature
      ? normalizeLegacyCandidateSignature(input.challenge.controllerRef, input.candidateSignature)
      : undefined;
  if (!proofEnvelope) {
    throw new Error("Binding challenge verification requires candidateProof or candidateSignature.");
  }

  const verification = await verifyControllerProof({
    challenge: input.challenge,
    proofEnvelope,
    context: input.context,
  });
  const proofHash = keccak256(
    stringToHex([
      verification.proofEnvelope.proofType,
      input.challenge.challengeHash,
      verification.proofEnvelope.signature,
    ].join(":")),
  );

  return {
    ...verification,
    challengeDigest: input.challenge.challengeHash,
    proofHash,
    derivedRootIdentity: deriveRootIdentityFromControllerRef(input.challenge.controllerRef),
    evidenceRefs: [
      `challenge:${input.challenge.challengeHash}`,
      ...(input.challenge.replayKey ? [`replay:${input.challenge.replayKey}`] : []),
      ...verification.evidenceRefs,
      `proof:${proofHash}`,
    ],
  };
}
