import { base58, bech32, bech32m } from "@scure/base";
import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import {
  CONTROLLER_CHALLENGE_DOMAIN_TAG,
  CONTROLLER_CHALLENGE_VERSION,
  CONTROLLER_REF_VERSION,
  IdentityMode,
  ROOT_IDENTITY_SCHEMA_VERSION,
  type ChainControllerRef,
  type ChainControllerRefInput,
  type ControllerBindingType,
  type ControllerChallengeFields,
  type RootIdentity,
} from "./types.js";

function normalizeNetworkId(networkId: number | string) {
  const normalized = String(networkId).trim();
  if (!normalized) {
    throw new Error("Controller networkId is required.");
  }
  return normalized;
}

function assertBase58Address(input: string, expectedLength?: number) {
  try {
    const decoded = base58.decode(input);
    if (expectedLength !== undefined && decoded.length !== expectedLength) {
      throw new Error(`Expected ${expectedLength} bytes, received ${decoded.length}.`);
    }
  } catch (error) {
    throw new Error(`Invalid base58 address: ${error instanceof Error ? error.message : "decode failed"}`);
  }
}

function assertBitcoinAddress(input: string) {
  if (/^(bc1|tb1|bcrt1)/i.test(input)) {
    const lowered = input.toLowerCase();
    try {
      bech32.decode(lowered as `${string}1${string}`);
      return lowered;
    } catch {
      try {
        bech32m.decode(lowered as `${string}1${string}`);
        return lowered;
      } catch (error) {
        throw new Error(`Invalid bech32 bitcoin address: ${error instanceof Error ? error.message : "decode failed"}`);
      }
    }
  }

  assertBase58Address(input);
  return input;
}

function buildControllerDidLikeId(input: {
  chainFamily: ChainControllerRef["chainFamily"];
  networkId: string;
  normalizedAddress: string;
}) {
  switch (input.chainFamily) {
    case "evm":
      return `did:pkh:eip155:${input.networkId}:${input.normalizedAddress}`;
    case "solana":
      return `did:pkh:solana:${input.networkId}:${input.normalizedAddress}`;
    case "bitcoin":
      return `did:pkh:bitcoin:${input.networkId}:${input.normalizedAddress}`;
  }
}

export function normalizeControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const chainFamily = input.chainFamily;
  const networkId = normalizeNetworkId(input.networkId);
  const address = input.address.trim();
  if (!address) {
    throw new Error("Controller address is required.");
  }

  if (chainFamily === "evm") {
    const normalizedAddress = getAddress(address);
    return {
      chainFamily,
      networkId,
      address,
      normalizedAddress,
      proofType: input.proofType ?? "eip191",
      publicKeyHint: input.publicKeyHint,
      didLikeId: input.didLikeId ?? buildControllerDidLikeId({ chainFamily, networkId, normalizedAddress }),
      controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
    };
  }

  if (chainFamily === "solana") {
    assertBase58Address(address, 32);
    return {
      chainFamily,
      networkId,
      address,
      normalizedAddress: address,
      proofType: input.proofType ?? "solana_ed25519",
      publicKeyHint: input.publicKeyHint,
      didLikeId: input.didLikeId ?? buildControllerDidLikeId({ chainFamily, networkId, normalizedAddress: address }),
      controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
    };
  }

  const normalizedAddress = assertBitcoinAddress(address);
  return {
    chainFamily,
    networkId,
    address,
    normalizedAddress,
    proofType: input.proofType ?? "bitcoin_bip322",
    publicKeyHint: input.publicKeyHint,
    didLikeId: input.didLikeId ?? buildControllerDidLikeId({ chainFamily, networkId, normalizedAddress }),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
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
  bindingType: ControllerBindingType;
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
  bindingType: ControllerBindingType;
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
  return [
    "Web3ID Controller Challenge",
    `domainTag: ${fields.domainTag}`,
    `challengeVersion: ${fields.challengeVersion}`,
    `bindingType: ${fields.bindingType}`,
    `chainFamily: ${fields.chainFamily}`,
    `networkId: ${fields.networkId}`,
    `normalizedAddress: ${fields.normalizedAddress}`,
    `proofType: ${fields.proofType}`,
    `rootIdentityId: ${fields.rootIdentityId}`,
    `subjectAggregateId: ${fields.subjectAggregateId}`,
    `nonce: ${fields.nonce}`,
    `issuedAt: ${fields.issuedAt}`,
    `expiresAt: ${fields.expiresAt}`,
    `replayScope: ${fields.replayScope}`,
  ].join("\n");
}
