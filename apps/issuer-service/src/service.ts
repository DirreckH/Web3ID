import { randomUUID } from "node:crypto";
import {
  CREDENTIAL_DOMAIN_NAME,
  CREDENTIAL_DOMAIN_VERSION,
  CREDENTIAL_TYPES,
  computeClaimsHash,
  computeCredentialHash,
  computePolicyHintsHash,
  computeSubjectBinding,
  createCredentialBundle,
  recoverCredentialAttestationSigner,
  verifyCredentialBundle,
  type CredentialBundle,
  type CredentialStatus,
} from "@web3id/credential";
import { deriveRootIdentity, SubIdentityType, type RootIdentity, type SubIdentity } from "@web3id/identity";
import { POLICY_IDS } from "@web3id/policy";
import {
  IdentityState,
  createIdentityStateContext,
  createRiskSignal,
  evaluatePropagation,
  getActiveConsequences,
  processRiskSignal,
  PropagationLevel,
  type IdentityStateContext,
  type RiskSignalInput,
} from "../../../packages/state/src/index.js";
import { createPublicClient, createWalletClient, getAddress, http, keccak256, stringToHex, type Address, type Hex } from "viem";
import { issuerConfig } from "./config.js";
import { loadStore, saveStore, type IssuerStore, type StoredCredentialRecord, type StoredIdentityRecord } from "./store.js";

export type IssueCredentialInput = {
  holder: string;
  holderIdentityId: Hex;
  subjectAddress: Address;
  credentialType: Hex;
  credentialTypeLabel: string;
  claimSet: Record<string, unknown>;
  policyHints: Hex[];
  evidenceRef?: string;
  previousCredentialId?: string;
  expiry?: number;
};

export type DemoSignalKey =
  | "new_wallet_observation"
  | "negative_risk_flag"
  | "sanction_hit"
  | "manual_review_fail"
  | "trusted_usage"
  | "governance_participation"
  | "good_standing";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const publicClient = createPublicClient({
  transport: http(issuerConfig.rpcUrl),
});
const walletClient = createWalletClient({
  account: issuerConfig.riskManagerAccount,
  chain: undefined,
  transport: http(issuerConfig.rpcUrl),
});

const DEMO_SIGNAL_CATALOG: Record<
  DemoSignalKey,
  Omit<RiskSignalInput, "identityId" | "sourceId" | "observedAt" | "actor" | "policyVersion">
> = {
  new_wallet_observation: {
    sourceType: "fixture",
    type: "NEW_WALLET_OBSERVATION",
    severity: "low",
    category: "negative",
    evidenceType: "FIXTURE_SIGNAL",
    evidenceRef: "fixture://new-wallet-observation",
    reason: "New wallet stays in observation before participating.",
    reasonCode: "NEW_WALLET_OBSERVATION",
    explanation: "Deterministic fixture marks this identity as a newly observed wallet.",
    requestedState: IdentityState.OBSERVED,
  },
  negative_risk_flag: {
    sourceType: "fixture",
    type: "NEGATIVE_RISK_FLAG",
    severity: "high",
    category: "negative",
    evidenceType: "FIXTURE_SIGNAL",
    evidenceRef: "fixture://negative-risk-flag",
    reason: "Mock negative risk flag blocks sensitive actions.",
    reasonCode: "NEGATIVE_RISK_FLAG",
    explanation: "Deterministic fixture simulates a negative community risk flag.",
    requestedState: IdentityState.RESTRICTED,
  },
  sanction_hit: {
    sourceType: "fixture",
    type: "SANCTION_HIT",
    severity: "critical",
    category: "negative",
    evidenceType: "FIXTURE_SIGNAL",
    evidenceRef: "fixture://sanction-hit",
    reason: "Critical risk freezes the identity.",
    reasonCode: "SANCTION_HIT",
    explanation: "Deterministic fixture simulates a critical sanction hit.",
    requestedState: IdentityState.FROZEN,
  },
  manual_review_fail: {
    sourceType: "manual",
    type: "MANUAL_REVIEW_RESULT",
    severity: "high",
    category: "negative",
    evidenceType: "MANUAL_REVIEW",
    evidenceRef: "fixture://manual-review-fail",
    reason: "Manual review failed and escalated risk.",
    reasonCode: "MANUAL_REVIEW_FAIL",
    explanation: "A mock manual reviewer recommended a stricter state.",
    requestedState: IdentityState.HIGH_RISK,
  },
  trusted_usage: {
    sourceType: "local_chain",
    type: "TRUSTED_PROTOCOL_USAGE",
    severity: "positive",
    category: "positive",
    evidenceType: "LOCAL_CHAIN_ACTIVITY",
    evidenceRef: "fixture://trusted-usage",
    reason: "Trusted protocol usage improves standing.",
    reasonCode: "TRUSTED_USAGE",
    explanation: "Deterministic local activity shows healthy protocol usage.",
    requestedState: IdentityState.NORMAL,
  },
  governance_participation: {
    sourceType: "fixture",
    type: "REPEATED_GOVERNANCE_PARTICIPATION",
    severity: "positive",
    category: "positive",
    evidenceType: "FIXTURE_SIGNAL",
    evidenceRef: "fixture://governance-participation",
    reason: "Repeated governance participation improves standing.",
    reasonCode: "GOVERNANCE_PARTICIPATION",
    explanation: "Deterministic fixture simulates healthy governance participation.",
    requestedState: IdentityState.NORMAL,
  },
  good_standing: {
    sourceType: "fixture",
    type: "LONG_TERM_GOOD_STANDING",
    severity: "positive",
    category: "positive",
    evidenceType: "FIXTURE_SIGNAL",
    evidenceRef: "fixture://good-standing",
    reason: "Long-term good standing unlocks access again.",
    reasonCode: "LONG_TERM_GOOD_STANDING",
    explanation: "Deterministic fixture simulates a clean history window.",
    requestedState: IdentityState.NORMAL,
  },
};

