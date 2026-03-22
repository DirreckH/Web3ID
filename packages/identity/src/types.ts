import type { Address, Hex } from "viem";

export const DEFAULT_CHAIN_ID = 31337;
export const ROOT_IDENTITY_SCHEMA_VERSION = "2.0";
export const SUBJECT_AGGREGATE_SCHEMA_VERSION = "1.0";
export const CONTROLLER_REF_VERSION = "1";
export const CONTROLLER_CHALLENGE_DOMAIN_TAG = "web3id.controller.challenge.v1";
export const CONTROLLER_CHALLENGE_VERSION = "1";

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

export type ChainFamily = "evm" | "solana" | "bitcoin";
export type ControllerProofType =
  | "eip191"
  | "solana_ed25519"
  | "bitcoin_bip322"
  | "bitcoin_legacy";
export type ControllerBindingType =
  | "root_controller"
  | "sub_identity_link"
  | "same_root_extension"
  | "subject_aggregate_link";
export type SubjectAggregateStatus = "ACTIVE" | "REVIEW_REQUIRED" | "SUSPENDED";
export type SubjectAggregateBindingStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export type ChainControllerRef = {
  chainFamily: ChainFamily;
  networkId: string;
  address: string;
  normalizedAddress: string;
  proofType: ControllerProofType;
  publicKeyHint?: string;
  didLikeId: string;
  controllerVersion: string;
};

export type ChainControllerRefInput = {
  chainFamily: ChainFamily;
  networkId: number | string;
  address: string;
  normalizedAddress?: string;
  proofType?: ControllerProofType;
  publicKeyHint?: string;
  didLikeId?: string;
  controllerVersion?: string;
};

export type RootIdentity = {
  rootId: Hex;
  identityId: Hex;
  controllerAddress?: Address;
  legacyControllerAddress?: Address;
  didLikeId: string;
  chainId?: number;
  primaryControllerRef: ChainControllerRef;
  subjectAggregateId?: string;
  schemaVersion: string;
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

export type SubjectAggregateControllerSummary = {
  rootIdentityId: Hex;
  rootId: Hex;
  controllerRef: ChainControllerRef;
  linkedAt: string;
};

export type SubjectAggregate = {
  subjectAggregateId: string;
  status: SubjectAggregateStatus;
  linkedRootIds: Hex[];
  controllerSummary: SubjectAggregateControllerSummary[];
  bindingGraphVersion: number;
  createdAt: string;
  updatedAt: string;
  evidenceRefs: string[];
  auditBundleRef?: string;
  schemaVersion: string;
};

export type SubjectAggregateBinding = {
  bindingId: string;
  subjectAggregateId: string;
  rootId: Hex;
  rootIdentityId: Hex;
  bindingType: Extract<ControllerBindingType, "subject_aggregate_link">;
  challengeHash: Hex;
  proofHash: Hex;
  authorizer: string;
  verifiedAt: string;
  status: SubjectAggregateBindingStatus;
  evidenceRefs: string[];
};

export type ControllerChallengeFields = {
  domainTag: typeof CONTROLLER_CHALLENGE_DOMAIN_TAG;
  challengeVersion: typeof CONTROLLER_CHALLENGE_VERSION;
  bindingType: ControllerBindingType;
  chainFamily: ChainFamily;
  networkId: string;
  normalizedAddress: string;
  proofType: ControllerProofType;
  rootIdentityId: string;
  subjectAggregateId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  replayScope: string;
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
