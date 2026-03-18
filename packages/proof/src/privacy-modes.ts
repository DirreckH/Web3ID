export const proofPrivacyModes = [
  "holder_binding",
  "credential_bound",
  "issuer_visible",
  "issuer_hidden_reserved",
  "multi_issuer_reserved",
] as const;

export type ProofPrivacyMode = (typeof proofPrivacyModes)[number];

export const legacyHolderBoundProofKind = "holder_bound_proof";
export const credentialBoundProofKind = "credential_bound_proof";

export function normalizeProofBindingKind(input: string) {
  if (input === legacyHolderBoundProofKind || input === "holder_binding") {
    return "holder_binding" as const;
  }
  if (input === credentialBoundProofKind || input === "credential_bound") {
    return "credential_bound" as const;
  }
  return input;
}
