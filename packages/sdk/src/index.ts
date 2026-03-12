import {
  buildHolderAuthorizationMessage,
  holderAuthorizationTypes,
  parseCredentialBundle,
  type CredentialAttestation,
  type CredentialBundle,
  type HolderAuthorization,
  type HolderAuthorizationPayload,
} from "@web3id/credential";
import { generateHolderBindingProof } from "@web3id/proof";
import { POLICY_IDS } from "../../policy/src/index.js";
import { IdentityState } from "../../state/src/index.js";
import { createWalletClient, custom, encodePacked, keccak256, type Address, type Hex, type PublicClient } from "viem";

export type ZkProofInput = {
  proofPoints: [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];
  publicSignals: [bigint];
};

export type AccessPayload = {
  identityId: Hex;
  credentialAttestations: CredentialAttestation[];
  zkProof: ZkProofInput;
  policyVersion: number;
  holderAuthorization: HolderAuthorization;
};

const credentialAttestationComponents = [
  { name: "credentialType", type: "bytes32" },
  { name: "credentialHash", type: "bytes32" },
  { name: "revocationId", type: "bytes32" },
  { name: "subjectBinding", type: "bytes32" },
  { name: "issuer", type: "address" },
  { name: "expiration", type: "uint256" },
  { name: "claimsHash", type: "bytes32" },
  { name: "policyHintsHash", type: "bytes32" },
  { name: "policyHints", type: "bytes32[]" },
  { name: "signature", type: "bytes" },
] as const;

const zkProofComponents = [
  { name: "proofPoints", type: "uint256[8]" },
  { name: "publicSignals", type: "uint256[1]" },
] as const;

