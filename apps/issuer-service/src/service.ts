import { randomUUID } from "node:crypto";
import {
  CREDENTIAL_DOMAIN_NAME,
  CREDENTIAL_DOMAIN_VERSION,
  CREDENTIAL_TYPES,
  computeClaimsHash,
  computeCredentialHash,
  computePolicyHintsHash,
  computeSubjectBinding,
  createCredentialBundle,
  credentialTypeLabels,
  recoverCredentialAttestationSigner,
  verifyCredentialBundle,
  type CredentialBundle,
  type CredentialStatus,
} from "@web3id/credential";
import { deriveRootIdentity } from "@web3id/identity";
import { POLICY_IDS } from "@web3id/policy";
import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { issuerConfig } from "./config.js";
import { loadStore, saveStore, type StoredCredentialRecord } from "./store.js";

export type IssueCredentialInput = {
  holder: string;
  holderIdentityId: Hex;
  subjectAddress: Address;
  credentialType: Hex;
  credentialTypeLabel: string;
  claimSet: Record<string, unknown>;
  policyHints: Hex[];
  evidenceRef?: string;
  previousCredentialId?: string;
  expiry?: number;
};

function buildStatus(bundle: CredentialBundle, revoked = false, replacedByCredentialId?: string): CredentialStatus {
  return {
    credentialId: bundle.credential.credentialId,
    revocationId: bundle.credential.revocationId as Hex,
    revoked,
    replacedByCredentialId,
    expiresAt: bundle.credential.expiry,
    issuerAddress: bundle.credential.issuerAddress as Address,
  };
}

export async function issueCredential(input: IssueCredentialInput): Promise<StoredCredentialRecord> {
  const subjectAddress = getAddress(input.subjectAddress);
  const subjectBinding = computeSubjectBinding(subjectAddress);
  const expiry = input.expiry ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const claimsHash = computeClaimsHash(input.claimSet);
  const policyHintsHash = computePolicyHintsHash(input.policyHints);
  const revocationId = keccak256(stringToHex(randomUUID()));
  const credentialHash = computeCredentialHash({
    credentialType: input.credentialType,
    revocationId,
    subjectBinding,
    issuer: issuerConfig.issuerAddress,
    expiration: expiry,
    claimsHash,
    policyHintsHash,
  });

  const signature = await issuerConfig.issuerAccount.signTypedData({
    domain: {
      name: CREDENTIAL_DOMAIN_NAME,
      version: CREDENTIAL_DOMAIN_VERSION,
      chainId: issuerConfig.chainId,
      verifyingContract: issuerConfig.complianceVerifierAddress,
    },
    types: {
      CredentialAttestation: [
        { name: "credentialType", type: "bytes32" },
        { name: "credentialHash", type: "bytes32" },
        { name: "revocationId", type: "bytes32" },
        { name: "subjectBinding", type: "bytes32" },
        { name: "issuer", type: "address" },
        { name: "expiration", type: "uint256" },
        { name: "claimsHash", type: "bytes32" },
        { name: "policyHintsHash", type: "bytes32" },
      ],
    },
    primaryType: "CredentialAttestation",
    message: {
      credentialType: input.credentialType,
      credentialHash,
      revocationId,
      subjectBinding,
      issuer: issuerConfig.issuerAddress,
      expiration: BigInt(expiry),
      claimsHash,
      policyHintsHash,
    },
  });

  const bundle = createCredentialBundle({
    credentialId: randomUUID(),
    issuerDid: issuerConfig.issuerDid,
    issuerAddress: issuerConfig.issuerAddress,
    holder: input.holder,
    holderIdentityId: input.holderIdentityId,
    credentialType: input.credentialType,
    credentialTypeLabel: input.credentialTypeLabel,
    subjectBinding,
    claimSet: input.claimSet,
    expiry,
    revocationId,
    policyHints: input.policyHints,
    signature,
    evidenceRef: input.evidenceRef,
    previousCredentialId: input.previousCredentialId,
  });

  // Reuse the precomputed hash to avoid divergence between sign input and persisted bundle.
  bundle.attestation.credentialHash = credentialHash;

  const store = await loadStore();
  const record: StoredCredentialRecord = {
    bundle,
    status: buildStatus(bundle),
    createdAt: new Date().toISOString(),
  };
  store.credentials[bundle.credential.credentialId] = record;
  await saveStore(store);
  return record;
}

