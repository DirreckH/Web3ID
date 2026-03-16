import {
  buildHolderAuthorizationMessage,
  holderAuthorizationTypes,
  parseCredentialBundle,
  type CredentialAttestation,
  type CredentialBundle,
  type HolderAuthorization,
  type HolderAuthorizationPayload,
} from "@web3id/credential";
import {
  getIdentityCapabilities as getResolvedIdentityCapabilities,
  getPreferredMode as getResolvedPreferredMode,
  resolveEffectiveMode as resolveIdentityEffectiveMode,
  supportsPolicy as resolveIdentityPolicySupport,
  type RootIdentity,
  type SubIdentity,
} from "@web3id/identity";
import {
  POLICY_IDS,
  getPolicyDefinition,
  getPolicyModeDescriptor,
  type PolicyDefinition,
} from "@web3id/policy";
import { generateHolderBindingProof, generateHolderBoundProof } from "@web3id/proof";
import { IdentityState, getActiveConsequences, isStateInRange, type ConsequenceRecord } from "@web3id/state";
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

export type IdentityContextSnapshot = {
  currentState: IdentityState;
  activeConsequences?: ConsequenceRecord[];
  consequences?: ConsequenceRecord[];
};

export type PolicyPreflightResult = {
  allowed: boolean;
  source: "mode" | "state" | "consequence" | "policy";
  reason: string;
  blockingConsequences: ConsequenceRecord[];
};

type IdentityLike = Pick<SubIdentity, "capabilities" | "permissions"> | Pick<RootIdentity, "capabilities">;

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

