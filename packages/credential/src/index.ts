import { z } from "zod";
import {
  encodePacked,
  encodeAbiParameters,
  getAddress,
  hexToBigInt,
  isHex,
  keccak256,
  numberToHex,
  pad,
  parseAbiParameters,
  recoverTypedDataAddress,
  stringToHex,
  type Address,
  type Hex,
} from "viem";

export const SNARK_FIELD_MASK = (1n << 253n) - 1n;
export const CREDENTIAL_DOMAIN_NAME = "Web3ID Credential";
export const CREDENTIAL_DOMAIN_VERSION = "2";

export const credentialTypeLabels = {
  KYC_AML: "KYC_AML_CREDENTIAL",
  ACCREDITED_INVESTOR: "ACCREDITED_INVESTOR_CREDENTIAL",
  ENTITY: "ENTITY_CREDENTIAL",
} as const;

export function computeCredentialType(label: string): Hex {
  return keccak256(stringToHex(label));
}

export const CREDENTIAL_TYPES = {
  KYC_AML: computeCredentialType(credentialTypeLabels.KYC_AML),
  ACCREDITED_INVESTOR: computeCredentialType(credentialTypeLabels.ACCREDITED_INVESTOR),
  ENTITY: computeCredentialType(credentialTypeLabels.ENTITY),
} as const;

export const DEFAULT_SCHEMA_VERSION = "2.0";

export const web3IdCredentialSchema = z.object({
  credentialId: z.string(),
  issuer: z.string(),
  issuerAddress: z.string(),
  holder: z.string(),
  holderIdentityId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  credentialType: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  credentialTypeLabel: z.string(),
  subjectBinding: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  rootBinding: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  subjectAggregateBinding: z.string().optional(),
  subjectAggregateId: z.string().optional(),
  claimSet: z.record(z.unknown()),
  issueTime: z.string(),
  expiry: z.number().int().positive(),
  revocationId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  schemaVersion: z.string(),
  evidenceRef: z.string().optional(),
  policyHints: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
  previousCredentialId: z.string().optional(),
});

export type Web3IdCredential = z.infer<typeof web3IdCredentialSchema>;

export const credentialAttestationSchema = z.object({
  credentialType: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  credentialHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  revocationId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  subjectBinding: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  issuer: z.string(),
  expiration: z.number().int().positive(),
  claimsHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  policyHintsHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  policyHints: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
  signature: z.string().regex(/^0x[0-9a-fA-F]*$/),
});

export type CredentialAttestation = z.infer<typeof credentialAttestationSchema>;

export const w3cCredentialViewSchema = z.object({
  "@context": z.array(z.string()),
  type: z.array(z.string()),
  issuer: z.string(),
  issuanceDate: z.string(),
  expirationDate: z.string(),
  credentialSubject: z.record(z.unknown()),
});

export type W3cCredentialView = z.infer<typeof w3cCredentialViewSchema>;

export const credentialBundleSchema = z.object({
  credential: web3IdCredentialSchema,
  attestation: credentialAttestationSchema,
  w3c: w3cCredentialViewSchema.optional(),
});

export type CredentialBundle = z.infer<typeof credentialBundleSchema>;

export type CredentialStatus = {
  credentialId: string;
  revocationId: Hex;
  revoked: boolean;
  replacedByCredentialId?: string;
  expiresAt: number;
  issuerAddress: Address;
};

export type HolderAuthorizationPayload = {
  identityId: Hex;
  subjectBinding: Hex;
  policyId: Hex;
  requestHash: Hex;
  chainId: number;
  nonce: bigint;
  deadline: bigint;
};

export type HolderAuthorization = {
  chainId: number;
  nonce: bigint;
  deadline: bigint;
  signature: Hex;
  requestHash: Hex;
  policyId: Hex;
  identityId: Hex;
  subjectBinding: Hex;
};

export const credentialAttestationTypes = {
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
} as const;

