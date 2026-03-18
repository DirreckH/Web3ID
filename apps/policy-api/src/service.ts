import { createPublicClient, http, type Hex } from "viem";
import { POLICY_DEFINITIONS, getPolicyDefinition, type PolicyDefinition } from "../../../packages/policy/src/index.js";
import { evaluateAccessRisk, evaluateWarningRisk, type PolicyDecision } from "../../../packages/risk/src/index.js";
import { complianceVerifierAbi } from "../../../packages/sdk/src/index.js";
import type { CredentialBundle } from "../../../packages/credential/src/index.js";
import { policyApiConfig } from "./config.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const publicClient = createPublicClient({ transport: http(policyApiConfig.rpcUrl) });

type AccessPayloadLike = {
  identityId: Hex;
  credentialAttestations: Array<{
    credentialType: Hex;
    credentialHash: Hex;
    revocationId: Hex;
    subjectBinding: Hex;
    issuer: `0x${string}`;
    expiration: number | bigint;
    claimsHash: Hex;
    policyHintsHash: Hex;
    policyHints: Hex[];
    signature: Hex;
  }>;
  zkProof: {
    proofPoints: Array<bigint | number>;
    publicSignals: Array<bigint | number>;
  };
  policyVersion: number;
  holderAuthorization: {
    identityId: Hex;
    subjectBinding: Hex;
    policyId: Hex;
    requestHash: Hex;
    chainId: number;
    nonce: bigint | number;
    deadline: bigint | number;
    signature: Hex;
  };
};
type CredentialBundleLike = CredentialBundle;

