import { keccak256, stringToHex, type Hex } from "viem";
import type { ChainControllerRef } from "../../identity/src/types.js";
import { createVersionEnvelope, type VersionEnvelope } from "../../identity/src/versioning.js";
import {
  credentialBoundProofKind,
  legacyHolderBoundProofKind,
  normalizeProofBindingKind,
  type ProofPrivacyMode,
} from "./privacy-modes.js";

export type ProofPrivacyGuardrails = {
  defaultMode: "default_off";
  lifecycle: "hook_only";
  safety: "mock_safe";
  changesVerifySemantics: false;
};

export const proofPrivacyGuardrails: ProofPrivacyGuardrails = {
  defaultMode: "default_off",
  lifecycle: "hook_only",
  safety: "mock_safe",
  changesVerifySemantics: false,
};

export type ProofDescriptor = {
  proofId: string;
  proofType: string;
  privacyMode: ProofPrivacyMode;
  subjectBindingType: "root" | "sub";
  subjectRoute?: ProofSubjectRoute;
  issuerDisclosure: "full" | "hash_only" | "hidden_reserved";
  supportsSelectiveDisclosure: boolean;
  supportsIssuerAnonymity: boolean;
  supportsMultiIssuerAggregation: boolean;
  createdAt: string;
  disclosureProfile?: DisclosureProfile;
  generationRoute?: ProofGenerationRoute;
  verificationRule?: string;
  disclosedClaims?: string[];
  minimumDisclosureSet?: string[];
  auditVisibleFacts?: string[];
  versionEnvelope?: VersionEnvelope;
};

export type DisclosureProfile = "public" | "selective_disclosure" | "policy_minimal_disclosure";
export type ProofGenerationRoute = "legacy_holder_bound" | "legacy_credential_bound" | "descriptor_selective" | "descriptor_minimal";
export type ProofSubjectRoute = {
  controllerRef?: ChainControllerRef;
  rootIdentityId?: Hex;
  subjectAggregateId?: string;
  aggregateAware?: boolean;
};

export type ProofDescriptorV2 = ProofDescriptor & {
  disclosureProfile: DisclosureProfile;
  generationRoute: ProofGenerationRoute;
  verificationRule: "legacy_verify" | "descriptor_verify";
  disclosedClaims: string[];
  minimumDisclosureSet: string[];
  auditVisibleFacts: string[];
  versionEnvelope: VersionEnvelope;
};

