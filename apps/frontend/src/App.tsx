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
  createSubjectAggregate as createSdkSubjectAggregate,
  dismissAnalyzerReview,
  enterpriseTreasuryGateAbi,
  evaluatePolicyPreflight,
  evaluateAccessPolicy,
  evaluateWarningPolicy,
  exportAnalyzerAudit,
  getAnalyzerListHistory,
  getAnalyzerOperatorDashboard,
  getAnalyzerPolicyDecisionHistory,
  getRecoveryHooksSnapshot,
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
import { scenarioLabel, stateLabel } from "./console/formatters";
import {
  type AuditExportBundleResponse,
  type AuditTargetScope,
  type EnterpriseAction,
  type IdentityContextResponse,
  type ListHistoryActionFilter,
  type ListHistoryNameFilter,
  type ListHistoryResponse,
  type OperatorDashboardResponse,
  type PlatformEntryMeta,
  type PolicyHistoryResponse,
  type PolicyKindFilter,
  type RiskContextResponse,
  type Scenario,
  type SocialAction,
} from "./console/types";
import { buildPlatformConsoleViewModels } from "./console/view-models";
import { AiReviewPanel } from "./panels/AiReviewPanel";
import { AuditEvidencePanel } from "./panels/AuditEvidencePanel";
import { IdentityDetailPanel } from "./panels/IdentityDetailPanel";
import { OperatorDashboardPanel } from "./panels/OperatorDashboardPanel";
import { PlatformOverviewPanel } from "./panels/PlatformOverviewPanel";
import { PolicyDecisionPanel } from "./panels/PolicyDecisionPanel";
import { RecoveryHooksPanel } from "./panels/RecoveryHooksPanel";
import { StateConsequencePanel } from "./panels/StateConsequencePanel";
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
const PLATFORM_ENTRY = (import.meta.env.VITE_PLATFORM_ENTRY ?? "stage3") as "stage1" | "stage2" | "stage3" | "platform";
const PLATFORM_ENTRY_META: Record<"stage1" | "stage2" | "stage3" | "platform", PlatformEntryMeta> = {
  stage1: {
    label: "Stage1 Minimal Baseline",
    summary: "Anvil + issuer-service + frontend + proof happy path.",
    acceptance: "pnpm tsx scripts/verify-stage3-acceptance.ts stage1",
  },
  stage2: {
    label: "Stage2 Reinforced Baseline",
    summary: "Identity + credential + proof + issuer state demo.",
    acceptance: "pnpm tsx scripts/verify-stage3-acceptance.ts stage2",
  },
  stage3: {
    label: "Stage3 Full Stack",
    summary: "Identity + risk + policy + propagation + review queue.",
    acceptance: "pnpm tsx scripts/verify-stage3-acceptance.ts stage3",
  },
  platform: {
    label: "Platform Recommended Entry",
    summary: "Unified P0 platform baseline with the full narrative stack.",
    acceptance: "pnpm tsx scripts/verify-stage3-acceptance.ts platform",
  },
} as const;

