import type { Address, Hex } from "viem";

export const DEFAULT_CHAIN_ID = 31337;

export enum SubIdentityType {
  RWA_INVEST = "RWA_INVEST",
  PAYMENTS = "PAYMENTS",
  SOCIAL = "SOCIAL",
  ANONYMOUS_LOWRISK = "ANONYMOUS_LOWRISK",
}

export enum RiskIsolationLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export type PermissionProfile = {
  allowedCredentialTypes: Hex[];
  allowedProofTypes: string[];
  allowRootLink: boolean;
  riskIsolationLevel: RiskIsolationLevel;
};

export type RootIdentity = {
  rootId: Hex;
  identityId: Hex;
  controllerAddress: Address;
  didLikeId: string;
  chainId: number;
  createdAt: string;
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
