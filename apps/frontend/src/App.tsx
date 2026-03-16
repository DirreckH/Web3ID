import { startTransition, useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, usePublicClient, useSignMessage, useSignTypedData, useWriteContract } from "wagmi";
import {
  applyDemoSignal,
  buildAirdropClaimRequestHash,
  buildCommunityPostRequestHash,
  buildEnterpriseAuditRequestHash,
  buildEnterprisePaymentRequestHash,
  buildGovernanceVoteRequestHash,
  buildHolderAuthorizationPayload,
  buildRwaRequestHash,
  enterpriseTreasuryGateAbi,
  getIdentityCapabilities,
  getIdentityContext,
  getIdentityState,
  getPolicyDefinition,
  issuePhase2Credential,
  mockRwaAssetAbi,
  policyIds,
  registerIdentityTree,
  resolveEffectiveMode,
  rwaGateAbi,
  socialGovernanceGateAbi,
  supportsPolicy,
  verifyAccess,
  type AccessPayload,
} from "@web3id/sdk";
import { computeSubjectBinding, holderAuthorizationTypes, type CredentialBundle, type HolderAuthorizationPayload } from "@web3id/credential";
import { buildSignInMessage, deriveRootIdentity, listDefaultSubIdentities, SubIdentityType } from "@web3id/identity";
import { IdentityState } from "@web3id/state";
import { pad, stringToHex } from "viem";

type Scenario = "rwa" | "enterprise" | "social";
type EnterpriseAction = "payment" | "audit";
type SocialAction = "vote" | "airdrop" | "post";
type IdentityContextResponse = Awaited<ReturnType<typeof getIdentityContext>>;
type ProofWorkerResponse =
  | { ok: true; result: { proofPoints: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]; publicSignals: [bigint] } }
  | { ok: false; error: string };

const ISSUER_API_URL = import.meta.env.VITE_ISSUER_API_URL ?? "http://127.0.0.1:4100";
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

function textToBytes32(value: string) {
  return pad(stringToHex(value.slice(0, 31) || "ref"), { size: 32 });
}

function stateLabel(state: number | undefined) {
  if (state === undefined) {
    return "INIT";
  }

  return IdentityState[state] ?? "INIT";
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
  const [preflight, setPreflight] = useState<string>("Not checked");
  const [identityContext, setIdentityContext] = useState<IdentityContextResponse | null>(null);

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
    setPreflight("Not checked");
  }, [scenario, subIdentities]);

  useEffect(() => {
    if (!selectedSubIdentity || !publicClient || !stateRegistryAddress || stateRegistryAddress === DEFAULT_STATE_REGISTRY) {
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
  }, [identityReady, selectedSubIdentity, status]);

  async function refreshIdentityContext(identityId: `0x${string}`) {
    try {
      const next = await getIdentityContext(ISSUER_API_URL, identityId);
      setIdentityContext(next);
    } catch {
      setIdentityContext(null);
    }
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
    setIdentityReady(true);
    if (selectedSubIdentity) {
      await refreshIdentityContext(selectedSubIdentity.identityId);
    }
    setStatus("Identity tree ready.");
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
    setPreflight("Not checked");
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
      message: {
        ...holderPayload,
      },
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

    if (publicClient && verifierAddress !== DEFAULT_VERIFIER) {
      try {
        const result = await verifyAccess(publicClient, verifierAddress, activePolicyId, nextPayload);
        setPreflight(`Verifier preflight: ${String(result)}`);
      } catch (error) {
        setPreflight(error instanceof Error ? error.message : "Verifier preflight failed");
      }
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
      args: [payload, BigInt(rwaAmount)],
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
      args: [payload, beneficiary as `0x${string}`, BigInt(paymentAmount), textToBytes32(paymentRef)],
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
      args: [payload, textToBytes32(auditRef)],
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
        args: [payload, textToBytes32(proposalId)],
      });
    } else if (socialAction === "airdrop") {
      await writeContractAsync({
        abi: socialGovernanceGateAbi,
        address: socialGateAddress,
        functionName: "claimAirdrop",
        args: [payload, textToBytes32(airdropRoundId)],
      });
    } else {
      await writeContractAsync({
        abi: socialGovernanceGateAbi,
        address: socialGateAddress,
        functionName: "createPost",
        args: [payload, textToBytes32(postRef)],
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
    setStatus(`Signal applied: ${signalKey}`);
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
          <p>Verifier preflight: {preflight}</p>
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
      </section>

      <section className="footer-panel">
        <h2>Runtime Status</h2>
        <p>{status}</p>
      </section>
    </main>
  );
}