export type DisclosureDecision = {
  profile: DisclosureProfile;
  disclosedClaims: string[];
  minimumDisclosureSet: string[];
  hiddenClaims: string[];
  auditVisibleFacts: string[];
  versionEnvelope: VersionEnvelope;
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
  subjectRoute?: ProofSubjectRoute;
  createdAt?: string;
  disclosureProfile?: DisclosureProfile;
  disclosedClaims?: string[];
  minimumDisclosureSet?: string[];
  auditVisibleFacts?: string[];
}): ProofDescriptorV2 {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const normalizedType = normalizeProofBindingKind(input.proofType);
  const proofId = input.proofId ?? keccak256(stringToHex([normalizedType, createdAt].join(":")));
  const disclosureProfile = input.disclosureProfile ?? defaultDisclosureProfileForProofType(normalizedType);
  const disclosureDecision = buildDisclosureDecision({
    profile: disclosureProfile,
    disclosedClaims: input.disclosedClaims ?? [],
    minimumDisclosureSet: input.minimumDisclosureSet ?? [],
    auditVisibleFacts: input.auditVisibleFacts ?? [],
  });

  if (normalizedType === "holder_binding") {
    return {
      proofId,
      proofType: legacyHolderBoundProofKind,
      privacyMode: "holder_binding",
      subjectBindingType: input.subjectBindingType ?? "sub",
      subjectRoute: input.subjectRoute,
      issuerDisclosure: "hash_only",
      supportsSelectiveDisclosure: disclosureProfile !== "public",
      supportsIssuerAnonymity: false,
      supportsMultiIssuerAggregation: false,
      createdAt,
      disclosureProfile,
      generationRoute: disclosureProfile === "public" ? "legacy_holder_bound" : "descriptor_minimal",
      verificationRule: disclosureProfile === "public" ? "legacy_verify" : "descriptor_verify",
      disclosedClaims: disclosureDecision.disclosedClaims,
      minimumDisclosureSet: disclosureDecision.minimumDisclosureSet,
      auditVisibleFacts: disclosureDecision.auditVisibleFacts,
      versionEnvelope: disclosureDecision.versionEnvelope,
    };
  }

  if (normalizedType === "credential_bound") {
    return {
      proofId,
      proofType: credentialBoundProofKind,
      privacyMode: "credential_bound",
      subjectBindingType: input.subjectBindingType ?? "sub",
      subjectRoute: input.subjectRoute,
      issuerDisclosure: "full",
      supportsSelectiveDisclosure: disclosureProfile !== "public",
      supportsIssuerAnonymity: false,
      supportsMultiIssuerAggregation: false,
      createdAt,
      disclosureProfile,
      generationRoute: disclosureProfile === "public" ? "legacy_credential_bound" : disclosureProfile === "selective_disclosure" ? "descriptor_selective" : "descriptor_minimal",
      verificationRule: disclosureProfile === "public" ? "legacy_verify" : "descriptor_verify",
      disclosedClaims: disclosureDecision.disclosedClaims,
      minimumDisclosureSet: disclosureDecision.minimumDisclosureSet,
      auditVisibleFacts: disclosureDecision.auditVisibleFacts,
      versionEnvelope: disclosureDecision.versionEnvelope,
    };
  }

  return {
    proofId,
    proofType: input.proofType,
    privacyMode: "issuer_hidden_reserved",
    subjectBindingType: input.subjectBindingType ?? "sub",
    subjectRoute: input.subjectRoute,
    issuerDisclosure: "hidden_reserved",
    supportsSelectiveDisclosure: false,
    supportsIssuerAnonymity: false,
    supportsMultiIssuerAggregation: false,
    createdAt,
    disclosureProfile,
    generationRoute: "descriptor_minimal",
    verificationRule: "descriptor_verify",
    disclosedClaims: disclosureDecision.disclosedClaims,
    minimumDisclosureSet: disclosureDecision.minimumDisclosureSet,
    auditVisibleFacts: disclosureDecision.auditVisibleFacts,
    versionEnvelope: disclosureDecision.versionEnvelope,
  };
}

export function getProofDescriptor(
  input: string | { descriptor?: ProofDescriptor | null; proofDescriptor?: ProofDescriptor | null; proofType?: string | null },
) {
  return getProofDescriptorSafe(input);
}

export function getProofDescriptorSafe(
  input: string | { descriptor?: ProofDescriptor | null; proofDescriptor?: ProofDescriptor | null; proofType?: string | null },
) {
  try {
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
  } catch {
    return buildProofDescriptor({ proofType: legacyHolderBoundProofKind });
  }
}

export function assertProofPrivacyGuardrails(metadata: ProofPrivacyGuardrails = proofPrivacyGuardrails) {
  if (metadata.changesVerifySemantics) {
    throw new Error("Proof privacy abstraction must not change the current proof verification semantics.");
  }
  return metadata;
}

export function buildDisclosureDecision(input: {
  profile: DisclosureProfile;
  disclosedClaims?: string[];
  minimumDisclosureSet?: string[];
  auditVisibleFacts?: string[];
}): DisclosureDecision {
  const disclosedClaims = [...new Set(input.disclosedClaims ?? [])];
  const minimumDisclosureSet = [...new Set(input.minimumDisclosureSet ?? [])];
  const auditVisibleFacts = [...new Set(input.auditVisibleFacts ?? [])];
  return {
    profile: input.profile,
    disclosedClaims,
    minimumDisclosureSet,
    hiddenClaims: disclosedClaims.filter((claim) => !minimumDisclosureSet.includes(claim)),
    auditVisibleFacts,
    versionEnvelope: createVersionEnvelope(),
  };
}

function defaultDisclosureProfileForProofType(normalizedType: string): DisclosureProfile {
  if (normalizedType === "credential_bound") {
    return "public";
  }
  return "policy_minimal_disclosure";
}