function buildStatus(bundle: CredentialBundle, revoked = false, replacedByCredentialId?: string): CredentialStatus {
  return {
    credentialId: bundle.credential.credentialId,
    revocationId: bundle.credential.revocationId as Hex,
    revoked,
    replacedByCredentialId,
    expiresAt: bundle.credential.expiry,
    issuerAddress: bundle.credential.issuerAddress as Address,
  };
}

export async function issueCredential(input: IssueCredentialInput): Promise<StoredCredentialRecord> {
  const subjectAddress = getAddress(input.subjectAddress);
  const subjectBinding = computeSubjectBinding(subjectAddress);
  const expiry = input.expiry ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const claimsHash = computeClaimsHash(input.claimSet);
  const policyHintsHash = computePolicyHintsHash(input.policyHints);
  const revocationId = keccak256(stringToHex(randomUUID()));
  const credentialHash = computeCredentialHash({
    credentialType: input.credentialType,
    revocationId,
    subjectBinding,
    issuer: issuerConfig.issuerAddress,
    expiration: expiry,
    claimsHash,
    policyHintsHash,
  });

  const signature = await issuerConfig.issuerAccount.signTypedData({
    domain: {
      name: CREDENTIAL_DOMAIN_NAME,
      version: CREDENTIAL_DOMAIN_VERSION,
      chainId: issuerConfig.chainId,
      verifyingContract: issuerConfig.complianceVerifierAddress,
    },
    types: {
      CredentialAttestation: [
        { name: "credentialType", type: "bytes32" },
        { name: "credentialHash", type: "bytes32" },
        { name: "revocationId", type: "bytes32" },
        { name: "subjectBinding", type: "bytes32" },
        { name: "issuer", type: "address" },
        { name: "expiration", type: "uint256" },
        { name: "claimsHash", type: "bytes32" },
        { name: "policyHintsHash", type: "bytes32" },
      ],
    },
    primaryType: "CredentialAttestation",
    message: {
      credentialType: input.credentialType,
      credentialHash,
      revocationId,
      subjectBinding,
      issuer: issuerConfig.issuerAddress,
      expiration: BigInt(expiry),
      claimsHash,
      policyHintsHash,
    },
  });

  const bundle = createCredentialBundle({
    credentialId: randomUUID(),
    issuerDid: issuerConfig.issuerDid,
    issuerAddress: issuerConfig.issuerAddress,
    holder: input.holder,
    holderIdentityId: input.holderIdentityId,
    credentialType: input.credentialType,
    credentialTypeLabel: input.credentialTypeLabel,
    subjectBinding,
    claimSet: input.claimSet,
    expiry,
    revocationId,
    policyHints: input.policyHints,
    signature,
    evidenceRef: input.evidenceRef,
    previousCredentialId: input.previousCredentialId,
  });

  bundle.attestation.credentialHash = credentialHash;

  const store = await loadStore();
  const record: StoredCredentialRecord = {
    bundle,
    status: buildStatus(bundle),
    createdAt: new Date().toISOString(),
  };
  store.credentials[bundle.credential.credentialId] = record;
  await saveStore(store);
  return record;
}

