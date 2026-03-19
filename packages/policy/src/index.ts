import { IdentityMode, type PolicyModeDescriptor, type SupportedProofKind } from "../../identity/src/index.js";
import { proofPrivacyModes, type DisclosureProfile, type ProofPrivacyMode } from "../../proof/src/index.js";
import { createVersionEnvelope, type VersionEnvelope } from "../../identity/src/index.js";
import { IdentityState } from "../../state/src/index.js";
import { keccak256, stringToHex, type Address, type Hex } from "viem";
import { z } from "zod";

export const POLICY_LABELS = {
  RWA_BUY_V2: "RWA_BUY_V2",
  ENTITY_PAYMENT_V1: "ENTITY_PAYMENT_V1",
  ENTITY_AUDIT_V1: "ENTITY_AUDIT_V1",
  GOV_VOTE_V1: "GOV_VOTE_V1",
  AIRDROP_ELIGIBILITY_V1: "AIRDROP_ELIGIBILITY_V1",
  COMMUNITY_POST_V1: "COMMUNITY_POST_V1",
} as const;

export type PolicyLabel = (typeof POLICY_LABELS)[keyof typeof POLICY_LABELS];

export type PolicyAction =
  | "allow"
  | "deny"
  | "observe"
  | "restrict"
  | "review_required"
  | "freeze"
  | "trust_boost"
  | "limit_relaxation"
  | "access_unlock";

export function computePolicyId(label: PolicyLabel | string): Hex {
  return keccak256(stringToHex(label));
}

export const POLICY_IDS = {
  RWA_BUY_V2: computePolicyId(POLICY_LABELS.RWA_BUY_V2),
  ENTITY_PAYMENT_V1: computePolicyId(POLICY_LABELS.ENTITY_PAYMENT_V1),
  ENTITY_AUDIT_V1: computePolicyId(POLICY_LABELS.ENTITY_AUDIT_V1),
  GOV_VOTE_V1: computePolicyId(POLICY_LABELS.GOV_VOTE_V1),
  AIRDROP_ELIGIBILITY_V1: computePolicyId(POLICY_LABELS.AIRDROP_ELIGIBILITY_V1),
  COMMUNITY_POST_V1: computePolicyId(POLICY_LABELS.COMMUNITY_POST_V1),
} as const;

const proofKindSchema = z.enum(["holder_bound_proof", "credential_bound_proof"]);
const proofPrivacyModeSchema = z.enum(proofPrivacyModes);

export const policySchema = z.object({
  policyId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  policyVersion: z.number().int().positive(),
  targetAction: z.string(),
  requiredCredentialTypes: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
  requiredStateRange: z.tuple([z.nativeEnum(IdentityState), z.nativeEnum(IdentityState)]),
  requiredIssuerSet: z.array(z.string()),
  proofTemplate: proofKindSchema,
  expiryRule: z.string(),
  jurisdictionRule: z.string(),
  riskTolerance: z.string(),
  enabled: z.boolean(),
  allowedModes: z.array(z.nativeEnum(IdentityMode)).nonempty(),
  requiresComplianceMode: z.boolean(),
  onPassAction: z.string(),
  onFailAction: z.string(),
  onRiskAction: z.string(),
  consequenceRule: z.string(),
  explanationTemplate: z.string(),
  manualReviewThreshold: z.number().optional(),
  requiredAssessmentLevel: z.string().optional(),
  cooldownRule: z.string().optional(),
  retryRule: z.string().optional(),
  stateOverrideRule: z.string().optional(),
  acceptedPrivacyModes: z.array(proofPrivacyModeSchema).optional(),
  issuerDisclosureRequirement: z.enum(["full", "hash_only", "hidden_reserved"]).optional(),
  disclosureProfiles: z.array(z.enum(["public", "selective_disclosure", "policy_minimal_disclosure"])).optional(),
  minimumDisclosureSet: z.array(z.string()).optional(),
  auditVisibleMinimumFacts: z.array(z.string()).optional(),
});

export type PolicyDefinition = z.infer<typeof policySchema>;
export type PolicyPrivacyRequirement = {
  acceptedPrivacyModes?: ProofPrivacyMode[];
  issuerDisclosureRequirement?: "full" | "hash_only" | "hidden_reserved";
};

export type PolicyDisclosureRequirement = {
  policyId: Hex;
  policyVersion: number;
  requiredClaims: string[];
  requiredIssuerVisibility: "full" | "hash_only" | "hidden_reserved";
  allowedDisclosureProfiles: DisclosureProfile[];
  minimumDisclosureSet: string[];
  auditVisibleMinimumFacts: string[];
  versionEnvelope: VersionEnvelope;
};