export const holderAuthorizationTypes = {
  HolderAuthorization: [
    { name: "identityId", type: "bytes32" },
    { name: "subjectBinding", type: "bytes32" },
    { name: "policyId", type: "bytes32" },
    { name: "requestHash", type: "bytes32" },
    { name: "chainId", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const policyHintsAbi = parseAbiParameters("bytes32[]");
const credentialHashAbi = parseAbiParameters(
  "bytes32 credentialType, bytes32 revocationId, bytes32 subjectBinding, address issuer, uint256 expiration, bytes32 claimsHash, bytes32 policyHintsHash",
);

export function toScalarHex(value: Hex): Hex {
  return pad(numberToHex(hexToBigInt(value) & SNARK_FIELD_MASK), { size: 32 });
}

export function serializeScalar(value: bigint | Hex): Hex {
  return isHex(value) ? pad(value, { size: 32 }) : pad(numberToHex(value), { size: 32 });
}

export function hexToByteBigints(value: Hex): bigint[] {
  const normalized = value.slice(2).padStart(64, "0");
  const bytes: bigint[] = [];
  for (let index = 0; index < normalized.length; index += 2) {
    bytes.push(BigInt(parseInt(normalized.slice(index, index + 2), 16)));
  }
  return bytes;
}

export function addressToBytes(address: Address): bigint[] {
  return hexToByteBigints(pad(getAddress(address) as Hex, { size: 32 }));
}

export function computeSubjectBinding(address: Address): Hex {
  return toScalarHex(keccak256(encodePacked(["address"], [getAddress(address)])));
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

export function computeClaimsHash(claimSet: Record<string, unknown>): Hex {
  return keccak256(stringToHex(stableStringify(claimSet)));
}

export function normalizePolicyHints(policyHints: Hex[]): Hex[] {
  return [...new Set(policyHints.map((item) => pad(item, { size: 32 }).toLowerCase() as Hex))].sort();
}

export function computePolicyHintsHash(policyHints: Hex[]): Hex {
  return keccak256(encodeAbiParameters(policyHintsAbi, [normalizePolicyHints(policyHints)]));
}

export function computeCredentialHash(input: {
  credentialType: Hex;
  revocationId: Hex;
  subjectBinding: Hex;
  issuer: Address;
  expiration: number;
  claimsHash: Hex;
  policyHintsHash: Hex;
}): Hex {
  return keccak256(
    encodeAbiParameters(credentialHashAbi, [
      pad(input.credentialType, { size: 32 }),
      pad(input.revocationId, { size: 32 }),
      pad(input.subjectBinding, { size: 32 }),
      getAddress(input.issuer),
      BigInt(input.expiration),
      pad(input.claimsHash, { size: 32 }),
      pad(input.policyHintsHash, { size: 32 }),
    ]),
  );
}

export function buildCredentialAttestationMessage(attestation: Omit<CredentialAttestation, "signature" | "policyHints">) {
  return {
    credentialType: pad(attestation.credentialType as Hex, { size: 32 }),
    credentialHash: pad(attestation.credentialHash as Hex, { size: 32 }),
    revocationId: pad(attestation.revocationId as Hex, { size: 32 }),
    subjectBinding: pad(attestation.subjectBinding as Hex, { size: 32 }),
    issuer: getAddress(attestation.issuer as Address),
    expiration: BigInt(attestation.expiration),
    claimsHash: pad(attestation.claimsHash as Hex, { size: 32 }),
    policyHintsHash: pad(attestation.policyHintsHash as Hex, { size: 32 }),
  };
}

export async function recoverCredentialAttestationSigner(input: {
  domain: {
    chainId: number;
    verifyingContract: Address;
  };
  attestation: CredentialAttestation;
}) {
  return recoverTypedDataAddress({
    domain: {
      name: CREDENTIAL_DOMAIN_NAME,
      version: CREDENTIAL_DOMAIN_VERSION,
      chainId: input.domain.chainId,
      verifyingContract: input.domain.verifyingContract,
    },
    types: credentialAttestationTypes,
    primaryType: "CredentialAttestation",
    message: buildCredentialAttestationMessage(input.attestation),
    signature: input.attestation.signature as Hex,
  });
}

export function buildHolderAuthorizationMessage(payload: HolderAuthorizationPayload) {
  return {
    identityId: pad(payload.identityId, { size: 32 }),
    subjectBinding: pad(payload.subjectBinding, { size: 32 }),
    policyId: pad(payload.policyId, { size: 32 }),
    requestHash: pad(payload.requestHash, { size: 32 }),
    chainId: BigInt(payload.chainId),
    nonce: payload.nonce,
    deadline: payload.deadline,
  };
}

export async function recoverHolderAuthorizationSigner(input: {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  payload: HolderAuthorizationPayload;
  signature: Hex;
}) {
  return recoverTypedDataAddress({
    domain: input.domain,
    types: holderAuthorizationTypes,
    primaryType: "HolderAuthorization",
    message: buildHolderAuthorizationMessage(input.payload),
    signature: input.signature,
  });
}

export function createW3cCredentialView(credential: Web3IdCredential): W3cCredentialView {
  return {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", credential.credentialTypeLabel],
    issuer: credential.issuer,
    issuanceDate: credential.issueTime,
    expirationDate: new Date(credential.expiry * 1000).toISOString(),
    credentialSubject: {
      holder: credential.holder,
      holderIdentityId: credential.holderIdentityId,
      subjectBinding: credential.subjectBinding,
      rootBinding: credential.rootBinding,
      subjectAggregateBinding: credential.subjectAggregateBinding,
      subjectAggregateId: credential.subjectAggregateId,
      claimSet: credential.claimSet,
      policyHints: credential.policyHints,
    },
  };
}

export function parseCredentialBundle(bundle: unknown): CredentialBundle {
  return credentialBundleSchema.parse(bundle);
}

export function verifyCredentialBundle(bundle: CredentialBundle) {
  const parsed = parseCredentialBundle(bundle);
  const claimsHash = computeClaimsHash(parsed.credential.claimSet);
  const policyHintsHash = computePolicyHintsHash(parsed.attestation.policyHints as Hex[]);
  const credentialHash = computeCredentialHash({
    credentialType: parsed.credential.credentialType as Hex,
    revocationId: parsed.credential.revocationId as Hex,
    subjectBinding: parsed.credential.subjectBinding as Hex,
    issuer: parsed.credential.issuerAddress as Address,
    expiration: parsed.credential.expiry,
    claimsHash,
    policyHintsHash,
  });

  return {
    valid:
      claimsHash.toLowerCase() === parsed.attestation.claimsHash.toLowerCase() &&
      policyHintsHash.toLowerCase() === parsed.attestation.policyHintsHash.toLowerCase() &&
      credentialHash.toLowerCase() === parsed.attestation.credentialHash.toLowerCase(),
    claimsHash,
    policyHintsHash,
    credentialHash,
  };
}

export function createCredentialBundle(input: {
  credentialId: string;
  issuerDid: string;
  issuerAddress: Address;
  holder: string;
  holderIdentityId: Hex;
  credentialType: Hex;
  credentialTypeLabel: string;
  subjectBinding: Hex;
  rootBinding?: Hex;
  subjectAggregateBinding?: string;
  subjectAggregateId?: string;
  claimSet: Record<string, unknown>;
  issueTime?: string;
  expiry: number;
  revocationId: Hex;
  policyHints: Hex[];
  signature: Hex;
  evidenceRef?: string;
  previousCredentialId?: string;
}): CredentialBundle {
  const credential: Web3IdCredential = {
    credentialId: input.credentialId,
    issuer: input.issuerDid,
    issuerAddress: getAddress(input.issuerAddress),
    holder: input.holder,
    holderIdentityId: pad(input.holderIdentityId, { size: 32 }),
    credentialType: pad(input.credentialType, { size: 32 }),
    credentialTypeLabel: input.credentialTypeLabel,
    subjectBinding: pad(input.subjectBinding, { size: 32 }),
    rootBinding: input.rootBinding ? pad(input.rootBinding, { size: 32 }) : undefined,
    subjectAggregateBinding: input.subjectAggregateBinding,
    subjectAggregateId: input.subjectAggregateId,
    claimSet: input.claimSet,
    issueTime: input.issueTime ?? new Date().toISOString(),
    expiry: input.expiry,
    revocationId: pad(input.revocationId, { size: 32 }),
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    evidenceRef: input.evidenceRef,
    policyHints: normalizePolicyHints(input.policyHints),
    previousCredentialId: input.previousCredentialId,
  };
  const claimsHash = computeClaimsHash(credential.claimSet);
  const policyHintsHash = computePolicyHintsHash(credential.policyHints as Hex[]);
  const credentialHash = computeCredentialHash({
    credentialType: credential.credentialType as Hex,
    revocationId: credential.revocationId as Hex,
    subjectBinding: credential.subjectBinding as Hex,
    issuer: credential.issuerAddress as Address,
    expiration: credential.expiry,
    claimsHash,
    policyHintsHash,
  });

  return parseCredentialBundle({
    credential,
    attestation: {
      credentialType: credential.credentialType,
      credentialHash,
      revocationId: credential.revocationId,
      subjectBinding: credential.subjectBinding,
      issuer: credential.issuerAddress,
      expiration: credential.expiry,
      claimsHash,
      policyHintsHash,
      policyHints: credential.policyHints,
      signature: input.signature,
    },
    w3c: createW3cCredentialView(credential),
  });
}