export const socialGovernanceGateAbi = [
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payload", type: "tuple", components: accessPayloadComponents },
      { name: "proposalId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimAirdrop",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payload", type: "tuple", components: accessPayloadComponents },
      { name: "roundId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "createPost",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payload", type: "tuple", components: accessPayloadComponents },
      { name: "postRef", type: "bytes32" },
    ],
    outputs: [],
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
  {
    type: "function",
    name: "getAuditAnchors",
    stateMutability: "view",
    inputs: [{ name: "identityId", type: "bytes32" }],
    outputs: [{ type: "bytes32" }, { type: "bytes32" }],
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
  {
    type: "function",
    name: "getPolicyModeConfig",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "bytes32" }],
    outputs: [
      { type: "uint8" },
      { type: "bool" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
  },
] as const;

export function getIdentityCapabilities(identity: IdentityLike, bundles: CredentialBundle[] = []) {
  return getResolvedIdentityCapabilities(identity, {
    linkedCredentialTypes: extractCredentialTypes(bundles),
  });
}

export function getPreferredMode(identity: IdentityLike, bundles: CredentialBundle[] = []) {
  return getIdentityCapabilities(identity, bundles).preferredMode ?? getResolvedPreferredMode(identity);
}

export function resolveEffectiveMode(identity: IdentityLike, policyId: Hex | PolicyDefinition, bundles: CredentialBundle[] = []) {
  return resolveIdentityEffectiveMode(identity, getPolicyModeDescriptor(policyId), {
    linkedCredentialTypes: extractCredentialTypes(bundles),
  });
}

export function supportsPolicy(identity: IdentityLike, policyId: Hex | PolicyDefinition, bundles: CredentialBundle[] = []) {
  return resolveIdentityPolicySupport(identity, getPolicyModeDescriptor(policyId), {
    linkedCredentialTypes: extractCredentialTypes(bundles),
  });
}

export function evaluatePolicyPreflight(input: {
  identityContext?: IdentityContextSnapshot | null;
  policyId: Hex | PolicyDefinition;
  effectiveMode: ReturnType<typeof resolveEffectiveMode>;
  payload?: Pick<AccessPayload, "credentialAttestations"> | null;
}): PolicyPreflightResult {
  const policy = getPolicyDefinition(input.policyId);
  const effectiveMode = input.effectiveMode;
  if (!effectiveMode) {
    return {
      allowed: false,
      source: "mode",
      reason: "Denied by effective mode: this identity does not support an allowed mode for the selected policy.",
      blockingConsequences: [],
    };
  }

  if (policy.requiresComplianceMode && (input.payload?.credentialAttestations.length ?? 0) === 0) {
    return {
      allowed: false,
      source: "mode",
      reason: "Denied by effective mode: compliance mode policies require a credential-bound payload.",
      blockingConsequences: [],
    };
  }

  if (!input.identityContext) {
    return {
      allowed: false,
      source: "policy",
      reason: "Denied by policy preflight: identity context is unavailable.",
      blockingConsequences: [],
    };
  }

  const activeConsequences = input.identityContext.activeConsequences ?? getActiveConsequences(input.identityContext.consequences ?? []);
  const blockingConsequences = activeConsequences.filter((consequence) => consequenceBlocksPolicy(consequence, policy, effectiveMode));
  if (blockingConsequences.length > 0) {
    return {
      allowed: false,
      source: "consequence",
      reason: `Denied by active consequence: ${blockingConsequences.map((consequence) => consequence.consequenceType).join(", ")}.`,
      blockingConsequences,
    };
  }

  const [minState, maxState] = policy.requiredStateRange;
  if (!isStateInRange(input.identityContext.currentState, minState, maxState)) {
    return {
      allowed: false,
      source: "state",
      reason: `Denied by state: ${IdentityState[input.identityContext.currentState]} is outside ${IdentityState[minState]}-${IdentityState[maxState]}.`,
      blockingConsequences: [],
    };
  }

  return {
    allowed: true,
    source: "policy",
    reason: "Allowed: policy preflight passed.",
    blockingConsequences: [],
  };
}

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

export async function getIdentityContext(apiUrl: string, identityId: Hex) {
  const response = await fetch(`${apiUrl}/identities/${identityId}/context`);
  if (!response.ok) {
    throw new Error(`Issuer service responded with ${response.status}`);
  }
  return response.json();
}

export async function registerIdentityTree(apiUrl: string, input: { rootIdentity: RootIdentity; subIdentities: SubIdentity[] }) {
  const response = await fetch(`${apiUrl}/identities/register-tree`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Issuer service responded with ${response.status}`);
  }
  return response.json();
}

export async function applyDemoSignal(
  apiUrl: string,
  input: {
    identityId: Hex;
    signalKey: string;
    actor?: string;
  },
) {
  const response = await fetch(`${apiUrl}/identities/${input.identityId}/signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signalKey: input.signalKey, actor: input.actor }),
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
  bundles?: CredentialBundle[];
  subjectAddress: Address;
  holderAuthorization: HolderAuthorization;
  mode?: "browser" | "node";
}) {
  const bundles = input.bundles ?? [];
  const proof =
    bundles.length > 0
      ? await generateHolderBindingProof(bundles[0], {
          mode: input.mode ?? "browser",
          subjectAddress: input.subjectAddress,
          artifactsBasePath: "",
        })
      : await generateHolderBoundProof(input.subjectAddress, {
          mode: input.mode ?? "browser",
          subjectAddress: input.subjectAddress,
          artifactsBasePath: "",
        });

  return {
    identityId: input.identityId,
    credentialAttestations: bundles.map((bundle) => bundle.attestation),
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
    chainId: payload.chainId,
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

export function buildGovernanceVoteRequestHash(gateAddress: Address, proposalId: Hex): Hex {
  return keccak256(encodePacked(["string", "address", "bytes32"], ["VOTE", gateAddress, proposalId]));
}

export function buildAirdropClaimRequestHash(gateAddress: Address, roundId: Hex): Hex {
  return keccak256(encodePacked(["string", "address", "bytes32"], ["CLAIM_AIRDROP", gateAddress, roundId]));
}

export function buildCommunityPostRequestHash(gateAddress: Address, postRef: Hex): Hex {
  return keccak256(encodePacked(["string", "address", "bytes32"], ["CREATE_POST", gateAddress, postRef]));
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
export { getPolicyDefinition };

function extractCredentialTypes(bundles: CredentialBundle[]) {
  return bundles.map((bundle) => bundle.attestation.credentialType as Hex);
}

function consequenceBlocksPolicy(
  consequence: ConsequenceRecord,
  policy: PolicyDefinition,
  effectiveMode: NonNullable<ReturnType<typeof resolveEffectiveMode>>,
) {
  switch (consequence.consequenceType) {
    case "warn":
    case "trust_boost":
    case "limit_relaxation":
    case "access_unlock":
    case "reputation_badge":
      return false;
    case "limit":
      return effectiveMode === "DEFAULT_BEHAVIOR_MODE" || policy.riskTolerance === "LOW";
    case "review_required":
      return policy.requiredStateRange[0] === IdentityState.NORMAL && policy.requiredStateRange[1] === IdentityState.NORMAL;
    case "freeze":
      return true;
    default:
      return false;
  }
}