export async function reissueCredential(input: { credentialId: string; claimSet?: Record<string, unknown>; expiry?: number }) {
  const store = await loadStore();
  const previous = store.credentials[input.credentialId];
  if (!previous) {
    throw new Error(`Unknown credential: ${input.credentialId}`);
  }

  previous.status.revoked = true;
  previous.revokedAt = new Date().toISOString();
  previous.revokeReason = "REISSUED";

  const next = await issueCredential({
    holder: previous.bundle.credential.holder,
    holderIdentityId: previous.bundle.credential.holderIdentityId as Hex,
    subjectAddress: previous.bundle.credential.holder.includes("0x")
      ? (previous.bundle.credential.holder.split(":").at(-1) as Address)
      : deriveRootIdentity(previous.bundle.credential.holder as Address).controllerAddress,
    credentialType: previous.bundle.credential.credentialType as Hex,
    credentialTypeLabel: previous.bundle.credential.credentialTypeLabel,
    claimSet: input.claimSet ?? previous.bundle.credential.claimSet,
    policyHints: previous.bundle.credential.policyHints as Hex[],
    evidenceRef: previous.bundle.credential.evidenceRef,
    previousCredentialId: previous.bundle.credential.credentialId,
    expiry: input.expiry ?? previous.bundle.credential.expiry,
  });

  previous.status.replacedByCredentialId = next.bundle.credential.credentialId;
  store.credentials[input.credentialId] = previous;
  store.credentials[next.bundle.credential.credentialId] = next;
  await saveStore(store);
  return next;
}

export async function revokeCredential(input: { credentialId: string; reason: string }) {
  const store = await loadStore();
  const record = store.credentials[input.credentialId];
  if (!record) {
    throw new Error(`Unknown credential: ${input.credentialId}`);
  }

  record.status.revoked = true;
  record.revokedAt = new Date().toISOString();
  record.revokeReason = input.reason;
  store.credentials[input.credentialId] = record;
  await saveStore(store);
  return record.status;
}

export async function getCredentialStatus(credentialId: string) {
  const store = await loadStore();
  const record = store.credentials[credentialId];
  if (!record) {
    throw new Error(`Unknown credential: ${credentialId}`);
  }

  return record.status;
}

export async function verifyIssuedCredential(bundle: CredentialBundle) {
  const bundleCheck = verifyCredentialBundle(bundle);
  const recovered = await recoverCredentialAttestationSigner({
    domain: {
      chainId: issuerConfig.chainId,
      verifyingContract: issuerConfig.complianceVerifierAddress,
    },
    attestation: bundle.attestation,
  });

  return {
    ...bundleCheck,
    signer: recovered,
    trustedIssuer: recovered.toLowerCase() === issuerConfig.issuerAddress.toLowerCase(),
  };
}

export async function issueCompatibilityCredential(input: {
  subjectDid: string;
  subjectAddress: Address;
  claimOverrides?: {
    amlPassed?: boolean;
    nonUSResident?: boolean;
    accreditedInvestor?: boolean;
    expirationDate?: number;
  };
}) {
  const rootIdentity = deriveRootIdentity(input.subjectAddress, issuerConfig.chainId);
  return issueCredential({
    holder: input.subjectDid,
    holderIdentityId: rootIdentity.identityId,
    subjectAddress: input.subjectAddress,
    credentialType: CREDENTIAL_TYPES.KYC_AML,
    credentialTypeLabel: "KycAmlCredential",
    claimSet: {
      amlPassed: input.claimOverrides?.amlPassed ?? true,
      nonUSResident: input.claimOverrides?.nonUSResident ?? true,
      accreditedInvestor: input.claimOverrides?.accreditedInvestor ?? true,
    },
    policyHints: [POLICY_IDS.RWA_BUY_V2],
    expiry: input.claimOverrides?.expirationDate,
  });
}

