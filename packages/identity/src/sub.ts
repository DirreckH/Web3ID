import { encodePacked, keccak256, type Hex } from "viem";
import {
  RiskIsolationLevel,
  SubIdentityType,
  type PermissionProfile,
  type RootIdentity,
  type SameRootProof,
  type SubIdentity,
  type SubIdentityLinkProof,
} from "./types.js";
import { computeRootIdentityId } from "./root.js";

const DEFAULT_PROOF_TYPES = ["HOLDER_BINDING_GROTH16_V1", "EIP712_CREDENTIAL_ATTESTATION_V2"];

export function normalizeScope(scope: string): string {
  return scope
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function defaultPermissionProfile(type: SubIdentityType, allowedCredentialTypes: Hex[] = []): PermissionProfile {
  switch (type) {
    case SubIdentityType.RWA_INVEST:
      return {
        allowedCredentialTypes,
        allowedProofTypes: DEFAULT_PROOF_TYPES,
        allowRootLink: true,
        riskIsolationLevel: RiskIsolationLevel.MEDIUM,
      };
    case SubIdentityType.PAYMENTS:
      return {
        allowedCredentialTypes,
        allowedProofTypes: DEFAULT_PROOF_TYPES,
        allowRootLink: true,
        riskIsolationLevel: RiskIsolationLevel.HIGH,
      };
    case SubIdentityType.SOCIAL:
      return {
        allowedCredentialTypes,
        allowedProofTypes: DEFAULT_PROOF_TYPES,
        allowRootLink: false,
        riskIsolationLevel: RiskIsolationLevel.LOW,
      };
    case SubIdentityType.ANONYMOUS_LOWRISK:
      return {
        allowedCredentialTypes,
        allowedProofTypes: ["HOLDER_BINDING_GROTH16_V1"],
        allowRootLink: false,
        riskIsolationLevel: RiskIsolationLevel.HIGH,
      };
  }
}

export function computeSubIdentityId(rootId: Hex, scope: string, type: SubIdentityType): Hex {
  return keccak256(encodePacked(["bytes32", "string", "string"], [rootId, normalizeScope(scope), type]));
}

export function computeSubIdentityIdentityId(subIdentityId: Hex): Hex {
  return keccak256(subIdentityId);
}

export function deriveSubIdentity(input: {
  rootIdentity: Pick<RootIdentity, "rootId">;
  scope: string;
  type: SubIdentityType;
  createdAt?: string;
  permissions?: PermissionProfile;
}): SubIdentity {
  const normalizedScope = normalizeScope(input.scope);
  const subIdentityId = computeSubIdentityId(input.rootIdentity.rootId, normalizedScope, input.type);

  return {
    subIdentityId,
    identityId: computeSubIdentityIdentityId(subIdentityId),
    rootId: input.rootIdentity.rootId,
    rootIdentityId: computeRootIdentityId(input.rootIdentity.rootId),
    scope: normalizedScope,
    type: input.type,
    createdAt: input.createdAt ?? new Date().toISOString(),
    permissions: input.permissions ?? defaultPermissionProfile(input.type),
  };
}

export function createSubIdentityLinkProof(rootIdentity: Pick<RootIdentity, "identityId" | "rootId">, subIdentity: SubIdentity): SubIdentityLinkProof {
  return {
    proofType: "SUB_IDENTITY_LINK_V1",
    rootIdentityId: rootIdentity.identityId,
    subIdentityId: subIdentity.identityId,
    scope: subIdentity.scope,
    subIdentityType: subIdentity.type,
    commitment: keccak256(
      encodePacked(
        ["bytes32", "bytes32", "string", "string"],
        [rootIdentity.rootId, subIdentity.subIdentityId, subIdentity.scope, subIdentity.type],
      ),
    ),
  };
}

export function verifySubIdentityLinkProof(
  proof: SubIdentityLinkProof,
  rootIdentity: Pick<RootIdentity, "identityId" | "rootId">,
  subIdentity: SubIdentity,
): boolean {
  if (proof.rootIdentityId !== rootIdentity.identityId || proof.subIdentityId !== subIdentity.identityId) {
    return false;
  }

  return proof.commitment === createSubIdentityLinkProof(rootIdentity, subIdentity).commitment;
}

export function createSameRootProof(rootIdentity: Pick<RootIdentity, "rootId">, subIdentities: SubIdentity[]): SameRootProof {
  const subIdentityIds = [...subIdentities.map((item) => item.identityId)].sort();
  const rootCommitment = keccak256(rootIdentity.rootId);

  return {
    proofType: "SAME_ROOT_V1",
    rootCommitment,
    subIdentityIds,
    commitment: keccak256(encodePacked(["bytes32", "bytes32[]"], [rootIdentity.rootId, subIdentityIds])),
  };
}

export function verifySameRootProof(
  proof: SameRootProof,
  rootIdentity: Pick<RootIdentity, "rootId">,
  subIdentities: SubIdentity[],
): boolean {
  const expected = createSameRootProof(rootIdentity, subIdentities);
  return (
    proof.rootCommitment === expected.rootCommitment &&
    proof.commitment === expected.commitment &&
    proof.subIdentityIds.join(",") === expected.subIdentityIds.join(",")
  );
}

export function listDefaultSubIdentities(rootIdentity: Pick<RootIdentity, "rootId">, allowedCredentialTypes: Partial<Record<SubIdentityType, Hex[]>> = {}) {
  return [
    deriveSubIdentity({
      rootIdentity,
      scope: "rwa-invest",
      type: SubIdentityType.RWA_INVEST,
      permissions: defaultPermissionProfile(SubIdentityType.RWA_INVEST, allowedCredentialTypes[SubIdentityType.RWA_INVEST]),
    }),
    deriveSubIdentity({
      rootIdentity,
      scope: "payments",
      type: SubIdentityType.PAYMENTS,
      permissions: defaultPermissionProfile(SubIdentityType.PAYMENTS, allowedCredentialTypes[SubIdentityType.PAYMENTS]),
    }),
    deriveSubIdentity({
      rootIdentity,
      scope: "social",
      type: SubIdentityType.SOCIAL,
      permissions: defaultPermissionProfile(SubIdentityType.SOCIAL, allowedCredentialTypes[SubIdentityType.SOCIAL]),
    }),
    deriveSubIdentity({
      rootIdentity,
      scope: "anonymous-lowrisk",
      type: SubIdentityType.ANONYMOUS_LOWRISK,
      permissions: defaultPermissionProfile(
        SubIdentityType.ANONYMOUS_LOWRISK,
        allowedCredentialTypes[SubIdentityType.ANONYMOUS_LOWRISK],
      ),
    }),
  ];
}
