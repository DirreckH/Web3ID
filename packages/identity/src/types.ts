import type { Address, Hex } from "viem";

export const DEFAULT_CHAIN_ID = 31337;

export enum IdentityMode {
  DEFAULT_BEHAVIOR_MODE = "DEFAULT_BEHAVIOR_MODE",
  COMPLIANCE_MODE = "COMPLIANCE_MODE",
}

export enum SubIdentityType {
  RWA_INVEST = "RWA_INVEST",
  PAYMENTS = "PAYMENTS",
  SOCIAL = "SOCIAL",
  ANONYMOUS_LOWRISK = "ANONYMOUS_LOWRISK",
}

export const DEFAULT_ONLY_SUB_IDENTITY_TYPES = [
  SubIdentityType.SOCIAL,
  SubIdentityType.ANONYMOUS_LOWRISK,
] as const;

export const COMPLIANCE_CAPABLE_SUB_IDENTITY_TYPES = [
  SubIdentityType.RWA_INVEST,
  SubIdentityType.PAYMENTS,
] as const;

export enum RiskIsolationLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum LinkabilityLevel {
  NONE = "NONE",
  SAME_SCOPE = "SAME_SCOPE",
  ROOT_LINKABLE = "ROOT_LINKABLE",
}

export type SupportedProofKind = "holder_bound_proof" | "credential_bound_proof";

export type PermissionProfile = {
  allowedCredentialTypes: Hex[];
  allowedProofTypes: string[];
  supportedProofKinds: SupportedProofKind[];
  allowRootLink: boolean;
  riskIsolationLevel: RiskIsolationLevel;
  linkabilityLevel: LinkabilityLevel;
  canEscalateToRoot: boolean;
  inheritsRootRestrictions: boolean;
};

export type IdentityCapabilities = {
  supportsHolderBinding: boolean;
  supportsIssuerValidation: boolean;
  hasLinkedCredentials: boolean;
  supportedProofKinds: SupportedProofKind[];
  preferredMode: IdentityMode;
};

export type RootIdentity = {
  rootId: Hex;
  identityId: Hex;
  controllerAddress: Address;
  didLikeId: string;
  chainId: number;
  createdAt: string;
  guardianSetRef?: string;
  recoveryPolicySlotId?: string;
  capabilities: IdentityCapabilities;
};

export type SubIdentity = {
  subIdentityId: Hex;
  identityId: Hex;
  rootId: Hex;
  rootIdentityId: Hex;
  scope: string;
  type: SubIdentityType;
  createdAt: string;
  permissions: PermissionProfile;
  capabilities: IdentityCapabilities;
};

export type SubIdentityLinkProof = {
  proofType: "SUB_IDENTITY_LINK_V1";
  rootIdentityId: Hex;
  subIdentityId: Hex;
  scope: string;
  subIdentityType: SubIdentityType;
  commitment: Hex;
};

export type SameRootProof = {
  proofType: "SAME_ROOT_V1";
  rootCommitment: Hex;
  subIdentityIds: Hex[];
  commitment: Hex;
};

export type PolicyModeDescriptor = {
  policyId?: Hex;
  allowedModes: IdentityMode[];
  requiresComplianceMode: boolean;
};

export type PolicySupportResult = {
  supported: boolean;
  effectiveMode: IdentityMode | null;
  reason: string | null;
};

export type IdentityLike =
  | Pick<SubIdentity, "capabilities" | "permissions">
  | Pick<RootIdentity, "capabilities">;