export const proofRequestSchema = z.object({
  verifier: z.string(),
  requestedClaims: z.array(z.string()),
  policyId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  policyVersion: z.number().int().positive(),
  nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  challenge: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  timestamp: z.number().int().positive(),
  acceptedProofTypes: z.array(z.string()),
});

export type ProofRequest = z.infer<typeof proofRequestSchema>;

export const CREDENTIAL_TYPES = {
  KYC_AML: computePolicyId("KYC_AML_CREDENTIAL"),
  ACCREDITED_INVESTOR: computePolicyId("ACCREDITED_INVESTOR_CREDENTIAL"),
  ENTITY: computePolicyId("ENTITY_CREDENTIAL"),
} as const;

function definePolicy(definition: Omit<PolicyDefinition, "policyId"> & { label: PolicyLabel }): PolicyDefinition {
  return policySchema.parse({
    ...definition,
    policyId: computePolicyId(definition.label),
  });
}

export const POLICY_DEFINITIONS = {
  RWA_BUY_V2: definePolicy({
    label: POLICY_LABELS.RWA_BUY_V2,
    policyVersion: 1,
    targetAction: "buy_rwa",
    requiredCredentialTypes: [CREDENTIAL_TYPES.KYC_AML],
    requiredStateRange: [IdentityState.NORMAL, IdentityState.NORMAL],
    requiredIssuerSet: [],
    proofTemplate: "credential_bound_proof",
    expiryRule: "NOT_EXPIRED",
    jurisdictionRule: "GLOBAL",
    riskTolerance: "LOW",
    enabled: true,
    allowedModes: [IdentityMode.COMPLIANCE_MODE],
    requiresComplianceMode: true,
    onPassAction: "allow",
    onFailAction: "deny",
    onRiskAction: "restrict",
    consequenceRule: "rwa_access_control",
    explanationTemplate: "RWA access requires compliance mode, a valid credential, and NORMAL state.",
  }),
  ENTITY_PAYMENT_V1: definePolicy({
    label: POLICY_LABELS.ENTITY_PAYMENT_V1,
    policyVersion: 1,
    targetAction: "submit_payment",
    requiredCredentialTypes: [CREDENTIAL_TYPES.ENTITY],
    requiredStateRange: [IdentityState.NORMAL, IdentityState.RESTRICTED],
    requiredIssuerSet: [],
    proofTemplate: "credential_bound_proof",
    expiryRule: "NOT_EXPIRED",
    jurisdictionRule: "GLOBAL",
    riskTolerance: "MEDIUM",
    enabled: true,
    allowedModes: [IdentityMode.COMPLIANCE_MODE],
    requiresComplianceMode: true,
    onPassAction: "allow",
    onFailAction: "deny",
    onRiskAction: "review_required",
    consequenceRule: "entity_payment_control",
    explanationTemplate: "Enterprise payment requires compliance mode and an enabled entity credential.",
  }),
  ENTITY_AUDIT_V1: definePolicy({
    label: POLICY_LABELS.ENTITY_AUDIT_V1,
    policyVersion: 1,
    targetAction: "export_audit",
    requiredCredentialTypes: [CREDENTIAL_TYPES.ENTITY],
    requiredStateRange: [IdentityState.NORMAL, IdentityState.HIGH_RISK],
    requiredIssuerSet: [],
    proofTemplate: "credential_bound_proof",
    expiryRule: "NOT_EXPIRED",
    jurisdictionRule: "GLOBAL",
    riskTolerance: "MEDIUM",
    enabled: true,
    allowedModes: [IdentityMode.COMPLIANCE_MODE],
    requiresComplianceMode: true,
    onPassAction: "allow",
    onFailAction: "deny",
    onRiskAction: "review_required",
    consequenceRule: "entity_audit_control",
    explanationTemplate: "Enterprise audit export requires compliance mode and an enabled entity credential.",
  }),
  GOV_VOTE_V1: definePolicy({
    label: POLICY_LABELS.GOV_VOTE_V1,
    policyVersion: 1,
    targetAction: "governance_vote",
    requiredCredentialTypes: [],
    requiredStateRange: [IdentityState.NORMAL, IdentityState.NORMAL],
    requiredIssuerSet: [],
    proofTemplate: "holder_bound_proof",
    expiryRule: "NONE",
    jurisdictionRule: "COMMUNITY",
    riskTolerance: "LOW",
    enabled: true,
    allowedModes: [IdentityMode.DEFAULT_BEHAVIOR_MODE],
    requiresComplianceMode: false,
    onPassAction: "allow",
    onFailAction: "deny",
    onRiskAction: "observe",
    consequenceRule: "social_governance_access",
    explanationTemplate: "Governance voting is available in default mode for identities in good standing.",
  }),
  AIRDROP_ELIGIBILITY_V1: definePolicy({
    label: POLICY_LABELS.AIRDROP_ELIGIBILITY_V1,
    policyVersion: 1,
    targetAction: "claim_airdrop",
    requiredCredentialTypes: [],
    requiredStateRange: [IdentityState.NORMAL, IdentityState.NORMAL],
    requiredIssuerSet: [],
    proofTemplate: "holder_bound_proof",
    expiryRule: "NONE",
    jurisdictionRule: "COMMUNITY",
    riskTolerance: "LOW",
    enabled: true,
    allowedModes: [IdentityMode.DEFAULT_BEHAVIOR_MODE],
    requiresComplianceMode: false,
    onPassAction: "access_unlock",
    onFailAction: "deny",
    onRiskAction: "observe",
    consequenceRule: "social_airdrop_access",
    explanationTemplate: "Airdrop eligibility uses default mode and deterministic demo signals only.",
  }),
  COMMUNITY_POST_V1: definePolicy({
    label: POLICY_LABELS.COMMUNITY_POST_V1,
    policyVersion: 1,
    targetAction: "create_post",
    requiredCredentialTypes: [],
    requiredStateRange: [IdentityState.NORMAL, IdentityState.NORMAL],
    requiredIssuerSet: [],
    proofTemplate: "holder_bound_proof",
    expiryRule: "NONE",
    jurisdictionRule: "COMMUNITY",
    riskTolerance: "LOW",
    enabled: true,
    allowedModes: [IdentityMode.DEFAULT_BEHAVIOR_MODE],
    requiresComplianceMode: false,
    onPassAction: "allow",
    onFailAction: "deny",
    onRiskAction: "observe",
    consequenceRule: "social_post_access",
    explanationTemplate: "Community posting stays in default mode and does not require issuer validation.",
  }),
} as const satisfies Record<PolicyLabel, PolicyDefinition>;

