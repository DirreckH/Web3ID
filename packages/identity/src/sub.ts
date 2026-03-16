import { encodePacked, keccak256, type Hex } from "viem";
import {
  IdentityMode,
  LinkabilityLevel,
  type PolicyModeDescriptor,
  type PolicySupportResult,
  RiskIsolationLevel,
  SubIdentityType,
  type IdentityCapabilities,
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
        supportedProofKinds: ["holder_bound_proof", "credential_bound_proof"],
        allowRootLink: true,
        riskIsolationLevel: RiskIsolationLevel.MEDIUM,
        linkabilityLevel: LinkabilityLevel.ROOT_LINKABLE,
        canEscalateToRoot: true,
        inheritsRootRestrictions: true,
      };
    case SubIdentityType.PAYMENTS:
      return {
        allowedCredentialTypes,
        allowedProofTypes: DEFAULT_PROOF_TYPES,
        supportedProofKinds: ["holder_bound_proof", "credential_bound_proof"],
        allowRootLink: true,
        riskIsolationLevel: RiskIsolationLevel.HIGH,
        linkabilityLevel: LinkabilityLevel.ROOT_LINKABLE,
        canEscalateToRoot: true,
        inheritsRootRestrictions: true,
      };
    case SubIdentityType.SOCIAL:
      return {
        allowedCredentialTypes,
        allowedProofTypes: DEFAULT_PROOF_TYPES,
        supportedProofKinds: ["holder_bound_proof"],
        allowRootLink: false,
        riskIsolationLevel: RiskIsolationLevel.LOW,
        linkabilityLevel: LinkabilityLevel.SAME_SCOPE,
        canEscalateToRoot: false,
        inheritsRootRestrictions: true,
      };
    case SubIdentityType.ANONYMOUS_LOWRISK:
      return {
        allowedCredentialTypes,
        allowedProofTypes: ["HOLDER_BINDING_GROTH16_V1"],
        supportedProofKinds: ["holder_bound_proof"],
        allowRootLink: false,
        riskIsolationLevel: RiskIsolationLevel.HIGH,
        linkabilityLevel: LinkabilityLevel.NONE,
        canEscalateToRoot: false,
        inheritsRootRestrictions: false,
      };
  }
}

export function deriveIdentityCapabilities(
  permissions: PermissionProfile,
  options: {
    preferredMode?: IdentityMode;
    linkedCredentialTypes?: Hex[];
  } = {},
): IdentityCapabilities {
  const linkedCredentialTypes = options.linkedCredentialTypes ?? permissions.allowedCredentialTypes;
  const supportsIssuerValidation =
    permissions.supportedProofKinds.includes("credential_bound_proof") || linkedCredentialTypes.length > 0;
  const preferredMode =
    options.preferredMode ??
    (supportsIssuerValidation ? IdentityMode.COMPLIANCE_MODE : IdentityMode.DEFAULT_BEHAVIOR_MODE);

  return {
    supportsHolderBinding: true,
    supportsIssuerValidation,
    hasLinkedCredentials: linkedCredentialTypes.length > 0,
    supportedProofKinds: [...permissions.supportedProofKinds],
    preferredMode,
  };
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
    capabilities: deriveIdentityCapabilities(input.permissions ?? defaultPermissionProfile(input.type), {
      preferredMode:
        input.type === SubIdentityType.SOCIAL || input.type === SubIdentityType.ANONYMOUS_LOWRISK
          ? IdentityMode.DEFAULT_BEHAVIOR_MODE
          : IdentityMode.COMPLIANCE_MODE,
    }),
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

export function getIdentityCapabilities(
  identity: Pick<SubIdentity, "capabilities" | "permissions"> | Pick<RootIdentity, "capabilities">,
  options: { linkedCredentialTypes?: Hex[] } = {},
): IdentityCapabilities {
  if ("permissions" in identity) {
    return deriveIdentityCapabilities(identity.permissions, {
      preferredMode: identity.capabilities.preferredMode,
      linkedCredentialTypes: options.linkedCredentialTypes,
    });
  }

  return identity.capabilities;
}

export function getPreferredMode(identity: Pick<SubIdentity, "capabilities"> | Pick<RootIdentity, "capabilities">): IdentityMode {
  return identity.capabilities.preferredMode;
}

export function resolveEffectiveMode(
  identity: Pick<SubIdentity, "capabilities" | "permissions"> | Pick<RootIdentity, "capabilities">,
  policy: PolicyModeDescriptor,
  options: { linkedCredentialTypes?: Hex[] } = {},
): IdentityMode | null {
  const capabilities = getIdentityCapabilities(identity as Pick<SubIdentity, "capabilities" | "permissions">, options);
  const allowsDefault = policy.allowedModes.includes(IdentityMode.DEFAULT_BEHAVIOR_MODE);
  const allowsCompliance = policy.allowedModes.includes(IdentityMode.COMPLIANCE_MODE);
  const complianceReady =
    capabilities.supportsIssuerValidation &&
    capabilities.supportedProofKinds.includes("credential_bound_proof") &&
    capabilities.hasLinkedCredentials;

  if (policy.requiresComplianceMode) {
    return complianceReady && allowsCompliance ? IdentityMode.COMPLIANCE_MODE : null;
  }

  if (capabilities.preferredMode === IdentityMode.COMPLIANCE_MODE && complianceReady && allowsCompliance) {
    return IdentityMode.COMPLIANCE_MODE;
  }

  if (allowsDefault && capabilities.supportedProofKinds.includes("holder_bound_proof")) {
    return IdentityMode.DEFAULT_BEHAVIOR_MODE;
  }

  if (complianceReady && allowsCompliance) {
    return IdentityMode.COMPLIANCE_MODE;
  }

  return null;
}

export function supportsPolicy(
  identity: Pick<SubIdentity, "capabilities" | "permissions"> | Pick<RootIdentity, "capabilities">,
  policy: PolicyModeDescriptor,
  options: { linkedCredentialTypes?: Hex[] } = {},
): PolicySupportResult {
  const effectiveMode = resolveEffectiveMode(identity, policy, options);
  if (!effectiveMode) {
    return {
      supported: false,
      effectiveMode: null,
      reason: policy.requiresComplianceMode
        ? "This policy requires compliance mode with linked credentials."
        : "This identity does not support an allowed mode for the selected policy.",
    };
  }

  return {
    supported: true,
    effectiveMode,
    reason: null,
  };
}