const holderAuthorizationComponents = [
  { name: "identityId", type: "bytes32" },
  { name: "subjectBinding", type: "bytes32" },
  { name: "policyId", type: "bytes32" },
  { name: "requestHash", type: "bytes32" },
  { name: "chainId", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
  { name: "signature", type: "bytes" },
] as const;

const accessPayloadComponents = [
  { name: "identityId", type: "bytes32" },
  { name: "credentialAttestations", type: "tuple[]", components: credentialAttestationComponents },
  { name: "zkProof", type: "tuple", components: zkProofComponents },
  { name: "policyVersion", type: "uint256" },
  { name: "holderAuthorization", type: "tuple", components: holderAuthorizationComponents },
] as const;

export const complianceVerifierAbi = [
  {
    type: "function",
    name: "verifyAccess",
    stateMutability: "view",
    inputs: [
      { name: "policyId", type: "bytes32" },
      { name: "payload", type: "tuple", components: accessPayloadComponents },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const rwaGateAbi = [
  {
    type: "function",
    name: "buyRwa",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payload", type: "tuple", components: accessPayloadComponents },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "purchasedAmount",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const enterpriseTreasuryGateAbi = [
  {
    type: "function",
    name: "submitPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payload", type: "tuple", components: accessPayloadComponents },
      { name: "beneficiary", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "exportAuditRecord",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payload", type: "tuple", components: accessPayloadComponents },
      { name: "auditRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "paymentCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const mockRwaAssetAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const issuerRegistryAbi = [
  {
    type: "function",
    name: "getIssuer",
    stateMutability: "view",
    inputs: [{ name: "issuer", type: "address" }],
    outputs: [{ type: "bool" }, { type: "bytes32" }],
  },
  {
    type: "function",
    name: "hasCapability",
    stateMutability: "view",
    inputs: [{ name: "issuer", type: "address" }, { name: "credentialType", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const revocationRegistryAbi = [
  {
    type: "function",
    name: "statusOf",
    stateMutability: "view",
    inputs: [{ name: "revocationId", type: "bytes32" }],
    outputs: [{ type: "bool" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
  },
] as const;

export const identityStateRegistryAbi = [
  {
    type: "function",
    name: "getState",
    stateMutability: "view",
    inputs: [{ name: "identityId", type: "bytes32" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "getStateSnapshot",
    stateMutability: "view",
    inputs: [{ name: "identityId", type: "bytes32" }],
    outputs: [{ type: "uint8" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" }],
  },
] as const;

export const policyRegistryAbi = [
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "bytes32" }],
    outputs: [
      { type: "uint256" },
      { type: "uint8" },
      { type: "uint8" },
      { type: "bytes32[]" },
      { type: "address[]" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bool" },
    ],
  },
] as const;

export async function issueCredential(apiUrl: string, input: {
  subjectDid: string;
  subjectAddress: Address;
  claimOverrides?: Record<string, unknown>;
}): Promise<CredentialBundle> {
  const response = await fetch(`${apiUrl}/credentials/issue`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Issuer service responded with ${response.status}`);
  }

  const body = await response.json();
  return parseCredentialBundle("bundle" in body ? body.bundle : body);
}

export async function issuePhase2Credential(
  apiUrl: string,
  input: {
    holder: string;
    holderIdentityId: Hex;
    subjectAddress: Address;
    credentialKind: "kycAml" | "accreditedInvestor" | "entity";
    claimSet: Record<string, unknown>;
    policyHints: Hex[];
    evidenceRef?: string;
    expiry?: number;
  },
) {
  const response = await fetch(`${apiUrl}/credentials/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Issuer service responded with ${response.status}`);
  }

  return response.json();
}

export async function reissueCredential(apiUrl: string, input: { credentialId: string; claimSet?: Record<string, unknown>; expiry?: number }) {
  const response = await fetch(`${apiUrl}/credentials/reissue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Issuer service responded with ${response.status}`);
  }
  return response.json();
}

export async function revokeCredential(apiUrl: string, input: { credentialId: string; reason: string }) {
  const response = await fetch(`${apiUrl}/credentials/revoke`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Issuer service responded with ${response.status}`);
  }
  return response.json();
}

export async function getCredentialStatus(apiUrl: string, credentialId: string) {
  const response = await fetch(`${apiUrl}/credentials/${credentialId}/status`);
  if (!response.ok) {
    throw new Error(`Issuer service responded with ${response.status}`);
  }
  return response.json();
}

export async function verifyCredentialStatus(apiUrl: string, bundle: CredentialBundle) {
  const response = await fetch(`${apiUrl}/credentials/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bundle }),
  });
  if (!response.ok) {
    throw new Error(`Issuer service responded with ${response.status}`);
  }
  return response.json();
}

export async function requestProof(input: {
  identityId: Hex;
  policyId: Hex;
  policyVersion: number;
  bundles: CredentialBundle[];
  subjectAddress: Address;
  holderAuthorization: HolderAuthorization;
  mode?: "browser" | "node";
}) {
  if (input.bundles.length === 0) {
    throw new Error("requestProof requires at least one credential bundle");
  }

  const proof = await generateHolderBindingProof(input.bundles[0], {
    mode: input.mode ?? "browser",
    subjectAddress: input.subjectAddress,
    artifactsBasePath: "",
  });

  return {
    identityId: input.identityId,
    credentialAttestations: input.bundles.map((bundle) => bundle.attestation),
    zkProof: {
      proofPoints: proof.proofPoints,
      publicSignals: proof.publicSignals,
    } satisfies ZkProofInput,
    policyVersion: input.policyVersion,
    holderAuthorization: input.holderAuthorization,
  } satisfies AccessPayload;
}

export async function signHolderAuthorization(
  account: Address,
  payload: HolderAuthorizationPayload,
  input: {
    name: string;
    version: string;
    verifyingContract: Address;
  },
): Promise<Hex> {
  const walletClient = createWalletClient({
    account,
    transport: custom((window as any).ethereum),
  });

  return walletClient.signTypedData({
    account,
    domain: {
      name: input.name,
      version: input.version,
      chainId: payload.chainId,
      verifyingContract: input.verifyingContract,
    },
    types: holderAuthorizationTypes,
    primaryType: "HolderAuthorization",
    message: buildHolderAuthorizationMessage(payload),
  });
}

export function buildHolderAuthorizationPayload(payload: HolderAuthorizationPayload, signature: Hex): HolderAuthorization {
  return {
    nonce: payload.nonce,
    deadline: payload.deadline,
    signature,
    requestHash: payload.requestHash,
    policyId: payload.policyId,
    identityId: payload.identityId,
    subjectBinding: payload.subjectBinding,
  };
}

export function buildRwaRequestHash(gateAddress: Address, amount: bigint): Hex {
  return keccak256(encodePacked(["string", "address", "uint256"], ["BUY_RWA", gateAddress, amount]));
}

export function buildEnterprisePaymentRequestHash(gateAddress: Address, beneficiary: Address, amount: bigint, paymentRef: Hex): Hex {
  return keccak256(
    encodePacked(["string", "address", "address", "uint256", "bytes32"], ["PAYMENT", gateAddress, beneficiary, amount, paymentRef]),
  );
}

export function buildEnterpriseAuditRequestHash(gateAddress: Address, auditRef: Hex): Hex {
  return keccak256(encodePacked(["string", "address", "bytes32"], ["AUDIT", gateAddress, auditRef]));
}

export async function verifyAccess(
  publicClient: PublicClient,
  verifierAddress: Address,
  policyId: Hex,
  payload: AccessPayload,
) {
  return publicClient.readContract({
    abi: complianceVerifierAbi as any,
    address: verifierAddress,
    functionName: "verifyAccess",
    args: [policyId, payload as any],
  });
}

export async function getPolicy(publicClient: PublicClient, registryAddress: Address, policyId: Hex) {
  return publicClient.readContract({
    abi: policyRegistryAbi as any,
    address: registryAddress,
    functionName: "getPolicy",
    args: [policyId],
  });
}

export async function getIdentityState(publicClient: PublicClient, registryAddress: Address, identityId: Hex) {
  const state = await publicClient.readContract({
    abi: identityStateRegistryAbi as any,
    address: registryAddress,
    functionName: "getState",
    args: [identityId],
  });
  return Number(state) as IdentityState;
}

export const policyIds = POLICY_IDS;