export function resolveCredentialPreset(kind: "kycAml" | "accreditedInvestor" | "entity") {
  switch (kind) {
    case "kycAml":
      return { credentialType: CREDENTIAL_TYPES.KYC_AML, credentialTypeLabel: "KycAmlCredential" };
    case "accreditedInvestor":
      return { credentialType: CREDENTIAL_TYPES.ACCREDITED_INVESTOR, credentialTypeLabel: "AccreditedInvestorCredential" };
    case "entity":
      return { credentialType: CREDENTIAL_TYPES.ENTITY, credentialTypeLabel: "EntityCredential" };
  }
}

export async function registerIdentityTree(input: {
  rootIdentity: RootIdentity;
  subIdentities: SubIdentity[];
}) {
  const store = await loadStore();
  const rootKey = input.rootIdentity.identityId;
  const rootRecord = store.roots[rootKey] ?? { rootIdentity: input.rootIdentity, subIdentityIds: [] };
  rootRecord.rootIdentity = input.rootIdentity;

  for (const subIdentity of input.subIdentities) {
    const identityKey = subIdentity.identityId;
    const existing = store.identities[identityKey];
    const nextContext = existing?.context ?? createIdentityStateContext(identityKey, defaultInitialState(subIdentity));
    store.identities[identityKey] = {
      rootIdentity: input.rootIdentity,
      subIdentity,
      context: nextContext,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!rootRecord.subIdentityIds.includes(identityKey)) {
      rootRecord.subIdentityIds.push(identityKey);
    }
    await syncIdentityState(identityKey, nextContext.currentState, nextContext.lastDecisionRef, nextContext.lastEvidenceHash);
  }

  store.roots[rootKey] = rootRecord;
  await saveStore(store);
  return { rootIdentity: input.rootIdentity, subIdentities: input.subIdentities };
}

export async function getStoredIdentityContext(identityId: Hex) {
  const store = await loadStore();
  const record = store.identities[identityId];
  if (!record) {
    throw new Error(`Unknown identity: ${identityId}`);
  }

  return formatIdentityContext(record);
}

export async function applyIdentitySignal(input: {
  identityId: Hex;
  signalKey: DemoSignalKey;
  actor?: string;
}) {
  const store = await loadStore();
  const sourceRecord = store.identities[input.identityId];
  if (!sourceRecord) {
    throw new Error(`Unknown identity: ${input.identityId}`);
  }

  const signalTemplate = DEMO_SIGNAL_CATALOG[input.signalKey];
  if (!signalTemplate) {
    throw new Error(`Unknown signal preset: ${input.signalKey}`);
  }

  const baseSignal = createRiskSignal({
    ...signalTemplate,
    identityId: sourceRecord.subIdentity.identityId,
    sourceId: input.signalKey,
    observedAt: new Date().toISOString(),
    actor: input.actor ?? "demo-control-plane",
    policyVersion: 1,
  });

  const relatedRecords = Object.values(store.identities).filter(
    (record) => record.subIdentity.rootIdentityId === sourceRecord.subIdentity.rootIdentityId,
  );
  const propagation = evaluatePropagation(
    baseSignal,
    sourceRecord.subIdentity,
    relatedRecords.map((record) => record.subIdentity),
    signalTemplate.type === "SANCTION_HIT" ? PropagationLevel.ROOT_ESCALATION : undefined,
  );

  const updatedIdentityIds: Hex[] = [];
  for (const impactedIdentityId of propagation.impactedIdentityIds) {
    const impactedRecord = store.identities[impactedIdentityId];
    if (!impactedRecord) {
      continue;
    }

    const propagatedSignal =
      impactedIdentityId === sourceRecord.subIdentity.identityId
        ? baseSignal
        : createRiskSignal({
            ...signalTemplate,
            identityId: impactedIdentityId,
            sourceId: `${input.signalKey}:propagated:${sourceRecord.subIdentity.identityId}`,
            observedAt: new Date().toISOString(),
            actor: input.actor ?? "demo-control-plane",
            policyVersion: 1,
            reason: `${signalTemplate.reason} (propagated)`,
            explanation: `${signalTemplate.explanation} Propagation reason: ${propagation.reason}`,
          });

    const result = processRiskSignal(impactedRecord.context, propagatedSignal);
    impactedRecord.context = result.next;
    impactedRecord.updatedAt = new Date().toISOString();
    updatedIdentityIds.push(impactedIdentityId);
    await syncIdentityState(
      impactedIdentityId,
      result.next.currentState,
      result.next.lastDecisionRef,
      result.next.lastEvidenceHash,
    );
  }

  await saveStore(store);
  return {
    propagation,
    updatedIdentityIds,
    context: formatIdentityContext(store.identities[input.identityId]),
  };
}

