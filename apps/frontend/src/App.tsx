import { startTransition, useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, usePublicClient, useSignMessage, useSignTypedData, useWriteContract } from "wagmi";
import {
  applyDemoSignal,
  applyAnalyzerManualListAction,
  applyAnalyzerManualRelease,
  buildAirdropClaimRequestHash,
  buildCommunityPostRequestHash,
  buildEnterpriseAuditRequestHash,
  buildEnterprisePaymentRequestHash,
  buildGovernanceVoteRequestHash,
  buildHolderAuthorizationPayload,
  buildRwaRequestHash,
  confirmAnalyzerReview,
  createAnalyzerBindingChallenge,
  dismissAnalyzerReview,
  enterpriseTreasuryGateAbi,
  evaluatePolicyPreflight,
  evaluateAccessPolicy,
  evaluateWarningPolicy,
  getAnalyzerWatchStatus,
  getIdentityCapabilities,
  getAnalyzerRiskContext,
  getIdentityContext,
  getIdentityState,
  getPolicyDefinition,
  issuePhase2Credential,
  manageAnalyzerWatch,
  mockRwaAssetAbi,
  policyIds,
  registerIdentityTree,
  registerAnalyzerIdentityTree,
  resolveEffectiveMode,
  rwaGateAbi,
  socialGovernanceGateAbi,
  submitAnalyzerBinding,
  supportsPolicy,
  verifyAccess,
  type AccessPayload,
  type PolicyPreflightResult,
} from "@web3id/sdk";
import { computeSubjectBinding, holderAuthorizationTypes, type CredentialBundle, type HolderAuthorizationPayload } from "@web3id/credential";
import { buildSignInMessage, createSameRootProof, createSubIdentityLinkProof, deriveRootIdentity, listDefaultSubIdentities, SubIdentityType } from "@web3id/identity";
import { IdentityState } from "@web3id/state";
import { pad, stringToHex } from "viem";

type Scenario = "rwa" | "enterprise" | "social";
type EnterpriseAction = "payment" | "audit";
type SocialAction = "vote" | "airdrop" | "post";
type IdentityContextResponse = Awaited<ReturnType<typeof getIdentityContext>>;
type RiskContextResponse = Awaited<ReturnType<typeof getAnalyzerRiskContext>>;
type ProofWorkerResponse =
  | { ok: true; result: { proofPoints: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]; publicSignals: [bigint] } }
  | { ok: false; error: string };