const POLICY_DEFINITION_BY_ID = new Map<Hex, PolicyDefinition>(
  Object.values(POLICY_DEFINITIONS).map((definition) => [definition.policyId as Hex, definition]),
);

export function getPolicyDefinition(input: Hex | PolicyLabel | PolicyDefinition): PolicyDefinition {
  if (typeof input !== "string") {
    return input;
  }

  if (input in POLICY_DEFINITIONS) {
    return POLICY_DEFINITIONS[input as PolicyLabel];
  }

  const definition = POLICY_DEFINITION_BY_ID.get(input as Hex);
  if (!definition) {
    throw new Error(`Unknown policy definition: ${input}`);
  }
  return definition;
}

export function getPolicyModeDescriptor(input: Hex | PolicyLabel | PolicyDefinition): PolicyModeDescriptor {
  const definition = getPolicyDefinition(input);
  return {
    policyId: definition.policyId as Hex,
    allowedModes: definition.allowedModes,
    requiresComplianceMode: definition.requiresComplianceMode,
  };
}

export function getRequiredProofKind(input: Hex | PolicyLabel | PolicyDefinition): SupportedProofKind {
  return getPolicyDefinition(input).proofTemplate;
}

export function getPolicyDisclosureRequirement(input: Hex | PolicyLabel | PolicyDefinition): PolicyDisclosureRequirement {
  const definition = getPolicyDefinition(input);
  return {
    policyId: definition.policyId as Hex,
    policyVersion: definition.policyVersion,
    requiredClaims: definition.requiredCredentialTypes.map((item) => item.toString()),
    requiredIssuerVisibility: definition.issuerDisclosureRequirement ?? (definition.requiresComplianceMode ? "full" : "hash_only"),
    allowedDisclosureProfiles: definition.disclosureProfiles ?? (definition.requiresComplianceMode ? ["public", "selective_disclosure"] : ["public", "selective_disclosure", "policy_minimal_disclosure"]),
    minimumDisclosureSet: definition.minimumDisclosureSet ?? [],
    auditVisibleMinimumFacts: definition.auditVisibleMinimumFacts ?? [],
    versionEnvelope: createVersionEnvelope({
      policyVersion: definition.policyVersion,
    }),
  };
}

export function createProofRequest(input: {
  verifier: Address;
  requestedClaims: string[];
  policyId: Hex;
  policyVersion: number;
  nonce: Hex;
  challenge: Hex;
  timestamp?: number;
  acceptedProofTypes?: SupportedProofKind[];
}): ProofRequest {
  return proofRequestSchema.parse({
    ...input,
    timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
    acceptedProofTypes: input.acceptedProofTypes ?? [getRequiredProofKind(input.policyId)],
  });
}