export async function reissueCredential(input: { credentialId: string; claimSet?: Record<string, unknown>; expiry?: number }) {
  const store = await loadStore();
  const previous = store.credentials[input.credentialId];
  if (!previous) {
    throw new Error(`Unknown credential: ${input.credentialId}`);
  }

  previous.status.revoked = true;
  previous.revokedAt = new Date().toISOString();
  previous.revokeReason = "REISSUED";

  const next = await issueCredential({
    holder: previous.bundle.credential.holder,
    holderIdentityId: previous.bundle.credential.holderIdentityId as Hex,
    subjectAddress: previous.bundle.credential.holder.includes("0x")
      ? (previous.bundle.credential.holder.split(":").at(-1) as Address)
      : deriveRootIdentity(previous.bundle.credential.holder as Address).controllerAddress,
    credentialType: previous.bundle.credential.credentialType as Hex,
    credentialTypeLabel: previous.bundle.credential.credentialTypeLabel,
    claimSet: input.claimSet ?? previous.bundle.credential.claimSet,
    policyHints: previous.bundle.credential.policyHints as Hex[],
    evidenceRef: previous.bundle.credential.evidenceRef,
    previousCredentialId: previous.bundle.credential.credentialId,
    expiry: input.expiry ?? previous.bundle.credential.expiry,
  });

  previous.status.replacedByCredentialId = next.bundle.credential.credentialId;
  store.credentials[input.credentialId] = previous;
  store.credentials[next.bundle.credential.credentialId] = next;
  await saveStore(store);
  return next;
}

export async function revokeCredential(input: { credentialId: string; reason: string }) {
  const store = await loadStore();
  const record = store.credentials[input.credentialId];
  if (!record) {
    throw new Error(`Unknown credential: ${input.credentialId}`);
  }

  record.status.revoked = true;
  record.revokedAt = new Date().toISOString();
  record.revokeReason = input.reason;
  store.credentials[input.credentialId] = record;
  await saveStore(store);
  return record.status;
}

export async function getCredentialStatus(credentialId: string) {
  const store = await loadStore();
  const record = store.credentials[credentialId];
  if (!record) {
    throw new Error(`Unknown credential: ${credentialId}`);
  }

  return record.status;
}

export async function verifyIssuedCredential(bundle: CredentialBundle) {
  const bundleCheck = verifyCredentialBundle(bundle);
  const recovered = await recoverCredentialAttestationSigner({
    domain: {
      chainId: issuerConfig.chainId,
      verifyingContract: issuerConfig.complianceVerifierAddress,
    },
    attestation: bundle.attestation,
  });

  return {
    ...bundleCheck,
    signer: recovered,
    trustedIssuer: recovered.toLowerCase() === issuerConfig.issuerAddress.toLowerCase(),
  };
}

export async function issueCompatibilityCredential(input: {
  subjectDid: string;
  subjectAddress: Address;
  claimOverrides?: {
    amlPassed?: boolean;
    nonUSResident?: boolean;
    accreditedInvestor?: boolean;
    expirationDate?: number;
  };
}) {
  const rootIdentity = deriveRootIdentity(input.subjectAddress, issuerConfig.chainId);
  return issueCredential({
    holder: input.subjectDid,
    holderIdentityId: rootIdentity.identityId,
    subjectAddress: input.subjectAddress,
    credentialType: CREDENTIAL_TYPES.KYC_AML,
    credentialTypeLabel: "KycAmlCredential",
    claimSet: {
      amlPassed: input.claimOverrides?.amlPassed ?? true,
      nonUSResident: input.claimOverrides?.nonUSResident ?? true,
      accreditedInvestor: input.claimOverrides?.accreditedInvestor ?? true,
    },
    policyHints: [POLICY_IDS.RWA_BUY_V2],
    expiry: input.claimOverrides?.expirationDate,
  });
}

export function resolveCredentialPreset(kind: "kycAml" | "accreditedInvestor" | "entity") {
  switch (kind) {
    case "kycAml":
      return { credentialType: CREDENTIAL_TYPES.KYC_AML, credentialTypeLabel: "KycAmlCredential" };
    case "accreditedInvestor":
      return { credentialType: CREDENTIAL_TYPES.ACCREDITED_INVESTOR, credentialTypeLabel: "AccreditedInvestorCredential" };
    case "entity":
      return { credentialType: CREDENTIAL_TYPES.ENTITY, credentialTypeLabel: "EntityCredential" };
  }
}