const ISSUER_API_URL = import.meta.env.VITE_ISSUER_API_URL ?? "http://127.0.0.1:4100";
const ANALYZER_API_URL = import.meta.env.VITE_ANALYZER_API_URL ?? "http://127.0.0.1:4200";
const POLICY_API_URL = import.meta.env.VITE_POLICY_API_URL ?? "http://127.0.0.1:4300";
const DEFAULT_RWA_GATE = (import.meta.env.VITE_RWA_GATE_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const DEFAULT_ENTERPRISE_GATE = (import.meta.env.VITE_ENTERPRISE_GATE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const DEFAULT_SOCIAL_GATE = (import.meta.env.VITE_SOCIAL_GATE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const DEFAULT_ASSET = (import.meta.env.VITE_MOCK_RWA_ASSET_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const DEFAULT_VERIFIER = (import.meta.env.VITE_COMPLIANCE_VERIFIER_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const DEFAULT_STATE_REGISTRY = (import.meta.env.VITE_STATE_REGISTRY_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function textToBytes32(value: string) {
  return pad(stringToHex(value.slice(0, 31) || "ref"), { size: 32 });
}

function stateLabel(state: number | undefined) {
  if (state === undefined) {
    return "INIT";
  }

  return IdentityState[state] ?? "INIT";
}

function buildSameRootAuthorizationMessage(input: {
  challengeHash: `0x${string}`;
  candidateAddress: `0x${string}`;
  rootIdentityId: `0x${string}`;
  authorizerAddress: `0x${string}`;
}) {
  return [
    "Web3ID Same Root Authorization",
    `challengeHash: ${input.challengeHash}`,
    `candidateAddress: ${input.candidateAddress}`,
    `rootIdentityId: ${input.rootIdentityId}`,
    `authorizerAddress: ${input.authorizerAddress}`,
  ].join("\n");
}

export function App() {
  const [nonce] = useState(() => crypto.randomUUID());
  const [scenario, setScenario] = useState<Scenario>("rwa");
  const [enterpriseAction, setEnterpriseAction] = useState<EnterpriseAction>("payment");
  const [socialAction, setSocialAction] = useState<SocialAction>("vote");
  const [identityReady, setIdentityReady] = useState(false);
  const [selectedSubIdentityId, setSelectedSubIdentityId] = useState<`0x${string}` | null>(null);
  const [bundles, setBundles] = useState<CredentialBundle[]>([]);
  const [payload, setPayload] = useState<AccessPayload | null>(null);
  const [status, setStatus] = useState("Idle");
  const [rwaAmount, setRwaAmount] = useState("1");
  const [paymentAmount, setPaymentAmount] = useState("50");
  const [beneficiary, setBeneficiary] = useState("0x00000000000000000000000000000000000000B0");
  const [paymentRef, setPaymentRef] = useState("payment-001");
  const [auditRef, setAuditRef] = useState("audit-001");
  const [proposalId, setProposalId] = useState("proposal-001");
  const [airdropRoundId, setAirdropRoundId] = useState("airdrop-round-001");
  const [postRef, setPostRef] = useState("community-post-001");
  const [rwaGateAddress, setRwaGateAddress] = useState(DEFAULT_RWA_GATE);
  const [enterpriseGateAddress, setEnterpriseGateAddress] = useState(DEFAULT_ENTERPRISE_GATE);
  const [socialGateAddress, setSocialGateAddress] = useState(DEFAULT_SOCIAL_GATE);
  const [assetAddress, setAssetAddress] = useState(DEFAULT_ASSET);
  const [verifierAddress] = useState(DEFAULT_VERIFIER);
  const [stateRegistryAddress] = useState(DEFAULT_STATE_REGISTRY);
  const [mintedBalance, setMintedBalance] = useState("0");
  const [identityState, setIdentityState] = useState<number>();
  const [policyPreflight, setPolicyPreflight] = useState<PolicyPreflightResult | null>(null);
  const [verifierPreflight, setVerifierPreflight] = useState<string>("Not checked");
  const [identityContext, setIdentityContext] = useState<IdentityContextResponse | null>(null);
  const [riskContext, setRiskContext] = useState<RiskContextResponse | null>(null);
  const [accessDecision, setAccessDecision] = useState<any>(null);
  const [warningDecision, setWarningDecision] = useState<any>(null);
  const [watchStatus, setWatchStatus] = useState<any>(null);
  const [phase3Actor, setPhase3Actor] = useState("risk-ops");
  const [reviewNote, setReviewNote] = useState("Reviewed by risk ops");
  const [reviewReasonCode, setReviewReasonCode] = useState("AI_CONFIRMED_SIGNAL");
  const [reviewRequestedState, setReviewRequestedState] = useState<number>(IdentityState.RESTRICTED);
  const [manualReleaseReasonCode, setManualReleaseReasonCode] = useState("MANUAL_RELEASE_REVIEWED");
  const [manualReleaseEvidence, setManualReleaseEvidence] = useState("manual:review:frontend");
  const [manualReleaseNote, setManualReleaseNote] = useState("Manual release approved after review.");
  const [manualListName, setManualListName] = useState<"watchlist" | "restricted_list" | "blacklist_or_frozen_list">("watchlist");
  const [manualListAction, setManualListAction] = useState<"add" | "remove">("add");
  const [manualListReasonCode, setManualListReasonCode] = useState("MANUAL_LIST_OVERRIDE");
  const [manualListEvidence, setManualListEvidence] = useState("manual:list:frontend");
  const [manualListExpiresAt, setManualListExpiresAt] = useState("");
  const [watchRecentBlocks, setWatchRecentBlocks] = useState("16");
  const [watchPollIntervalMs, setWatchPollIntervalMs] = useState("15000");
  const [watchScope, setWatchScope] = useState<"identity" | "root">("identity");

  const { address, chainId } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, isPending: isSubmitting } = useWriteContract();
  const publicClient = usePublicClient();

  const rootIdentity = useMemo(() => (address ? deriveRootIdentity(address, chainId ?? 31337) : null), [address, chainId]);
  const subIdentities = useMemo(() => {
    if (!rootIdentity) {
      return [];
    }
    return listDefaultSubIdentities(rootIdentity);
  }, [rootIdentity]);

  const selectedSubIdentity = useMemo(
    () => subIdentities.find((item) => item.identityId === selectedSubIdentityId) ?? null,
    [selectedSubIdentityId, subIdentities],
  );

  const activePolicyId = useMemo(() => {
    if (scenario === "rwa") {
      return policyIds.RWA_BUY_V2;
    }
    if (scenario === "enterprise") {
      return enterpriseAction === "payment" ? policyIds.ENTITY_PAYMENT_V1 : policyIds.ENTITY_AUDIT_V1;
    }
    if (socialAction === "airdrop") {
      return policyIds.AIRDROP_ELIGIBILITY_V1;
    }
    if (socialAction === "post") {
      return policyIds.COMMUNITY_POST_V1;
    }
    return policyIds.GOV_VOTE_V1;
  }, [enterpriseAction, scenario, socialAction]);

  const currentBundles = scenario === "social" ? [] : bundles;
  const capabilities = useMemo(
    () => (selectedSubIdentity ? getIdentityCapabilities(selectedSubIdentity, currentBundles) : null),
    [currentBundles, selectedSubIdentity],
  );
  const policySupport = useMemo(
    () => (selectedSubIdentity ? supportsPolicy(selectedSubIdentity, activePolicyId, currentBundles) : null),
    [activePolicyId, currentBundles, selectedSubIdentity],
  );
  const effectiveMode = useMemo(
    () => (selectedSubIdentity ? resolveEffectiveMode(selectedSubIdentity, activePolicyId, currentBundles) : null),
    [activePolicyId, currentBundles, selectedSubIdentity],
  );
  const activePolicy = useMemo(() => getPolicyDefinition(activePolicyId), [activePolicyId]);

  useEffect(() => {
    if (!subIdentities.length) {
      return;
    }

    const preferredType =
      scenario === "rwa"
        ? SubIdentityType.RWA_INVEST
        : scenario === "enterprise"
          ? SubIdentityType.PAYMENTS
          : SubIdentityType.SOCIAL;
    const preferred = subIdentities.find((item) => item.type === preferredType) ?? subIdentities[0];
    setSelectedSubIdentityId(preferred.identityId);
    setBundles([]);
    setPayload(null);
    setPolicyPreflight(null);
    setVerifierPreflight("Not checked");
    setRiskContext(null);
    setAccessDecision(null);
    setWarningDecision(null);
    setWatchStatus(null);
  }, [scenario, subIdentities]);

  useEffect(() => {
    if (!selectedSubIdentity || !publicClient || !stateRegistryAddress || stateRegistryAddress === ZERO_ADDRESS) {
      return;
    }

    let cancelled = false;

    const syncState = async () => {
      try {
        const state = await getIdentityState(publicClient, stateRegistryAddress, selectedSubIdentity.identityId);
        if (!cancelled) {
          setIdentityState(state);
        }
      } catch {
        if (!cancelled) {
          setIdentityState(undefined);
        }
      }
    };

    void syncState();
    const timer = window.setInterval(() => {
      void syncState();
    }, 3_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [publicClient, selectedSubIdentity, stateRegistryAddress, status]);

  useEffect(() => {
    if (!assetAddress || !address || !publicClient) {
      return;
    }

    publicClient
      .readContract({
        abi: mockRwaAssetAbi,
        address: assetAddress,
        functionName: "balanceOf",
        args: [address],
      })
      .then((balance) => setMintedBalance(balance.toString()))
      .catch(() => setMintedBalance("0"));
  }, [address, assetAddress, publicClient, status]);

  useEffect(() => {
    if (!identityReady || !selectedSubIdentity) {
      return;
    }
    void refreshIdentityContext(selectedSubIdentity.identityId);
    void refreshRiskContext(selectedSubIdentity.identityId);
  }, [identityReady, selectedSubIdentity, status]);

  async function refreshIdentityContext(identityId: `0x${string}`) {
    try {
      const next = await getIdentityContext(ISSUER_API_URL, identityId);
      setIdentityContext(next);
    } catch {
      setIdentityContext(null);
    }
  }

  async function reevaluateAccessDecision(identityId: `0x${string}`, nextPayload: AccessPayload | null = payload) {
    if (!nextPayload) {
      setAccessDecision(null);
      return;
    }
    try {
      const policyDecision = await evaluateAccessPolicy(POLICY_API_URL, {
        identityId,
        policyId: activePolicyId,
        policyVersion: activePolicy.policyVersion,
        payload: nextPayload,
        credentialBundles: currentBundles,
        verifierAddress,
      });
      setAccessDecision(policyDecision);
    } catch {
      setAccessDecision(null);
    }
  }

  async function refreshRiskContext(identityId: `0x${string}`) {
    const [riskResult, watchResult, warningResult] = await Promise.allSettled([
      getAnalyzerRiskContext(ANALYZER_API_URL, identityId),
      getAnalyzerWatchStatus(ANALYZER_API_URL, { identityId }),
      evaluateWarningPolicy(POLICY_API_URL, {
        identityId,
        policyId: "COUNTERPARTY_WARNING_V1",
        policyVersion: activePolicy.policyVersion,
      }),
    ]);

    setRiskContext(riskResult.status === "fulfilled" ? riskResult.value : null);
    setWatchStatus(watchResult.status === "fulfilled" ? watchResult.value : null);
    setWarningDecision(warningResult.status === "fulfilled" ? warningResult.value : null);
  }

  async function refreshPhase3State(identityId: `0x${string}`, nextPayload: AccessPayload | null = payload) {
    await refreshRiskContext(identityId);
    await reevaluateAccessDecision(identityId, nextPayload);
  }

  async function handleDeriveIdentity() {
    if (!address || !rootIdentity) {
      return;
    }

    setStatus("Signing wallet challenge...");
    await signMessageAsync({
      message: buildSignInMessage(address, nonce, chainId ?? 31337),
    });
    await registerIdentityTree(ISSUER_API_URL, {
      rootIdentity,
      subIdentities,
    });
    await registerAnalyzerIdentityTree(ANALYZER_API_URL, {
      rootIdentity,
      subIdentities,
    });
    setIdentityReady(true);
    if (selectedSubIdentity) {
      await refreshIdentityContext(selectedSubIdentity.identityId);
      await refreshPhase3State(selectedSubIdentity.identityId, null);
    }
    setStatus("Identity tree ready.");
  }

  async function handleBindRootController() {
    if (!rootIdentity || !address) {
      return;
    }
    setStatus("Creating root-controller binding challenge...");
    const challenge = await createAnalyzerBindingChallenge(ANALYZER_API_URL, {
      bindingType: "root_controller",
      candidateAddress: address,
      rootIdentityId: rootIdentity.identityId,
    });
    const candidateSignature = await signMessageAsync({ message: challenge.challengeMessage });
    await submitAnalyzerBinding(ANALYZER_API_URL, {
      challengeId: challenge.challengeId,
      candidateSignature,
      metadata: { source: "frontend-root-controller" },
    });
    await refreshPhase3State(selectedSubIdentity?.identityId ?? rootIdentity.identityId, payload);
    setStatus("Root-controller binding recorded.");
  }

  async function handleBindSelectedSubIdentity() {
    if (!rootIdentity || !selectedSubIdentity || !address) {
      return;
    }
    setStatus("Creating sub-identity binding challenge...");
    const challenge = await createAnalyzerBindingChallenge(ANALYZER_API_URL, {
      bindingType: "sub_identity_link",
      candidateAddress: address,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: selectedSubIdentity.identityId,
    });
    const candidateSignature = await signMessageAsync({ message: challenge.challengeMessage });
    await submitAnalyzerBinding(ANALYZER_API_URL, {
      challengeId: challenge.challengeId,
      candidateSignature,
      linkProof: createSubIdentityLinkProof(rootIdentity, selectedSubIdentity),
      metadata: { source: "frontend-sub-identity-link" },
    });
    await refreshPhase3State(selectedSubIdentity.identityId, payload);
    setStatus("Sub-identity binding recorded.");
  }

  async function handleBindSameRootExtension() {
    if (!rootIdentity || !address || subIdentities.length < 2) {
      return;
    }
    setStatus("Creating same-root extension challenge...");
    const challenge = await createAnalyzerBindingChallenge(ANALYZER_API_URL, {
      bindingType: "same_root_extension",
      candidateAddress: address,
      rootIdentityId: rootIdentity.identityId,
    });
    const candidateSignature = await signMessageAsync({ message: challenge.challengeMessage });
    const sameRootProof = createSameRootProof(rootIdentity, subIdentities.slice(0, 2));
    const authorizerSignature = await signMessageAsync({
      message: buildSameRootAuthorizationMessage({
        challengeHash: challenge.challengeHash,
        candidateAddress: address,
        rootIdentityId: rootIdentity.identityId,
        authorizerAddress: address,
      }),
    });
    await submitAnalyzerBinding(ANALYZER_API_URL, {
      challengeId: challenge.challengeId,
      candidateSignature,
      sameRootProof,
      authorizerAddress: address,
      authorizerSignature,
      metadata: { source: "frontend-same-root-extension" },
    });
    await refreshPhase3State(selectedSubIdentity?.identityId ?? rootIdentity.identityId, payload);
    setStatus("Same-root extension binding recorded.");
  }

  async function handleIssueCredentials() {
    if (scenario === "social") {
      setStatus("Social default mode does not require a credential.");
      return;
    }

    if (!address || !rootIdentity || !selectedSubIdentity) {
      return;
    }

    setStatus("Issuing scenario credential...");
    const next =
      scenario === "rwa"
        ? await issuePhase2Credential(ISSUER_API_URL, {
            holder: rootIdentity.didLikeId,
            holderIdentityId: selectedSubIdentity.identityId,
            subjectAddress: address,
            credentialKind: "kycAml",
            claimSet: {
              amlPassed: true,
              nonUSResident: true,
              accreditedInvestor: true,
            },
            policyHints: [policyIds.RWA_BUY_V2],
          })
        : await issuePhase2Credential(ISSUER_API_URL, {
            holder: rootIdentity.didLikeId,
            holderIdentityId: selectedSubIdentity.identityId,
            subjectAddress: address,
            credentialKind: "entity",
            claimSet: {
              entityName: "Acme Treasury",
              role: "treasurer",
              auditReady: true,
            },
            policyHints: [policyIds.ENTITY_PAYMENT_V1, policyIds.ENTITY_AUDIT_V1],
          });

    const issuedBundles = [next.bundle as CredentialBundle];
    setBundles(issuedBundles);
    setPayload(null);
    setPolicyPreflight(null);
    setVerifierPreflight("Not checked");
    setStatus("Credential issued.");
  }

  async function handleBuildPayload() {
    if (!address || !selectedSubIdentity) {
      return;
    }
    if (scenario !== "social" && currentBundles.length === 0) {
      setStatus("Issue a credential before building a compliance payload.");
      return;
    }

    const gateAddress =
      scenario === "rwa" ? rwaGateAddress : scenario === "enterprise" ? enterpriseGateAddress : socialGateAddress;
    const requestHash =
      scenario === "rwa"
        ? buildRwaRequestHash(gateAddress, BigInt(rwaAmount))
        : scenario === "enterprise"
          ? enterpriseAction === "payment"
            ? buildEnterprisePaymentRequestHash(gateAddress, beneficiary as `0x${string}`, BigInt(paymentAmount), textToBytes32(paymentRef))
            : buildEnterpriseAuditRequestHash(gateAddress, textToBytes32(auditRef))
          : socialAction === "vote"
            ? buildGovernanceVoteRequestHash(gateAddress, textToBytes32(proposalId))
            : socialAction === "airdrop"
              ? buildAirdropClaimRequestHash(gateAddress, textToBytes32(airdropRoundId))
              : buildCommunityPostRequestHash(gateAddress, textToBytes32(postRef));

    const holderPayload: HolderAuthorizationPayload = {
      identityId: selectedSubIdentity.identityId,
      subjectBinding:
        (currentBundles[0]?.attestation.subjectBinding as `0x${string}` | undefined) ?? (computeSubjectBinding(address) as `0x${string}`),
      policyId: activePolicyId,
      requestHash,
      chainId: chainId ?? 31337,
      nonce: 1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 15 * 60),
    };

    setStatus("Signing holder authorization...");
    const signature = await signTypedDataAsync({
      domain: {
        name:
          scenario === "rwa"
            ? "Web3ID RWAGate"
            : scenario === "enterprise"
              ? "Web3ID Enterprise Treasury"
              : "Web3ID Social Governance",
        version: "2",
        chainId: holderPayload.chainId,
        verifyingContract: gateAddress,
      },
      types: holderAuthorizationTypes,
      primaryType: "HolderAuthorization",
      message: holderPayload as any,
    });

    setStatus("Generating holder-binding proof...");
    const worker = new Worker(new URL("./proofWorker.ts", import.meta.url), { type: "module" });
    const response = await new Promise<ProofWorkerResponse>((resolve) => {
      worker.onmessage = (event) => resolve(event.data as ProofWorkerResponse);
      worker.postMessage({ bundle: currentBundles[0] ?? null, subjectAddress: address });
    });
    worker.terminate();

    if (!response.ok) {
      throw new Error(response.error);
    }

    const nextPayload: AccessPayload = {
      identityId: selectedSubIdentity.identityId,
      credentialAttestations: currentBundles.map((bundle) => bundle.attestation),
      zkProof: {
        proofPoints: response.result.proofPoints,
        publicSignals: response.result.publicSignals,
      },
      policyVersion: activePolicy.policyVersion,
      holderAuthorization: buildHolderAuthorizationPayload(
        holderPayload,
        signature,
      ),
    };

    startTransition(() => {
      setPayload(nextPayload);
      setStatus("Access payload ready.");
    });

    let latestIdentityContext = identityContext;
    if (selectedSubIdentity) {
      try {
        latestIdentityContext = await getIdentityContext(ISSUER_API_URL, selectedSubIdentity.identityId);
        setIdentityContext(latestIdentityContext);
      } catch {
        latestIdentityContext = identityContext;
      }
    }

    setPolicyPreflight(
      evaluatePolicyPreflight({
        identityContext: latestIdentityContext,
        policyId: activePolicy,
        effectiveMode,
        payload: nextPayload,
      }),
    );

    if (publicClient && verifierAddress !== ZERO_ADDRESS) {
      try {
        const result = await verifyAccess(publicClient, verifierAddress, activePolicyId, nextPayload);
        setVerifierPreflight(`Allowed by on-chain verifier: ${String(result)}`);
      } catch (error) {
        setVerifierPreflight(
          `Denied by on-chain verifier: ${error instanceof Error ? error.message : "Verifier preflight failed"}`,
        );
      }
    } else {
      setVerifierPreflight("Not checked");
    }

    try {
      const policyDecision = await evaluateAccessPolicy(POLICY_API_URL, {
        identityId: selectedSubIdentity.identityId,
        policyId: activePolicyId,
        policyVersion: activePolicy.policyVersion,
        payload: nextPayload,
        credentialBundles: currentBundles,
        verifierAddress,
      });
      setAccessDecision(policyDecision);
    } catch {
      setAccessDecision(null);
    }
  }

  async function handleSubmitRwa() {
    if (!payload) {
      return;
    }

    setStatus("Submitting RWA access transaction...");
    await writeContractAsync({
      abi: rwaGateAbi,
      address: rwaGateAddress,
      functionName: "buyRwa",
      args: [payload as any, BigInt(rwaAmount)],
    });
    setStatus("RWA transaction submitted.");
  }

  async function handleSubmitEnterprisePayment() {
    if (!payload) {
      return;
    }

    setStatus("Submitting enterprise payment...");
    await writeContractAsync({
      abi: enterpriseTreasuryGateAbi,
      address: enterpriseGateAddress,
      functionName: "submitPayment",
      args: [payload as any, beneficiary as `0x${string}`, BigInt(paymentAmount), textToBytes32(paymentRef)],
    });
    setStatus("Enterprise payment submitted.");
  }

  async function handleExportAudit() {
    if (!payload) {
      return;
    }

    setStatus("Submitting audit export...");
    await writeContractAsync({
      abi: enterpriseTreasuryGateAbi,
      address: enterpriseGateAddress,
      functionName: "exportAuditRecord",
      args: [payload as any, textToBytes32(auditRef)],
    });
    setStatus("Audit export submitted.");
  }

  async function handleSubmitSocialAction() {
    if (!payload) {
      return;
    }

    setStatus("Submitting social governance action...");
    if (socialAction === "vote") {
      await writeContractAsync({
        abi: socialGovernanceGateAbi,
        address: socialGateAddress,
        functionName: "vote",
        args: [payload as any, textToBytes32(proposalId)],
      });
    } else if (socialAction === "airdrop") {
      await writeContractAsync({
        abi: socialGovernanceGateAbi,
        address: socialGateAddress,
        functionName: "claimAirdrop",
        args: [payload as any, textToBytes32(airdropRoundId)],
      });
    } else {
      await writeContractAsync({
        abi: socialGovernanceGateAbi,
        address: socialGateAddress,
        functionName: "createPost",
        args: [payload as any, textToBytes32(postRef)],
      });
    }
    setStatus("Social governance action submitted.");
  }

  async function handleApplySignal(signalKey: Parameters<typeof applyDemoSignal>[1]["signalKey"]) {
    if (!selectedSubIdentity) {
      return;
    }

    setStatus(`Applying signal: ${signalKey}`);
    await applyDemoSignal(ISSUER_API_URL, {
      identityId: selectedSubIdentity.identityId,
      signalKey,
    });
    await refreshIdentityContext(selectedSubIdentity.identityId);
    await refreshPhase3State(selectedSubIdentity.identityId, payload);
    setPolicyPreflight(null);
    setVerifierPreflight("Not checked");
    setStatus(`Signal applied: ${signalKey}`);
  }

  async function handleConfirmReview(reviewItemId: string) {
    if (!selectedSubIdentity) {
      return;
    }
    setStatus(`Confirming review item ${reviewItemId.slice(0, 10)}...`);
    await confirmAnalyzerReview(ANALYZER_API_URL, {
      reviewItemId,
      actor: phase3Actor,
      requestedState: reviewRequestedState as IdentityState,
      reasonCode: reviewReasonCode,
      note: reviewNote,
    });
    await refreshPhase3State(selectedSubIdentity.identityId, payload);
    setStatus("Review item confirmed.");
  }

  async function handleDismissReview(reviewItemId: string) {
    if (!selectedSubIdentity) {
      return;
    }
    setStatus(`Dismissing review item ${reviewItemId.slice(0, 10)}...`);
    await dismissAnalyzerReview(ANALYZER_API_URL, {
      reviewItemId,
      actor: phase3Actor,
      reason: reviewNote,
    });
    await refreshPhase3State(selectedSubIdentity.identityId, payload);
    setStatus("Review item dismissed.");
  }

  async function handleManualRelease() {
    if (!selectedSubIdentity) {
      return;
    }
    setStatus("Applying manual release...");
    await applyAnalyzerManualRelease(ANALYZER_API_URL, {
      identityId: selectedSubIdentity.identityId,
      actor: phase3Actor,
      reasonCode: manualReleaseReasonCode,
      evidenceRefs: manualReleaseEvidence.split(",").map((value) => value.trim()).filter(Boolean),
      note: manualReleaseNote,
    });
    await refreshPhase3State(selectedSubIdentity.identityId, payload);
    setStatus("Manual release applied.");
  }

  async function handleManualListUpdate() {
    if (!selectedSubIdentity || !rootIdentity) {
      return;
    }
    setStatus("Applying manual list override...");
    await applyAnalyzerManualListAction(ANALYZER_API_URL, {
      identityId: selectedSubIdentity.identityId,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: selectedSubIdentity.identityId,
      listName: manualListName,
      action: manualListAction,
      actor: phase3Actor,
      reasonCode: manualListReasonCode,
      evidenceRefs: manualListEvidence.split(",").map((value) => value.trim()).filter(Boolean),
      expiresAt: manualListExpiresAt || undefined,
    });
    await refreshPhase3State(selectedSubIdentity.identityId, payload);
    setStatus("Manual list override applied.");
  }

  async function handleWatch(action: "refresh" | "start" | "stop") {
    if (!rootIdentity) {
      return;
    }
    const identityId = watchScope === "identity" ? selectedSubIdentity?.identityId : undefined;
    setStatus(`${action === "refresh" ? "Refreshing" : action === "start" ? "Starting" : "Stopping"} watcher...`);
    await manageAnalyzerWatch(ANALYZER_API_URL, {
      action,
      rootIdentityId: rootIdentity.identityId,
      identityId,
      recentBlocks: Number(watchRecentBlocks),
      pollIntervalMs: Number(watchPollIntervalMs),
    });
    if (selectedSubIdentity) {
      await refreshPhase3State(selectedSubIdentity.identityId, payload);
    }
    setStatus(`Watcher ${action} completed.`);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Web3ID Phase2+</p>
          <h1>Identity, state, consequence, and access control on one console.</h1>
          <p className="lede">
            Capability-first identities, explicit default versus compliance policy paths, state attribution, lightweight
            consequence handling, and three demos: RWA, enterprise treasury, and social governance.
          </p>
        </div>
        <div className="hero-card">
          <p>Current scenario</p>
          <strong>
            {scenario === "rwa" ? "RWA Access" : scenario === "enterprise" ? "Enterprise Treasury" : "Social Governance"}
          </strong>
          <span>{selectedSubIdentity ? `${selectedSubIdentity.scope} / ${selectedSubIdentity.type}` : "Select identity"}</span>
          <span>Preferred mode: {capabilities?.preferredMode ?? "N/A"}</span>
          <span>Effective mode: {effectiveMode ?? "Unsupported"}</span>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>1. Wallet & Root Identity</h2>
          <p>{address ?? "Not connected"}</p>
          <div className="actions">
            <button disabled={isConnecting || connectors.length === 0} onClick={() => connect({ connector: connectors[0] })}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
            <button disabled={!address} onClick={handleDeriveIdentity}>
              Sign Identity Challenge
            </button>
          </div>
          {rootIdentity ? <pre>{JSON.stringify(rootIdentity, null, 2)}</pre> : <p>Connect and sign to derive the tree.</p>}
        </article>

        <article className="panel">
          <h2>2. Scenario & Sub Identity</h2>
          <div className="segmented">
            <button className={scenario === "rwa" ? "active" : ""} onClick={() => setScenario("rwa")}>
              RWA Access
            </button>
            <button className={scenario === "enterprise" ? "active" : ""} onClick={() => setScenario("enterprise")}>
              Enterprise Treasury
            </button>
            <button className={scenario === "social" ? "active" : ""} onClick={() => setScenario("social")}>
              Social Governance
            </button>
          </div>
          {scenario === "enterprise" ? (
            <div className="segmented compact">
              <button className={enterpriseAction === "payment" ? "active" : ""} onClick={() => setEnterpriseAction("payment")}>
                Payment
              </button>
              <button className={enterpriseAction === "audit" ? "active" : ""} onClick={() => setEnterpriseAction("audit")}>
                Audit
              </button>
            </div>
          ) : null}
          {scenario === "social" ? (
            <div className="segmented compact">
              <button className={socialAction === "vote" ? "active" : ""} onClick={() => setSocialAction("vote")}>
                Vote
              </button>
              <button className={socialAction === "airdrop" ? "active" : ""} onClick={() => setSocialAction("airdrop")}>
                Airdrop
              </button>
              <button className={socialAction === "post" ? "active" : ""} onClick={() => setSocialAction("post")}>
                Post
              </button>
            </div>
          ) : null}
          <select value={selectedSubIdentityId ?? ""} onChange={(event) => setSelectedSubIdentityId(event.target.value as `0x${string}`)}>
            {subIdentities.map((item) => (
              <option key={item.identityId} value={item.identityId}>
                {item.scope} / {item.type}
              </option>
            ))}
          </select>
          {selectedSubIdentity ? <pre>{JSON.stringify(selectedSubIdentity, null, 2)}</pre> : <p>No sub identity selected.</p>}
        </article>

        <article className="panel">
          <h2>3. Mode & Policy</h2>
          <div className="stack">
            <p className="badge">State: {stateLabel(identityState ?? identityContext?.currentState)}</p>
            <p className="badge">Preferred: {capabilities?.preferredMode ?? "N/A"}</p>
            <p className="badge">Effective: {effectiveMode ?? "Unavailable"}</p>
          </div>
          <div className="meta-grid">
            <div>
              <strong>Policy</strong>
              <p>{activePolicy.targetAction}</p>
            </div>
            <div>
              <strong>Allowed Modes</strong>
              <p>{activePolicy.allowedModes.join(", ")}</p>
            </div>
            <div>
              <strong>Proof Kind</strong>
              <p>{activePolicy.proofTemplate}</p>
            </div>
            <div>
              <strong>Policy Support</strong>
              <p>{policySupport?.supported ? "Supported" : policySupport?.reason ?? "Unknown"}</p>
            </div>
          </div>
          <p>Policy preflight: {policyPreflight?.reason ?? "Not checked"}</p>
          <p>Verifier preflight: {verifierPreflight}</p>
          <p>Minted RWA balance: {mintedBalance}</p>
        </article>

        <article className="panel">
          <h2>4. Credentials</h2>
          <button disabled={!selectedSubIdentity || !address || !identityReady} onClick={handleIssueCredentials}>
            {scenario === "social" ? "Default Mode Uses No Credential" : "Issue Scenario Credential"}
          </button>
          {scenario === "social" ? (
            <p className="hint">Social Governance stays in default mode and only uses deterministic mock/local signals.</p>
          ) : bundles.length > 0 ? (
            <pre>{JSON.stringify(bundles, null, 2)}</pre>
          ) : (
            <p>
              {scenario === "rwa"
                ? "Issues KYC/AML credential bound to the selected identity."
                : "Issues an entity credential for treasury access."}
            </p>
          )}
        </article>

        <article className="panel">
          <h2>5. Proof & Payload</h2>
          <button disabled={!identityReady || !selectedSubIdentity} onClick={handleBuildPayload}>
            Build Access Payload
          </button>
          {payload ? (
            <pre>{JSON.stringify(payload, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2)}</pre>
          ) : (
            <p>
              {scenario === "social"
                ? "Generate a holder-bound payload with no VC attachment."
                : "Generate a credential-bound holder authorization and holder-binding proof."}
            </p>
          )}
        </article>

        <article className="panel">
          <h2>6. Actions</h2>
          {scenario === "rwa" ? (
            <>
              <label>
                RWA Gate Address
                <input value={rwaGateAddress} onChange={(event) => setRwaGateAddress(event.target.value as `0x${string}`)} />
              </label>
              <label>
                Asset Address
                <input value={assetAddress} onChange={(event) => setAssetAddress(event.target.value as `0x${string}`)} />
              </label>
              <label>
                Amount
                <input value={rwaAmount} onChange={(event) => setRwaAmount(event.target.value)} />
              </label>
              <button disabled={!payload || isSubmitting} onClick={handleSubmitRwa}>
                {isSubmitting ? "Submitting..." : "Submit buyRwa"}
              </button>
            </>
          ) : scenario === "enterprise" ? (
            enterpriseAction === "payment" ? (
              <>
                <label>
                  Enterprise Gate Address
                  <input value={enterpriseGateAddress} onChange={(event) => setEnterpriseGateAddress(event.target.value as `0x${string}`)} />
                </label>
                <label>
                  Beneficiary
                  <input value={beneficiary} onChange={(event) => setBeneficiary(event.target.value)} />
                </label>
                <label>
                  Amount
                  <input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
                </label>
                <label>
                  Payment Ref
                  <input value={paymentRef} onChange={(event) => setPaymentRef(event.target.value)} />
                </label>
                <button disabled={!payload || isSubmitting} onClick={handleSubmitEnterprisePayment}>
                  {isSubmitting ? "Submitting..." : "Submit Payment"}
                </button>
              </>
            ) : (
              <>
                <label>
                  Enterprise Gate Address
                  <input value={enterpriseGateAddress} onChange={(event) => setEnterpriseGateAddress(event.target.value as `0x${string}`)} />
                </label>
                <label>
                  Audit Ref
                  <input value={auditRef} onChange={(event) => setAuditRef(event.target.value)} />
                </label>
                <button disabled={!payload || isSubmitting} onClick={handleExportAudit}>
                  {isSubmitting ? "Submitting..." : "Export Audit Record"}
                </button>
              </>
            )
          ) : (
            <>
              <label>
                Social Gate Address
                <input value={socialGateAddress} onChange={(event) => setSocialGateAddress(event.target.value as `0x${string}`)} />
              </label>
              {socialAction === "vote" ? (
                <label>
                  Proposal Id
                  <input value={proposalId} onChange={(event) => setProposalId(event.target.value)} />
                </label>
              ) : socialAction === "airdrop" ? (
                <label>
                  Round Id
                  <input value={airdropRoundId} onChange={(event) => setAirdropRoundId(event.target.value)} />
                </label>
              ) : (
                <label>
                  Post Ref
                  <input value={postRef} onChange={(event) => setPostRef(event.target.value)} />
                </label>
              )}
              <button disabled={!payload || isSubmitting} onClick={handleSubmitSocialAction}>
                {isSubmitting
                  ? "Submitting..."
                  : socialAction === "vote"
                    ? "Submit Vote"
                    : socialAction === "airdrop"
                      ? "Submit Claim Airdrop"
                      : "Submit Create Post"}
              </button>
            </>
          )}
        </article>

        <article className="panel">
          <h2>7. Demo Signals</h2>
          <p className="hint">Deterministic local/mock signals only. No external indexer or third-party risk feed is used in this phase.</p>
          <div className="actions">
            <button disabled={!selectedSubIdentity} onClick={() => void handleApplySignal("new_wallet_observation")}>
              Observe New Wallet
            </button>
            <button disabled={!selectedSubIdentity} onClick={() => void handleApplySignal("negative_risk_flag")}>
              Apply Risk Flag
            </button>
            <button disabled={!selectedSubIdentity} onClick={() => void handleApplySignal("sanction_hit")}>
              Freeze
            </button>
            <button disabled={!selectedSubIdentity} onClick={() => void handleApplySignal("governance_participation")}>
              Governance Boost
            </button>
            <button disabled={!selectedSubIdentity} onClick={() => void handleApplySignal("good_standing")}>
              Recover to Normal
            </button>
          </div>
          <p>Signals are applied through the issuer-service demo control plane and synced to the on-chain state registry.</p>
        </article>

        <article className="panel">
          <h2>8. Attribution & Consequences</h2>
          {identityContext ? (
            <>
              <div className="meta-grid">
                <div>
                  <strong>Current State</strong>
                  <p>{stateLabel(identityContext.currentState)}</p>
                </div>
                <div>
                  <strong>Last Decision Ref</strong>
                  <p>{identityContext.lastDecisionRef ?? "None"}</p>
                </div>
                <div>
                  <strong>Active Consequences</strong>
                  <p>{identityContext.activeConsequences.length}</p>
                </div>
                <div>
                  <strong>Signals</strong>
                  <p>{identityContext.signals.length}</p>
                </div>
              </div>
              <div className="meta-grid">
                <div>
                  <strong>Latest Signal</strong>
                  <p>{identityContext.signals.at(-1)?.reasonCode ?? "None"}</p>
                </div>
                <div>
                  <strong>Latest Assessment</strong>
                  <p>{identityContext.assessments.at(-1)?.assessmentResult ?? "None"}</p>
                </div>
                <div>
                  <strong>Latest Decision</strong>
                  <p>{identityContext.decisions.at(-1)?.reasonCode ?? "None"}</p>
                </div>
                <div>
                  <strong>Recovery Rule</strong>
                  <p>{identityContext.activeConsequences[0]?.recoveryRuleId ?? "None"}</p>
                </div>
              </div>
              <pre>{JSON.stringify(identityContext, null, 2)}</pre>
            </>
          ) : (
            <p>Register the identity tree to see state history, consequences, and recovery requirements.</p>
          )}
        </article>

        <article className="panel">
          <h2>9. Phase3 Risk View</h2>
          {riskContext?.summary ? (
            <>
              <div className="meta-grid">
                <div>
                  <strong>Stored State</strong>
                  <p>{stateLabel(riskContext.summary.storedState)}</p>
                </div>
                <div>
                  <strong>Effective State</strong>
                  <p>{stateLabel(riskContext.summary.effectiveState)}</p>
                </div>
                <div>
                  <strong>Anchored State</strong>
                  <p>{stateLabel(riskContext.summary.anchoredState)}</p>
                </div>
                <div>
                  <strong>Risk Score</strong>
                  <p>{riskContext.summary.riskScore}</p>
                </div>
              </div>
              <div className="meta-grid">
                <div>
                  <strong>Bindings</strong>
                  <p>{riskContext.bindings.length}</p>
                </div>
                <div>
                  <strong>Review Queue</strong>
                  <p>{riskContext.summary.reviewQueueCounts?.pending ?? riskContext.reviewQueue.length}</p>
                </div>
                <div>
                  <strong>Anchors</strong>
                  <p>{riskContext.anchors.length}</p>
                </div>
                <div>
                  <strong>Watchers</strong>
                  <p>{watchStatus?.items?.length ?? riskContext.summary.watchStatus?.items?.length ?? 0}</p>
                </div>
              </div>
              <div className="meta-grid">
                <div>
                  <strong>Manual Release Floor</strong>
                  <p>{riskContext.summary.manualReleaseWindow?.floorState !== undefined ? stateLabel(riskContext.summary.manualReleaseWindow.floorState) : "None"}</p>
                </div>
                <div>
                  <strong>Floor Until</strong>
                  <p>{riskContext.summary.manualReleaseWindow?.floorUntil ?? "N/A"}</p>
                </div>
                <div>
                  <strong>Pending Reviews</strong>
                  <p>{riskContext.summary.reviewQueueCounts?.pending ?? 0}</p>
                </div>
                <div>
                  <strong>Expired Reviews</strong>
                  <p>{riskContext.summary.reviewQueueCounts?.expired ?? 0}</p>
                </div>
              </div>
              <div className="matrix-grid">
                <div className="info-card">
                  <h3>Propagation Matrix</h3>
                  <table className="phase-table">
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th>Rule</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>sub -&gt; root OBSERVED</td>
                        <td>14 days / 2 sub identities / same rule family</td>
                      </tr>
                      <tr>
                        <td>sub -&gt; root RESTRICTED</td>
                        <td>root_sensitive + canEscalateToRoot, or 30 days / 2 restricted or high-risk subs</td>
                      </tr>
                      <tr>
                        <td>sub -&gt; root HIGH_RISK</td>
                        <td>direct root evidence, root_sensitive escalation, or 30 days / 2 high-risk subs</td>
                      </tr>
                      <tr>
                        <td>root -&gt; sub overlay</td>
                        <td>effective-state floors only; stored child state stays local</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="info-card">
                  <h3>Re-entry Cards</h3>
                  <div className="reentry-card">
                    <strong>OBSERVED</strong>
                    <p>7 clean days or one positive signal to return to NORMAL.</p>
                  </div>
                  <div className="reentry-card">
                    <strong>RESTRICTED</strong>
                    <p>14 clean days, score below threshold, no pending review.</p>
                  </div>
                  <div className="reentry-card">
                    <strong>HIGH_RISK</strong>
                    <p>30 clean days, two positive signals, no critical hits or open review.</p>
                  </div>
                  <div className="reentry-card">
                    <strong>FROZEN</strong>
                    <p>Manual release only, then a 30-day HIGH_RISK floor.</p>
                  </div>
                </div>
              </div>
              <div className="matrix-grid">
                <div className="info-card">
                  <h3>Binding Console</h3>
                  <p className="hint">Challenge, signature, and evidence-linked bindings all run through the analyzer SDK path.</p>
                  <div className="actions">
                    <button disabled={!identityReady || !address} onClick={() => void handleBindRootController()}>
                      Create Root Binding
                    </button>
                    <button disabled={!identityReady || !selectedSubIdentity || !address} onClick={() => void handleBindSelectedSubIdentity()}>
                      Create Sub Binding
                    </button>
                    <button disabled={!identityReady || !address} onClick={() => void handleBindSameRootExtension()}>
                      Create Same Root Extension
                    </button>
                  </div>
                  <pre>{JSON.stringify(riskContext.bindings, null, 2)}</pre>
                </div>
                <div className="info-card">
                  <h3>Watch Console</h3>
                  <label>
                    Watch Scope
                    <select value={watchScope} onChange={(event) => setWatchScope(event.target.value as "identity" | "root")}>
                      <option value="identity">Selected Identity</option>
                      <option value="root">Root Overlay</option>
                    </select>
                  </label>
                  <label>
                    Recent Blocks
                    <input value={watchRecentBlocks} onChange={(event) => setWatchRecentBlocks(event.target.value)} />
                  </label>
                  <label>
                    Poll Interval (ms)
                    <input value={watchPollIntervalMs} onChange={(event) => setWatchPollIntervalMs(event.target.value)} />
                  </label>
                  <div className="actions">
                    <button disabled={!identityReady} onClick={() => void handleWatch("start")}>
                      Start Watch
                    </button>
                    <button disabled={!identityReady} onClick={() => void handleWatch("refresh")}>
                      Refresh Watch
                    </button>
                    <button disabled={!identityReady} onClick={() => void handleWatch("stop")}>
                      Stop Watch
                    </button>
                  </div>
                  <pre>{JSON.stringify(watchStatus ?? riskContext.summary.watchStatus ?? { items: [] }, null, 2)}</pre>
                </div>
              </div>
              <pre>{JSON.stringify(riskContext.summary, null, 2)}</pre>
              <pre>{JSON.stringify(riskContext.audit?.slice(-5) ?? [], null, 2)}</pre>
            </>
          ) : (
            <p>Start the analyzer-service and register/bind identities to view Phase3 stored/effective risk state.</p>
          )}
        </article>

        <article className="panel">
          <h2>10. Policy & Review Queue</h2>
          <div className="meta-grid">
            <div>
              <strong>Access Decision</strong>
              <p>{accessDecision?.decision ?? "Not evaluated"}</p>
            </div>
            <div>
              <strong>Warning Decision</strong>
              <p>{warningDecision?.decision ?? "Not evaluated"}</p>
            </div>
            <div>
              <strong>Credential Reasons</strong>
              <p>{accessDecision?.credentialReasons?.length ?? 0}</p>
            </div>
            <div>
              <strong>Risk Reasons</strong>
              <p>{accessDecision?.riskReasons?.length ?? 0}</p>
            </div>
          </div>
          <div className="matrix-grid">
            <div className="info-card">
              <h3>Review Queue Console</h3>
              <label>
                Actor
                <input value={phase3Actor} onChange={(event) => setPhase3Actor(event.target.value)} />
              </label>
              <label>
                Requested State
                <select value={String(reviewRequestedState)} onChange={(event) => setReviewRequestedState(Number(event.target.value))}>
                  <option value={String(IdentityState.OBSERVED)}>OBSERVED</option>
                  <option value={String(IdentityState.RESTRICTED)}>RESTRICTED</option>
                  <option value={String(IdentityState.HIGH_RISK)}>HIGH_RISK</option>
                  <option value={String(IdentityState.FROZEN)}>FROZEN</option>
                </select>
              </label>
              <label>
                Review Reason Code
                <input value={reviewReasonCode} onChange={(event) => setReviewReasonCode(event.target.value)} />
              </label>
              <label>
                Review Note
                <input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
              </label>
              {riskContext?.reviewQueue?.length ? (
                <div className="review-list">
                  {riskContext.reviewQueue.map((item: any) => (
                    <div className="review-item" key={item.reviewItemId}>
                      <strong>{item.status}</strong>
                      <p>{item.reviewItemId}</p>
                      <div className="actions">
                        <button disabled={item.status !== "PENDING_REVIEW"} onClick={() => void handleConfirmReview(item.reviewItemId)}>
                          Confirm Review
                        </button>
                        <button disabled={item.status !== "PENDING_REVIEW"} onClick={() => void handleDismissReview(item.reviewItemId)}>
                          Dismiss Review
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hint">AI outputs are limited to `watch`, `review`, or `warn_only`. Review items stay off-chain until a human confirms them.</p>
              )}
            </div>
            <div className="info-card">
              <h3>Manual Controls</h3>
              <label>
                Manual Release Reason
                <input value={manualReleaseReasonCode} onChange={(event) => setManualReleaseReasonCode(event.target.value)} />
              </label>
              <label>
                Manual Release Evidence
                <input value={manualReleaseEvidence} onChange={(event) => setManualReleaseEvidence(event.target.value)} />
              </label>
              <label>
                Manual Release Note
                <input value={manualReleaseNote} onChange={(event) => setManualReleaseNote(event.target.value)} />
              </label>
              <button disabled={!selectedSubIdentity} onClick={() => void handleManualRelease()}>
                Apply Manual Release
              </button>
              <label>
                Manual List Name
                <select value={manualListName} onChange={(event) => setManualListName(event.target.value as "watchlist" | "restricted_list" | "blacklist_or_frozen_list")}>
                  <option value="watchlist">watchlist</option>
                  <option value="restricted_list">restricted_list</option>
                  <option value="blacklist_or_frozen_list">blacklist_or_frozen_list</option>
                </select>
              </label>
              <label>
                Manual List Action
                <select value={manualListAction} onChange={(event) => setManualListAction(event.target.value as "add" | "remove")}>
                  <option value="add">add</option>
                  <option value="remove">remove</option>
                </select>
              </label>
              <label>
                Manual List Reason
                <input value={manualListReasonCode} onChange={(event) => setManualListReasonCode(event.target.value)} />
              </label>
              <label>
                Manual List Evidence
                <input value={manualListEvidence} onChange={(event) => setManualListEvidence(event.target.value)} />
              </label>
              <label>
                List Expiry (ISO, optional)
                <input value={manualListExpiresAt} onChange={(event) => setManualListExpiresAt(event.target.value)} placeholder="2026-03-30T00:00:00.000Z" />
              </label>
              <button disabled={!selectedSubIdentity} onClick={() => void handleManualListUpdate()}>
                Apply Manual List Override
              </button>
            </div>
          </div>
          {accessDecision ? (
            <pre>{JSON.stringify(accessDecision, null, 2)}</pre>
          ) : (
            <p>Build a payload to evaluate the full AccessPolicy path: credential/proof validity + risk state + policy version.</p>
          )}
          {warningDecision ? <pre>{JSON.stringify(warningDecision, null, 2)}</pre> : null}
        </article>
      </section>

      <section className="footer-panel">
        <h2>Runtime Status</h2>
        <p>{status}</p>
      </section>
    </main>
  );
}
