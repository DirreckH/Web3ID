import { keccak256, stringToHex } from "viem";
import {
  credentialBoundProofKind,
  legacyHolderBoundProofKind,
  normalizeProofBindingKind,
  type ProofPrivacyMode,
} from "./privacy-modes.js";

export type ProofDescriptor = {
  proofId: string;
  proofType: string;
  privacyMode: ProofPrivacyMode;
  subjectBindingType: "root" | "sub";
  issuerDisclosure: "full" | "hash_only" | "hidden_reserved";
  supportsSelectiveDisclosure: boolean;
  supportsIssuerAnonymity: boolean;
  supportsMultiIssuerAggregation: boolean;
  createdAt: string;
};

export type ProofCapability = {
  proofType: string;
  supportedPrivacyModes: ProofPrivacyMode[];
  supportsCredentialBinding: boolean;
  supportsHolderBinding: boolean;
  supportsStateBinding: boolean;
  supportsPolicyBinding: boolean;
};

const proofCapabilities: ProofCapability[] = [
  {
    proofType: legacyHolderBoundProofKind,
    supportedPrivacyModes: ["holder_binding"],
    supportsCredentialBinding: false,
    supportsHolderBinding: true,
    supportsStateBinding: false,
    supportsPolicyBinding: true,
  },
  {
    proofType: credentialBoundProofKind,
    supportedPrivacyModes: ["credential_bound", "issuer_visible"],
    supportsCredentialBinding: true,
    supportsHolderBinding: true,
    supportsStateBinding: false,
    supportsPolicyBinding: true,
  },
];

export function getProofCapabilities() {
  return [...proofCapabilities];
}

export function buildProofDescriptor(input: {
  proofId?: string;
  proofType: string;
  subjectBindingType?: "root" | "sub";
  createdAt?: string;
}): ProofDescriptor {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const normalizedType = normalizeProofBindingKind(input.proofType);
  const proofId = input.proofId ?? keccak256(stringToHex([normalizedType, createdAt].join(":")));

  if (normalizedType === "holder_binding") {
    return {
      proofId,
      proofType: legacyHolderBoundProofKind,
      privacyMode: "holder_binding",
      subjectBindingType: input.subjectBindingType ?? "sub",
      issuerDisclosure: "hash_only",
      supportsSelectiveDisclosure: false,
      supportsIssuerAnonymity: false,
      supportsMultiIssuerAggregation: false,
      createdAt,
    };
  }

  if (normalizedType === "credential_bound") {
    return {
      proofId,
      proofType: credentialBoundProofKind,
      privacyMode: "credential_bound",
      subjectBindingType: input.subjectBindingType ?? "sub",
      issuerDisclosure: "full",
      supportsSelectiveDisclosure: false,
      supportsIssuerAnonymity: false,
      supportsMultiIssuerAggregation: false,
      createdAt,
    };
  }

  return {
    proofId,
    proofType: input.proofType,
    privacyMode: "issuer_hidden_reserved",
    subjectBindingType: input.subjectBindingType ?? "sub",
    issuerDisclosure: "hidden_reserved",
    supportsSelectiveDisclosure: false,
    supportsIssuerAnonymity: false,
    supportsMultiIssuerAggregation: false,
    createdAt,
  };
}

export function getProofDescriptor(
  input: string | { descriptor?: ProofDescriptor | null; proofDescriptor?: ProofDescriptor | null; proofType?: string | null },
) {
  if (typeof input === "string") {
    return buildProofDescriptor({ proofType: input });
  }
  if (input.descriptor) {
    return input.descriptor;
  }
  if (input.proofDescriptor) {
    return input.proofDescriptor;
  }
  if (!input.proofType) {
    throw new Error("Proof descriptor input requires either a descriptor or proofType.");
  }
  return buildProofDescriptor({ proofType: input.proofType });
}
