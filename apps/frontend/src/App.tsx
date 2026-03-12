import { startTransition, useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, usePublicClient, useSignMessage, useSignTypedData, useWriteContract } from "wagmi";
import {
  buildEnterpriseAuditRequestHash,
  buildEnterprisePaymentRequestHash,
  buildHolderAuthorizationPayload,
  buildRwaRequestHash,
  enterpriseTreasuryGateAbi,
  getIdentityState,
  issuePhase2Credential,
  mockRwaAssetAbi,
  policyIds,
  rwaGateAbi,
  verifyAccess,
  type AccessPayload,
} from "@web3id/sdk";
import { holderAuthorizationTypes, type CredentialBundle, type HolderAuthorizationPayload } from "@web3id/credential";
import { buildSignInMessage, deriveRootIdentity, listDefaultSubIdentities, SubIdentityType, type SubIdentity } from "@web3id/identity";
import { IdentityState } from "@web3id/state";
import { pad, stringToHex } from "viem";

type Scenario = "rwa" | "enterprise";
type EnterpriseAction = "payment" | "audit";
type ProofWorkerResponse =
  | { ok: true; result: { proofPoints: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]; publicSignals: [bigint] } }
  | { ok: false; error: string };

const ISSUER_API_URL = import.meta.env.VITE_ISSUER_API_URL ?? "http://127.0.0.1:4100";
const DEFAULT_RWA_GATE = (import.meta.env.VITE_RWA_GATE_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const DEFAULT_ENTERPRISE_GATE = (import.meta.env.VITE_ENTERPRISE_GATE_ADDRESS ??
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
  const [selectedSubIdentityId, setSelectedSubIdentityId] = useState<`0x${string}` | null>(null);
  const [bundles, setBundles] = useState<CredentialBundle[]>([]);
  const [payload, setPayload] = useState<AccessPayload | null>(null);
  const [status, setStatus] = useState("Idle");
  const [rwaAmount, setRwaAmount] = useState("1");
  const [paymentAmount, setPaymentAmount] = useState("50");
  const [beneficiary, setBeneficiary] = useState("0x00000000000000000000000000000000000000B0");
  const [paymentRef, setPaymentRef] = useState("payment-001");
  const [auditRef, setAuditRef] = useState("audit-001");
  const [rwaGateAddress, setRwaGateAddress] = useState(DEFAULT_RWA_GATE);
  const [enterpriseGateAddress, setEnterpriseGateAddress] = useState(DEFAULT_ENTERPRISE_GATE);
  const [assetAddress, setAssetAddress] = useState(DEFAULT_ASSET);
  const [verifierAddress] = useState(DEFAULT_VERIFIER);
  const [stateRegistryAddress] = useState(DEFAULT_STATE_REGISTRY);
  const [mintedBalance, setMintedBalance] = useState("0");
  const [identityState, setIdentityState] = useState<number>();
  const [preflight, setPreflight] = useState<string>("Not checked");

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
    return enterpriseAction === "payment" ? policyIds.ENTITY_PAYMENT_V1 : policyIds.ENTITY_AUDIT_V1;
  }, [enterpriseAction, scenario]);

  useEffect(() => {
    if (!subIdentities.length) {
      return;
    }

    const preferredType = scenario === "rwa" ? SubIdentityType.RWA_INVEST : SubIdentityType.PAYMENTS;
    const preferred = subIdentities.find((item) => item.type === preferredType) ?? subIdentities[0];
    setSelectedSubIdentityId(preferred.identityId);
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

  async function handleDeriveIdentity() {
    if (!address) {
      return;
    }

    setStatus("Signing wallet challenge...");
    await signMessageAsync({
      message: buildSignInMessage(address, nonce, chainId ?? 31337),
    });
    setStatus("Identity tree ready.");
  }

  async function handleIssueCredentials() {
    if (!address || !rootIdentity || !selectedSubIdentity) {
      return;
    }

    setStatus("Issuing Phase2 credential...");
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
    if (!address || !selectedSubIdentity || bundles.length === 0) {
      return;
    }

    const gateAddress = scenario === "rwa" ? rwaGateAddress : enterpriseGateAddress;
    const requestHash =
      scenario === "rwa"
        ? buildRwaRequestHash(gateAddress, BigInt(rwaAmount))
        : enterpriseAction === "payment"
          ? buildEnterprisePaymentRequestHash(gateAddress, beneficiary as `0x${string}`, BigInt(paymentAmount), textToBytes32(paymentRef))
          : buildEnterpriseAuditRequestHash(gateAddress, textToBytes32(auditRef));

    const holderPayload: HolderAuthorizationPayload = {
      identityId: selectedSubIdentity.identityId,
      subjectBinding: bundles[0].attestation.subjectBinding as `0x${string}`,
      policyId: activePolicyId,
      requestHash,
      chainId: chainId ?? 31337,
      nonce: 1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 15 * 60),
    };

    setStatus("Signing holder authorization...");
    const signature = await signTypedDataAsync({
      domain: {
        name: scenario === "rwa" ? "Web3ID RWAGate" : "Web3ID Enterprise Treasury",
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
      worker.postMessage({ bundle: bundles[0], subjectAddress: address });
    });
    worker.terminate();

    if (!response.ok) {
      throw new Error(response.error);
    }

    const nextPayload: AccessPayload = {
      identityId: selectedSubIdentity.identityId,
      credentialAttestations: bundles.map((bundle) => bundle.attestation),
      zkProof: {
        proofPoints: response.result.proofPoints,
        publicSignals: response.result.publicSignals,
      },
      policyVersion: 1,
      holderAuthorization: buildHolderAuthorizationPayload(holderPayload, signature),
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

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Web3ID Phase2</p>
          <h1>Identity, state, policy, and access control on one console.</h1>
          <p className="lede">
            Deterministic identity tree, typed-data credentials, registry-backed state, and dual templates for RWA and enterprise treasury.
          </p>
        </div>
        <div className="hero-card">
          <p>Current scenario</p>
          <strong>{scenario === "rwa" ? "RWA Access" : "Enterprise Treasury"}</strong>
          <span>{selectedSubIdentity ? `${selectedSubIdentity.scope} / ${selectedSubIdentity.type}` : "Select identity"}</span>
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
          <h2>3. State & Policy</h2>
          <p className="badge">State: {stateLabel(identityState)}</p>
          <p>Policy ID: {activePolicyId}</p>
          <p>Verifier preflight: {preflight}</p>
          <p>Minted RWA balance: {mintedBalance}</p>
        </article>

        <article className="panel">
          <h2>4. Credentials</h2>
          <button disabled={!selectedSubIdentity || !address} onClick={handleIssueCredentials}>
            Issue Scenario Credential
          </button>
          {bundles.length > 0 ? (
            <pre>{JSON.stringify(bundles, null, 2)}</pre>
          ) : (
            <p>{scenario === "rwa" ? "Issues KYC/AML credential bound to the selected identity." : "Issues an entity credential for treasury access."}</p>
          )}
        </article>

        <article className="panel">
          <h2>5. Proof & Payload</h2>
          <button disabled={bundles.length === 0 || !selectedSubIdentity} onClick={handleBuildPayload}>
            Build Access Payload
          </button>
          {payload ? (
            <pre>{JSON.stringify(payload, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2)}</pre>
          ) : (
            <p>Generate a holder-binding proof and signed holder authorization.</p>
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
          ) : enterpriseAction === "payment" ? (
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
