import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { deriveRootIdentityFromControllerRef, normalizeControllerRef } from "./controller.js";
import { DEFAULT_CHAIN_ID, IdentityMode, ROOT_IDENTITY_SCHEMA_VERSION, type ChainControllerRefInput, type RootIdentity } from "./types.js";

export function buildDidPkh(address: Address, chainId = DEFAULT_CHAIN_ID): string {
  return `did:pkh:eip155:${chainId}:${getAddress(address)}`;
}

export function computeRootId(address: Address, chainId = DEFAULT_CHAIN_ID): Hex {
  return keccak256(stringToHex(buildDidPkh(address, chainId)));
}

export function computeRootIdentityId(rootId: Hex): Hex {
  return keccak256(rootId);
}

export function deriveRootIdentity(address: Address, chainId?: number, createdAt?: string): RootIdentity;
export function deriveRootIdentity(controllerRef: ChainControllerRefInput, createdAt?: string): RootIdentity;
export function deriveRootIdentity(
  input: Address | ChainControllerRefInput,
  chainIdOrCreatedAt?: number | string,
  createdAt = new Date().toISOString(),
): RootIdentity {
  if (typeof input === "string") {
    const chainId = typeof chainIdOrCreatedAt === "number" ? chainIdOrCreatedAt : DEFAULT_CHAIN_ID;
    const resolvedCreatedAt = typeof chainIdOrCreatedAt === "string" ? chainIdOrCreatedAt : createdAt;
    const controllerAddress = getAddress(input);
    const didLikeId = buildDidPkh(controllerAddress, chainId);
    const rootId = computeRootId(controllerAddress, chainId);

    return {
      rootId,
      identityId: computeRootIdentityId(rootId),
      controllerAddress,
      legacyControllerAddress: controllerAddress,
      didLikeId,
      chainId,
      primaryControllerRef: normalizeControllerRef({
        chainFamily: "evm",
        networkId: chainId,
        address: controllerAddress,
        proofType: "eip191",
      }),
      schemaVersion: ROOT_IDENTITY_SCHEMA_VERSION,
      createdAt: resolvedCreatedAt,
      capabilities: {
        supportsHolderBinding: true,
        supportsIssuerValidation: false,
        hasLinkedCredentials: false,
        supportedProofKinds: ["holder_bound_proof"],
        preferredMode: IdentityMode.DEFAULT_BEHAVIOR_MODE,
      },
    };
  }

  const resolvedCreatedAt = typeof chainIdOrCreatedAt === "string" ? chainIdOrCreatedAt : createdAt;
  return deriveRootIdentityFromControllerRef(normalizeControllerRef(input), resolvedCreatedAt);
}

export function buildSignInMessage(address: Address, nonce: string, chainId = DEFAULT_CHAIN_ID): string {
  return [
    "Web3ID Root Identity Challenge",
    `Address: ${getAddress(address)}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    "By signing, you prove control of the wallet and allow Web3ID to derive a local identity tree.",
  ].join("\n");
}