type RiskContextResponse = Awaited<ReturnType<typeof loadRiskContext>>;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${url}`);
  return response.json() as Promise<T>;
}

async function loadRiskContext(identityId: Hex) {
  return fetchJson<{
    identityId: Hex;
    summary: any;
    score: any;
    signals: any[];
    reviewQueue: any[];
    riskRecord: any;
  }>(`${policyApiConfig.analyzerApiUrl}/identities/${identityId}/risk-context`);
}

function normalizePolicyDecision(decision: PolicyDecision) {
  return {
    decision: decision.decision,
    state: decision.state,
    reasons: decision.reasons,
    warnings: decision.warnings,
    evidenceRefs: decision.evidenceRefs,
    policyVersion: decision.policyVersion,
    credentialReasons: decision.credentialReasons ?? [],
    riskReasons: decision.riskReasons ?? [],
    policyReasons: decision.policyReasons ?? [],
    auditRecordIds: decision.auditRecordIds ?? [],
  };
}

function localCredentialChecks(input: { identityId: Hex; policyId: Hex; policyVersion: number; payload?: AccessPayloadLike | null; policy: PolicyDefinition }) {
  const reasons: Array<{ code: string; message: string }> = [];
  const payload = input.payload;
  if (!payload) {
    reasons.push({ code: "MISSING_PAYLOAD", message: "Access payload is required for a final access decision." });
    return { valid: false, reasons };
  }
  if (payload.identityId !== input.identityId) reasons.push({ code: "IDENTITY_MISMATCH", message: "Payload identity does not match the requested identity." });
  if (payload.policyVersion !== input.policyVersion) reasons.push({ code: "PAYLOAD_POLICY_VERSION_MISMATCH", message: "Payload policy version does not match the requested policy version." });
  if (payload.holderAuthorization.identityId !== input.identityId) reasons.push({ code: "HOLDER_IDENTITY_MISMATCH", message: "Holder authorization identityId does not match the requested identity." });
  if (payload.holderAuthorization.policyId !== input.policyId) reasons.push({ code: "HOLDER_POLICY_MISMATCH", message: "Holder authorization policyId does not match the requested policy." });
  if (Number(payload.holderAuthorization.deadline) <= Math.floor(Date.now() / 1000)) reasons.push({ code: "HOLDER_AUTH_EXPIRED", message: "Holder authorization deadline has expired." });
  if (payload.zkProof.publicSignals.length === 0) reasons.push({ code: "MISSING_PUBLIC_SIGNAL", message: "Proof public signal is missing." });
  if (payload.zkProof.publicSignals.length > 0 && BigInt(payload.zkProof.publicSignals[0]) !== BigInt(payload.holderAuthorization.subjectBinding)) reasons.push({ code: "SUBJECT_BINDING_MISMATCH", message: "Proof public signal does not match the holder authorization subject binding." });
  if (payload.zkProof.proofPoints.length !== 8) reasons.push({ code: "INVALID_PROOF_SHAPE", message: "Proof points must contain exactly 8 items." });

  const requiredTypes = new Set(input.policy.requiredCredentialTypes as Hex[]);
  const providedTypes = new Set(payload.credentialAttestations.map((attestation) => attestation.credentialType));
  for (const requiredType of requiredTypes) {
    if (!providedTypes.has(requiredType)) reasons.push({ code: "MISSING_REQUIRED_CREDENTIAL", message: `Missing required credential type ${requiredType}.` });
  }
  for (const attestation of payload.credentialAttestations) {
    if (BigInt(attestation.expiration) <= BigInt(Math.floor(Date.now() / 1000))) reasons.push({ code: "CREDENTIAL_EXPIRED", message: `Credential ${attestation.credentialType} has expired.` });
    if (attestation.subjectBinding !== payload.holderAuthorization.subjectBinding) reasons.push({ code: "ATTESTATION_BINDING_MISMATCH", message: `Credential ${attestation.credentialType} is not bound to the holder authorization subject.` });
    if (!attestation.policyHints.includes(input.policyId)) reasons.push({ code: "POLICY_HINT_MISMATCH", message: `Credential ${attestation.credentialType} does not advertise the requested policy hint.` });
  }
  return { valid: reasons.length === 0, reasons };
}

function localBundleConsistencyChecks(input: { payload?: AccessPayloadLike | null; credentialBundles?: CredentialBundleLike[] }) {
  const reasons: Array<{ code: string; message: string }> = [];
  const payload = input.payload;
  const credentialBundles = input.credentialBundles ?? [];
  if (!credentialBundles.length) {
    reasons.push({
      code: "MISSING_CREDENTIAL_BUNDLES",
      message: "Credential bundles are required for an explicit issuer validation path.",
    });
    return { valid: false, reasons };
  }
  if (!payload) {
    return { valid: false, reasons };
  }

  const payloadByHash = new Map(payload.credentialAttestations.map((attestation) => [attestation.credentialHash.toLowerCase(), attestation]));
  for (const bundle of credentialBundles) {
    const attestation = bundle.attestation;
    const matchingPayloadAttestation = payloadByHash.get(attestation.credentialHash.toLowerCase());
    if (!matchingPayloadAttestation) {
      reasons.push({
        code: "BUNDLE_ATTESTATION_MISMATCH",
        message: `Credential bundle ${bundle.credential.credentialId} is not present in the submitted access payload.`,
      });
      continue;
    }
    if (matchingPayloadAttestation.subjectBinding !== attestation.subjectBinding) {
      reasons.push({
        code: "BUNDLE_SUBJECT_BINDING_MISMATCH",
        message: `Credential bundle ${bundle.credential.credentialId} does not match the payload subject binding.`,
      });
    }
  }

  return { valid: reasons.length === 0, reasons };
}

async function verifyCredentialBundlesWithIssuer(credentialBundles: CredentialBundleLike[]) {
  const reasons: Array<{ code: string; message: string }> = [];
  const results = await Promise.all(
    credentialBundles.map(async (bundle) => {
      try {
        return await fetchJson<{ valid: boolean; trustedIssuer: boolean; signer?: string }>(
          `${policyApiConfig.issuerApiUrl}/credentials/verify`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ bundle }),
          },
        );
      } catch (error) {
        return {
          valid: false,
          trustedIssuer: false,
          error: error instanceof Error ? error.message : "Issuer verification failed.",
        } as { valid: boolean; trustedIssuer: boolean; signer?: string; error: string };
      }
    }),
  );

  results.forEach((result, index) => {
    if (!result.valid) {
      reasons.push({
        code: "ISSUER_BUNDLE_INVALID",
        message: `Issuer verification failed for credential bundle ${credentialBundles[index]?.credential.credentialId ?? index}.`,
      });
    }
    if (!result.trustedIssuer) {
      reasons.push({
        code: "UNTRUSTED_ISSUER",
        message: `Credential bundle ${credentialBundles[index]?.credential.credentialId ?? index} was not signed by the configured issuer.`,
      });
    }
  });

  return { valid: reasons.length === 0, reasons, results };
}

async function verifyOnChain(input: { policyId: Hex; payload: AccessPayloadLike; verifierAddress?: `0x${string}` }) {
  const verifierAddress = input.verifierAddress ?? policyApiConfig.verifierAddress;
  if (!verifierAddress || verifierAddress === ZERO_ADDRESS) {
    return { valid: false, reason: { code: "VERIFIER_UNAVAILABLE", message: "Compliance verifier address is not configured." } };
  }
  try {
    await publicClient.readContract({ abi: complianceVerifierAbi as any, address: verifierAddress, functionName: "verifyAccess", args: [input.policyId, input.payload as any] });
    return { valid: true as const };
  } catch (error) {
    return { valid: false as const, reason: { code: "VERIFIER_DENIED", message: error instanceof Error ? error.message : "On-chain verifier rejected the payload." } };
  }
}

export async function getIdentityState(identityId: Hex) {
  const context = await loadRiskContext(identityId);
  return {
    identityId,
    storedState: context.summary?.storedState ?? context.riskRecord?.storedState ?? null,
    effectiveState: context.summary?.effectiveState ?? context.riskRecord?.effectiveState ?? null,
    anchoredState: context.summary?.anchoredState ?? context.riskRecord?.anchoredState ?? null,
  };
}

export async function getIdentitySignals(identityId: Hex) {
  const context = await loadRiskContext(identityId);
  return { identityId, items: context.signals ?? [] };
}

export async function getRiskSummary(identityId: Hex) {
  const context = await loadRiskContext(identityId);
  return context.summary;
}
export async function evaluateAccessDecision(input: {
  identityId: Hex;
  policyId: Hex;
  policyVersion: number;
  payload?: AccessPayloadLike | null;
  credentialBundles?: CredentialBundleLike[];
  verifierAddress?: `0x${string}`;
}) {
  const context = await loadRiskContext(input.identityId);
  if (!context.summary) throw new Error(`Risk summary unavailable for identity ${input.identityId}.`);

  const policy = getPolicyDefinition(input.policyId);
  const policyReasons: Array<{ code: string; message: string }> = [];
  if (policy.policyVersion !== input.policyVersion) {
    policyReasons.push({ code: "POLICY_VERSION_MISMATCH", message: `Requested policy version ${input.policyVersion} does not match stored version ${policy.policyVersion}.` });
  }

  const policyLabel = Object.entries(POLICY_DEFINITIONS).find(([, definition]) => definition.policyId === input.policyId)?.[0] ?? input.policyId;
  const riskDecision = evaluateAccessRisk({ policyLabel, summary: context.summary, policyVersion: input.policyVersion });
  const credentialCheck = localCredentialChecks({
    identityId: input.identityId,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    payload: input.payload,
    policy,
  });
  const bundleCheck = localBundleConsistencyChecks({
    payload: input.payload,
    credentialBundles: input.credentialBundles,
  });
  const issuerCheck = input.credentialBundles?.length ? await verifyCredentialBundlesWithIssuer(input.credentialBundles) : { valid: false, reasons: [] as Array<{ code: string; message: string }> };
  const onChainCheck = input.payload ? await verifyOnChain({ policyId: input.policyId, payload: input.payload, verifierAddress: input.verifierAddress }) : { valid: false, reason: { code: "MISSING_PAYLOAD", message: "Access payload is required for verifier execution." } };
  const credentialReasons = [
    ...bundleCheck.reasons,
    ...credentialCheck.reasons,
    ...issuerCheck.reasons,
    ...(onChainCheck.valid ? [] : [onChainCheck.reason]),
  ];

  let decision: "allow" | "restrict" | "deny" = "allow";
  if (policyReasons.length > 0 || credentialReasons.length > 0) {
    decision = "deny";
  } else if (riskDecision.decision === "deny") {
    decision = "deny";
  } else if (riskDecision.decision === "restrict") {
    decision = "restrict";
  }

  return normalizePolicyDecision({
    ...riskDecision,
    decision,
    reasons: [
      ...riskDecision.reasons,
      ...credentialReasons.map((reason) => reason.message),
      ...policyReasons.map((reason) => reason.message),
    ],
    credentialReasons,
    riskReasons: riskDecision.riskReasons ?? [],
    policyReasons,
    warnings: [
      ...riskDecision.warnings,
      ...(context.reviewQueue?.some((item: { status: string }) => item.status === "PENDING_REVIEW") ? ["Pending AI review item is still open."] : []),
    ],
    evidenceRefs: [...new Set([...(riskDecision.evidenceRefs ?? []), ...(context.summary.evidenceRefs ?? [])])],
  });
}

export async function evaluateWarningDecision(input: { identityId: Hex; policyId: string; policyVersion: number }) {
  const context = await loadRiskContext(input.identityId);
  if (!context.summary) throw new Error(`Risk summary unavailable for identity ${input.identityId}.`);
  const warningDecision = evaluateWarningRisk({ policyId: input.policyId, summary: context.summary, policyVersion: input.policyVersion });
  return {
    ...normalizePolicyDecision(warningDecision),
    counterpartySummary: context.summary,
  };
}

