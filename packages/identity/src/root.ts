import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { DEFAULT_CHAIN_ID, type RootIdentity } from "./types.js";

export function buildDidPkh(address: Address, chainId = DEFAULT_CHAIN_ID): string {
  return `did:pkh:eip155:${chainId}:${getAddress(address)}`;
}

export function computeRootId(address: Address, chainId = DEFAULT_CHAIN_ID): Hex {
  return keccak256(stringToHex(buildDidPkh(address, chainId)));
}

export function computeRootIdentityId(rootId: Hex): Hex {
  return keccak256(rootId);
}

export function deriveRootIdentity(
  address: Address,
  chainId = DEFAULT_CHAIN_ID,
  createdAt = new Date().toISOString(),
): RootIdentity {
  const controllerAddress = getAddress(address);
  const didLikeId = buildDidPkh(controllerAddress, chainId);
  const rootId = computeRootId(controllerAddress, chainId);

  return {
    rootId,
    identityId: computeRootIdentityId(rootId),
    controllerAddress,
    didLikeId,
    chainId,
    createdAt,
  };
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
