import { IdentityState } from "../../state/src/index.js";
import { keccak256, stringToHex, type Address, type Hex } from "viem";
import { z } from "zod";

export const POLICY_LABELS = {
  RWA_BUY_V2: "RWA_BUY_V2",
  ENTITY_PAYMENT_V1: "ENTITY_PAYMENT_V1",
  ENTITY_AUDIT_V1: "ENTITY_AUDIT_V1",
} as const;

export type PolicyLabel = (typeof POLICY_LABELS)[keyof typeof POLICY_LABELS];

export function computePolicyId(label: PolicyLabel | string): Hex {
  return keccak256(stringToHex(label));
}

export const POLICY_IDS = {
  RWA_BUY_V2: computePolicyId(POLICY_LABELS.RWA_BUY_V2),
  ENTITY_PAYMENT_V1: computePolicyId(POLICY_LABELS.ENTITY_PAYMENT_V1),
  ENTITY_AUDIT_V1: computePolicyId(POLICY_LABELS.ENTITY_AUDIT_V1),
} as const;

export const policySchema = z.object({
  policyId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  policyVersion: z.number().int().positive(),
  targetAction: z.string(),
  requiredCredentialTypes: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
  requiredStateRange: z.tuple([z.nativeEnum(IdentityState), z.nativeEnum(IdentityState)]),
  requiredIssuerSet: z.array(z.string()),
  proofTemplate: z.string(),
  expiryRule: z.string(),
  jurisdictionRule: z.string(),
  riskTolerance: z.string(),
  enabled: z.boolean(),
});

export type PolicyDefinition = z.infer<typeof policySchema>;

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

export function createProofRequest(input: {
  verifier: Address;
  requestedClaims: string[];
  policyId: Hex;
  policyVersion: number;
  nonce: Hex;
  challenge: Hex;
  timestamp?: number;
  acceptedProofTypes?: string[];
}): ProofRequest {
  return proofRequestSchema.parse({
    ...input,
    timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
    acceptedProofTypes: input.acceptedProofTypes ?? ["HOLDER_BINDING_GROTH16_V1"],
  });
}