function textToBytes32(value: string) {
  return pad(stringToHex(value.slice(0, 31) || "ref"), { size: 32 });
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
  const [operatorDashboard, setOperatorDashboard] = useState<OperatorDashboardResponse | null>(null);
  const [auditBundle, setAuditBundle] = useState<AuditExportBundleResponse | null>(null);
  const [listHistory, setListHistory] = useState<ListHistoryResponse>([]);
  const [policyHistory, setPolicyHistory] = useState<PolicyHistoryResponse>([]);
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
  const [aggregateDraftId, setAggregateDraftId] = useState("");
  const [activeSubjectAggregateId, setActiveSubjectAggregateId] = useState("");
  const [auditTarget, setAuditTarget] = useState<AuditTargetScope>("selected_sub");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [auditPolicyId, setAuditPolicyId] = useState("");
  const [auditPolicyKind, setAuditPolicyKind] = useState<PolicyKindFilter>("");
  const [listTarget, setListTarget] = useState<AuditTargetScope>("selected_sub");
  const [listNameFilter, setListNameFilter] = useState<ListHistoryNameFilter>("");
  const [listActionFilter, setListActionFilter] = useState<ListHistoryActionFilter>("");
  const [listFrom, setListFrom] = useState("");
  const [listTo, setListTo] = useState("");

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
  const platformEntry = PLATFORM_ENTRY_META[PLATFORM_ENTRY] ?? PLATFORM_ENTRY_META.platform;
  const recoveryHooks = useMemo(() => getRecoveryHooksSnapshot(rootIdentity), [rootIdentity]);
  const consoleModels = useMemo(
    () =>
      buildPlatformConsoleViewModels({
        scenario,
        enterpriseAction,
        socialAction,
        platformEntry,
        rootIdentity,
        selectedSubIdentity,
        subIdentities,
        capabilities,
        policySupport,
        effectiveMode,
        activePolicy,
        identityContext,
        riskContext,
        accessDecision,
        warningDecision,
        watchStatus,
        policyPreflight,
        verifierPreflight,
        bundles: currentBundles,
        payload,
        status,
        mintedBalance,
        operatorDashboard,
        recoveryHooks,
        auditBundle,
        listHistory,
        policyHistory,
      }),
    [
      scenario,
      enterpriseAction,
      socialAction,
      platformEntry,
      rootIdentity,
      selectedSubIdentity,
      subIdentities,
      capabilities,
      policySupport,
      effectiveMode,
      activePolicy,
      identityContext,
      riskContext,
      accessDecision,
      warningDecision,
      watchStatus,
      policyPreflight,
      verifierPreflight,
      currentBundles,
      payload,
      status,
      mintedBalance,
      operatorDashboard,
      recoveryHooks,
      auditBundle,
      listHistory,
      policyHistory,
    ],
  );

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
    setOperatorDashboard(null);
    setAuditBundle(null);
    setListHistory([]);
    setPolicyHistory([]);
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
    void refreshPlatformViews(selectedSubIdentity.identityId);
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

  function buildAuditExportInput(target: AuditTargetScope = auditTarget) {
    if (target === "root") {
      if (!rootIdentity) {
        return null;
      }

      return {
        rootIdentityId: rootIdentity.identityId,
        from: auditFrom || undefined,
        to: auditTo || undefined,
        policyId: auditPolicyId || undefined,
        policyKind: auditPolicyKind || undefined,
      };
    }

    if (!selectedSubIdentity) {
      return null;
    }

    return {
      identityId: selectedSubIdentity.identityId,
      subIdentityId: selectedSubIdentity.identityId,
      rootIdentityId: rootIdentity?.identityId,
      from: auditFrom || undefined,
      to: auditTo || undefined,
      policyId: auditPolicyId || undefined,
      policyKind: auditPolicyKind || undefined,
    };
  }

  function buildListHistoryInput(target: AuditTargetScope = listTarget) {
    if (target === "root") {
      if (!rootIdentity) {
        return null;
      }

      return {
        rootIdentityId: rootIdentity.identityId,
        listName: listNameFilter || undefined,
        action: listActionFilter || undefined,
        from: listFrom || undefined,
        to: listTo || undefined,
      };
    }

    if (!selectedSubIdentity) {
      return null;
    }

    return {
      identityId: selectedSubIdentity.identityId,
      subIdentityId: selectedSubIdentity.identityId,
      rootIdentityId: rootIdentity?.identityId,
      listName: listNameFilter || undefined,
      action: listActionFilter || undefined,
      from: listFrom || undefined,
      to: listTo || undefined,
    };
  }

  async function refreshOperatorSummary() {
    try {
      const next = await getAnalyzerOperatorDashboard(ANALYZER_API_URL);
      setOperatorDashboard(next);
    } catch {
      setOperatorDashboard(null);
    }
  }

  async function refreshPolicyHistory(identityId: `0x${string}`) {
    try {
      const next = await getAnalyzerPolicyDecisionHistory(ANALYZER_API_URL, identityId);
      setPolicyHistory(next);
    } catch {
      setPolicyHistory([]);
    }
  }

  async function refreshListHistoryView(target: AuditTargetScope = listTarget) {
    const input = buildListHistoryInput(target);
    if (!input) {
      setListHistory([]);
      return;
    }

    try {
      const next = await getAnalyzerListHistory(ANALYZER_API_URL, input);
      setListHistory(next);
    } catch {
      setListHistory([]);
    }
  }

  async function handleRunAuditExport() {
    const input = buildAuditExportInput();
    if (!input) {
      setAuditBundle(null);
      setStatus("Select a root or sub identity before exporting audit evidence.");
      return;
    }

    try {
      setStatus("Exporting structured audit bundle...");
      const next = await exportAnalyzerAudit(ANALYZER_API_URL, input);
      setAuditBundle(next);
      setStatus("Structured audit bundle loaded.");
    } catch (error) {
      setAuditBundle(null);
      setStatus(error instanceof Error ? error.message : "Failed to export audit bundle.");
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

    const nextRiskContext = riskResult.status === "fulfilled" ? riskResult.value : null;
    setRiskContext(nextRiskContext);
    if (nextRiskContext?.subjectAggregate?.subjectAggregateId) {
      setActiveSubjectAggregateId(nextRiskContext.subjectAggregate.subjectAggregateId);
      setAggregateDraftId(nextRiskContext.subjectAggregate.subjectAggregateId);
    }
    setWatchStatus(watchResult.status === "fulfilled" ? watchResult.value : null);
    setWarningDecision(warningResult.status === "fulfilled" ? warningResult.value : null);
  }

  async function refreshPlatformViews(identityId: `0x${string}`) {
    await Promise.all([
      refreshOperatorSummary(),
      refreshPolicyHistory(identityId),
      refreshListHistoryView(),
    ]);
  }

  async function refreshPhase3State(identityId: `0x${string}`, nextPayload: AccessPayload | null = payload) {
    await refreshRiskContext(identityId);
    await reevaluateAccessDecision(identityId, nextPayload);
    await refreshPlatformViews(identityId);
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

  async function handleCreateSubjectAggregate() {
    setStatus("Creating subject aggregate...");
    const aggregate = await createSdkSubjectAggregate(ANALYZER_API_URL, {
      subjectAggregateId: aggregateDraftId || undefined,
      actor: phase3Actor,
      evidenceRefs: ["frontend:subject-aggregate:create"],
    });
    setActiveSubjectAggregateId(aggregate.subjectAggregateId);
    setAggregateDraftId(aggregate.subjectAggregateId);
    if (selectedSubIdentity) {
      await refreshPhase3State(selectedSubIdentity.identityId, payload);
    }
    setStatus(`Subject aggregate ready: ${aggregate.subjectAggregateId}`);
  }

  async function handleLinkCurrentRootToAggregate() {
    if (!rootIdentity || !address) {
      return;
    }

    const subjectAggregateId = activeSubjectAggregateId || aggregateDraftId;
    if (!subjectAggregateId) {
      setStatus("Create or enter a subject aggregate id before linking the current root.");
      return;
    }

    setStatus("Creating aggregate-link challenge...");
    const challenge = await createAnalyzerBindingChallenge(ANALYZER_API_URL, {
      bindingType: "subject_aggregate_link",
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
      subjectAggregateId,
    });
    const candidateSignature = await signMessageAsync({ message: challenge.challengeMessage });
    await submitAnalyzerBinding(ANALYZER_API_URL, {
      challengeId: challenge.challengeId,
      candidateSignature,
      metadata: { source: "frontend-subject-aggregate-link" },
    });
    setActiveSubjectAggregateId(subjectAggregateId);
    if (selectedSubIdentity) {
      await refreshPhase3State(selectedSubIdentity.identityId, payload);
    }
    setStatus(`Root linked to subject aggregate ${subjectAggregateId}.`);
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
        <div className="hero-stack">
          <p className="eyebrow">Web3ID Platform Baseline</p>
          <h1>Identity, state, consequence, policy, AI review, and operator evidence now read as one platform console.</h1>
          <p className="lede">
            Scenario entry is now summary-first: RWA Access, Enterprise / Audit, and Social Governance all sit on the
            same platform baseline while keeping stored versus effective state, state versus consequence, and AI versus
            human review visibly separate.
          </p>
          <div className="hero-pills">
            {consoleModels.overview.badges.map((badge) => (
              <span className="hero-pill" key={badge}>
                {badge}
              </span>
            ))}
          </div>
        </div>
        <div className="hero-card">
          <p>Platform entry</p>
          <strong>{platformEntry.label}</strong>
          <span>{platformEntry.summary}</span>
          <span>Current scenario: {scenarioLabel(scenario)}</span>
          <strong>{scenarioLabel(scenario)}</strong>
          <span>{selectedSubIdentity ? `${selectedSubIdentity.scope} / ${selectedSubIdentity.type}` : "Select identity"}</span>
          <span>Preferred mode: {capabilities?.preferredMode ?? "N/A"}</span>
          <span>Effective mode: {effectiveMode ?? "Unsupported"}</span>
          <span>Stored state: {stateLabel(riskContext?.summary?.storedState ?? identityContext?.currentState)}</span>
          <span>Effective state: {stateLabel(riskContext?.summary?.effectiveState)}</span>
          <span>Acceptance path: {platformEntry.acceptance}</span>
        </div>
      </section>

      <section className="grid">
        <PlatformOverviewPanel
          model={consoleModels.overview}
          scenario={scenario}
          enterpriseAction={enterpriseAction}
          socialAction={socialAction}
          onScenarioChange={setScenario}
          onEnterpriseActionChange={setEnterpriseAction}
          onSocialActionChange={setSocialAction}
        />

        <IdentityDetailPanel
          model={consoleModels.identity}
          address={address}
          subIdentities={subIdentities.map((item) => ({ id: item.identityId, label: `${item.scope} / ${item.type}` }))}
          selectedSubIdentityId={selectedSubIdentityId ?? ""}
          onSelectedSubIdentityChange={(value) => setSelectedSubIdentityId(value as `0x${string}`)}
          canConnect={connectors.length > 0}
          isConnecting={isConnecting}
          identityReady={identityReady}
          canIssueCredentials={Boolean(selectedSubIdentity && address)}
          onConnect={() => connect({ connector: connectors[0] })}
          onDeriveIdentity={() => void handleDeriveIdentity()}
          onIssueCredentials={() => void handleIssueCredentials()}
        />

          <StateConsequencePanel model={consoleModels.stateConsequence} />

          <RecoveryHooksPanel model={consoleModels.recoveryHooks} />

          <PolicyDecisionPanel
          model={consoleModels.policy}
          scenario={scenario}
          enterpriseAction={enterpriseAction}
          socialAction={socialAction}
          payloadReady={Boolean(payload)}
          isSubmitting={isSubmitting}
          rwaGateAddress={rwaGateAddress}
          enterpriseGateAddress={enterpriseGateAddress}
          socialGateAddress={socialGateAddress}
          assetAddress={assetAddress}
          rwaAmount={rwaAmount}
          paymentAmount={paymentAmount}
          beneficiary={beneficiary}
          paymentRef={paymentRef}
          auditRef={auditRef}
          proposalId={proposalId}
          airdropRoundId={airdropRoundId}
          postRef={postRef}
          onRwaGateChange={(value) => setRwaGateAddress(value as `0x${string}`)}
          onEnterpriseGateChange={(value) => setEnterpriseGateAddress(value as `0x${string}`)}
          onSocialGateChange={(value) => setSocialGateAddress(value as `0x${string}`)}
          onAssetChange={(value) => setAssetAddress(value as `0x${string}`)}
          onRwaAmountChange={setRwaAmount}
          onPaymentAmountChange={setPaymentAmount}
          onBeneficiaryChange={setBeneficiary}
          onPaymentRefChange={setPaymentRef}
          onAuditRefChange={setAuditRef}
          onProposalIdChange={setProposalId}
          onAirdropRoundIdChange={setAirdropRoundId}
          onPostRefChange={setPostRef}
          onBuildPayload={() => void handleBuildPayload()}
          onSubmitRwa={() => void handleSubmitRwa()}
          onSubmitEnterprisePayment={() => void handleSubmitEnterprisePayment()}
          onExportAudit={() => void handleExportAudit()}
          onSubmitSocialAction={() => void handleSubmitSocialAction()}
        />

        <AuditEvidencePanel
          model={consoleModels.auditEvidence}
          auditTarget={auditTarget}
          auditFrom={auditFrom}
          auditTo={auditTo}
          auditPolicyId={auditPolicyId}
          auditPolicyKind={auditPolicyKind}
          listTarget={listTarget}
          listName={listNameFilter}
          listAction={listActionFilter}
          listFrom={listFrom}
          listTo={listTo}
          onAuditTargetChange={setAuditTarget}
          onAuditFromChange={setAuditFrom}
          onAuditToChange={setAuditTo}
          onAuditPolicyIdChange={setAuditPolicyId}
          onAuditPolicyKindChange={setAuditPolicyKind}
          onListTargetChange={setListTarget}
          onListNameChange={setListNameFilter}
          onListActionChange={setListActionFilter}
          onListFromChange={setListFrom}
          onListToChange={setListTo}
          onRunAuditExport={() => void handleRunAuditExport()}
          onRefreshListHistory={() => void refreshListHistoryView()}
        />

        <OperatorDashboardPanel
          model={consoleModels.operator}
          identityReady={identityReady}
          selectedSubIdentityId={selectedSubIdentityId}
          manualReleaseReasonCode={manualReleaseReasonCode}
          manualReleaseEvidence={manualReleaseEvidence}
          manualReleaseNote={manualReleaseNote}
          manualListName={manualListName}
          manualListAction={manualListAction}
          manualListReasonCode={manualListReasonCode}
          manualListEvidence={manualListEvidence}
          manualListExpiresAt={manualListExpiresAt}
          watchScope={watchScope}
          watchRecentBlocks={watchRecentBlocks}
          watchPollIntervalMs={watchPollIntervalMs}
          aggregateDraftId={aggregateDraftId}
          activeSubjectAggregateId={activeSubjectAggregateId}
          onBindRootController={() => void handleBindRootController()}
          onBindSelectedSubIdentity={() => void handleBindSelectedSubIdentity()}
          onBindSameRootExtension={() => void handleBindSameRootExtension()}
          onAggregateDraftIdChange={setAggregateDraftId}
          onCreateSubjectAggregate={() => void handleCreateSubjectAggregate()}
          onLinkCurrentRootToAggregate={() => void handleLinkCurrentRootToAggregate()}
          onWatch={(action) => void handleWatch(action)}
          onApplySignal={(signalKey) => void handleApplySignal(signalKey)}
          onManualReleaseReasonCodeChange={setManualReleaseReasonCode}
          onManualReleaseEvidenceChange={setManualReleaseEvidence}
          onManualReleaseNoteChange={setManualReleaseNote}
          onManualListNameChange={setManualListName}
          onManualListActionChange={setManualListAction}
          onManualListReasonCodeChange={setManualListReasonCode}
          onManualListEvidenceChange={setManualListEvidence}
          onManualListExpiresAtChange={setManualListExpiresAt}
          onWatchScopeChange={setWatchScope}
          onWatchRecentBlocksChange={setWatchRecentBlocks}
          onWatchPollIntervalMsChange={setWatchPollIntervalMs}
          onManualRelease={() => void handleManualRelease()}
          onManualListUpdate={() => void handleManualListUpdate()}
        />

        <AiReviewPanel
          model={consoleModels.aiReview}
          phase3Actor={phase3Actor}
          reviewNote={reviewNote}
          reviewReasonCode={reviewReasonCode}
          reviewRequestedState={reviewRequestedState}
          onActorChange={setPhase3Actor}
          onReviewNoteChange={setReviewNote}
          onReviewReasonCodeChange={setReviewReasonCode}
          onReviewRequestedStateChange={setReviewRequestedState}
          reviewQueue={riskContext?.reviewQueue ?? []}
          onConfirmReview={(reviewItemId) => void handleConfirmReview(reviewItemId)}
          onDismissReview={(reviewItemId) => void handleDismissReview(reviewItemId)}
        />
      </section>

      <section className="footer-panel">
        <h2>Runtime Status</h2>
        <p>{status}</p>
        <p className="hint">Frozen docs: WHAT_IS_WEB3ID / PLATFORM_BASELINE / SYSTEM_INVARIANTS / IDENTITY_INVARIANTS / STATE_SYSTEM_INVARIANTS / BOUNDARIES</p>
        <p className="hint">Acceptance command: {platformEntry.acceptance}</p>
      </section>
    </main>
  );
}