export function listDemoSignals() {
  return Object.entries(DEMO_SIGNAL_CATALOG).map(([key, value]) => ({
    key,
    type: value.type,
    category: value.category,
    severity: value.severity,
    explanation: value.explanation,
  }));
}

function formatIdentityContext(record: StoredIdentityRecord) {
  return {
    rootIdentity: record.rootIdentity,
    subIdentity: record.subIdentity,
    currentState: record.context.currentState,
    signals: record.context.signals,
    assessments: record.context.assessments,
    decisions: record.context.decisions,
    consequences: record.context.consequences,
    activeConsequences: getActiveConsequences(record.context.consequences),
    lastDecisionRef: record.context.lastDecisionRef ?? null,
    lastEvidenceHash: record.context.lastEvidenceHash ?? null,
    demoSignals: listDemoSignals(),
  };
}

function defaultInitialState(subIdentity: SubIdentity) {
  switch (subIdentity.type) {
    case SubIdentityType.ANONYMOUS_LOWRISK:
      return IdentityState.OBSERVED;
    default:
      return IdentityState.NORMAL;
  }
}

async function syncIdentityState(
  identityId: Hex,
  nextState: IdentityState,
  decisionRef?: string,
  evidenceHash?: Hex,
) {
  if (issuerConfig.stateRegistryAddress === ZERO_ADDRESS) {
    return;
  }

  try {
    const hash = await walletClient.writeContract({
      chain: undefined,
      address: issuerConfig.stateRegistryAddress,
      abi: [
        {
          type: "function",
          name: "setStateWithAnchors",
          stateMutability: "nonpayable",
          inputs: [
            { name: "identityId", type: "bytes32" },
            { name: "nextState", type: "uint8" },
            { name: "reasonCode", type: "bytes32" },
            { name: "version", type: "uint256" },
            { name: "decisionRef", type: "bytes32" },
            { name: "evidenceHash", type: "bytes32" },
          ],
          outputs: [],
        },
        {
          type: "function",
          name: "setState",
          stateMutability: "nonpayable",
          inputs: [
            { name: "identityId", type: "bytes32" },
            { name: "nextState", type: "uint8" },
            { name: "reasonCode", type: "bytes32" },
            { name: "version", type: "uint256" },
          ],
          outputs: [],
        },
      ],
      functionName: "setStateWithAnchors",
      args: [
        identityId,
        nextState,
        keccak256(stringToHex("demo-control-plane")),
        1n,
        toBytes32(decisionRef),
        evidenceHash ?? toBytes32(""),
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  } catch {
    try {
      const hash = await walletClient.writeContract({
        chain: undefined,
        address: issuerConfig.stateRegistryAddress,
        abi: [
          {
            type: "function",
            name: "setState",
            stateMutability: "nonpayable",
            inputs: [
              { name: "identityId", type: "bytes32" },
              { name: "nextState", type: "uint8" },
              { name: "reasonCode", type: "bytes32" },
              { name: "version", type: "uint256" },
            ],
            outputs: [],
          },
        ],
        functionName: "setState",
        args: [identityId, nextState, keccak256(stringToHex("demo-control-plane")), 1n],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch {
      // Best-effort sync for the local demo.
    }
  }
}

function toBytes32(value: string | undefined) {
  if (!value) {
    return `0x${"0".repeat(64)}` as Hex;
  }

  const normalized = value.startsWith("0x") && value.length === 66 ? value : keccak256(stringToHex(value));
  return normalized as Hex;
}
