import { spawn, execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { generateComplianceProof } from "../packages/proof/src/index.js";
import { POLICY_DEFINITIONS, POLICY_IDS } from "../packages/policy/src/index.js";
import { createSameRootProof, createSubIdentityLinkProof, deriveRootIdentity, listDefaultSubIdentities, SubIdentityType } from "../packages/identity/src/index.js";

const ROOT = resolve(import.meta.dirname, "..");
const RPC_URL = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
const ISSUER_API_URL = "http://127.0.0.1:4100";
const ANALYZER_API_URL = "http://127.0.0.1:4200";
const POLICY_API_URL = "http://127.0.0.1:4300";
const DEFAULT_HOLDER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const ISSUER_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945384d7d0f5fb8f7c8d17826dfec353bbf4d6" as const;
const SECOND_PRIVATE_KEY = "0x5de4111afa1a4b94908f83103e0a14158d1c3f28f1c0a4e22ea39bdeef3c4f5d" as const;
const ANALYZER_DATA_FILE = resolve(ROOT, ".web3id/analyzer-store.acceptance.json");
const ISSUER_DATA_FILE = resolve(ROOT, ".web3id/issuer-store.acceptance.json");
const LOG_DIR = resolve(ROOT, ".web3id/acceptance-logs");
const UNKNOWN_TARGETS = [
  "0x00000000000000000000000000000000000000f4",
  "0x00000000000000000000000000000000000000f5",
  "0x00000000000000000000000000000000000000f6",
] as const;
const GOVERNANCE_TARGET = "0x00000000000000000000000000000000000000e1" as const;
const HIGH_RISK_TARGET = "0x00000000000000000000000000000000000000c1" as const;
const MIXER_TARGET = "0x00000000000000000000000000000000000000a1" as const;
const SANCTIONED_TARGET = "0x00000000000000000000000000000000000000b1" as const;

type ServiceHandle = {
  name: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  child: ReturnType<typeof spawn>;
  logs: string[];
};

type ProcessHandle = ReturnType<typeof spawn>;

const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const issuerAccount = privateKeyToAccount(ISSUER_PRIVATE_KEY);
const extensionAccount = privateKeyToAccount(SECOND_PRIVATE_KEY);
const rootIdentity = deriveRootIdentity(DEFAULT_HOLDER, 31337);
const subIdentities = listDefaultSubIdentities(rootIdentity);
const rwaIdentity = subIdentities.find((item) => item.type === SubIdentityType.RWA_INVEST)!;
const paymentsIdentity = subIdentities.find((item) => item.type === SubIdentityType.PAYMENTS)!;
const socialIdentity = subIdentities.find((item) => item.type === SubIdentityType.SOCIAL)!;
const anonymousIdentity = subIdentities.find((item) => item.type === SubIdentityType.ANONYMOUS_LOWRISK)!;
const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account: deployer, chain: foundry, transport: http(RPC_URL) });

const stateRegistryAbi = [
  {
    type: "function",
    name: "getStateSnapshotV2",
    stateMutability: "view",
    inputs: [{ name: "identityId", type: "bytes32" }],
    outputs: [
      { name: "state", type: "uint8" },
      { name: "reasonCode", type: "bytes32" },
      { name: "version", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "lastStateHash", type: "bytes32" },
      { name: "lastEvidenceBundleHash", type: "bytes32" },
    ],
  },
] as const;

function trimLogs(lines: string[], chunk: string) {
  lines.push(...chunk.split(/\r?\n/).filter(Boolean));
  while (lines.length > 80) {
    lines.shift();
  }
}

function resolveFoundryExecutable(name: string) {
  return process.platform === "win32"
    ? join(process.env.USERPROFILE ?? "", ".foundry", "bin", `${name}.exe`)
    : join(process.env.HOME ?? "", ".foundry", "bin", name);
}

function killProcessTree(pid: number | undefined) {
  if (!pid) return;
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    // ignore
  }
}

function killPorts(ports: number[]) {
  try {
    const output = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    const pids = [...new Set(
      output
        .split(/\r?\n/)
        .filter((line) => line.includes("LISTENING") && ports.some((port) => line.includes(`:${port}`)))
        .map((line) => Number(line.trim().split(/\s+/).pop()))
        .filter((pid) => Number.isFinite(pid)),
    )];
    for (const pid of pids) {
      killProcessTree(pid);
    }
  } catch {
    // ignore
  }
}

async function rpcRequest<T>(method: string, params: unknown[] = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `RPC ${method} failed`);
  }
  return payload.result as T;
}

async function isRpcReady() {
  try {
    await rpcRequest("eth_chainId");
    return true;
  } catch {
    return false;
  }
}

async function waitForHealth(url: string, label: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep waiting
    }
    await delay(1_000);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${JSON.stringify(parsed)}`);
  }
  return parsed as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status} ${JSON.stringify(parsed)}`);
  }
  return parsed as T;
}

async function postRaw(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

async function waitFor<T>(label: string, callback: () => Promise<T | null>, timeoutMs = 30_000, intervalMs = 1_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await callback();
      if (value !== null) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}${lastError instanceof Error ? `: ${lastError.message}` : ""}`);
}

function startService(name: string, cwd: string, env: NodeJS.ProcessEnv) {
  const child = spawn("cmd", ["/c", "pnpm exec tsx src/server.ts"], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  const handle: ServiceHandle = { name, cwd, env, child, logs: [] };
  child.stdout.on("data", (chunk) => trimLogs(handle.logs, chunk.toString()));
  child.stderr.on("data", (chunk) => trimLogs(handle.logs, chunk.toString()));
  return handle;
}

async function ensureAnvil() {
  if (await isRpcReady()) {
    return undefined;
  }

  const anvil = resolveFoundryExecutable("anvil");
  const child = spawn(anvil, [], {
    cwd: ROOT,
    env: process.env,
    stdio: ["ignore", "ignore", "ignore"],
    shell: false,
  });

  await waitFor("anvil rpc", async () => (await isRpcReady()) ? true : null, 60_000, 1_000);
  return child;
}

function stopService(service: ServiceHandle | undefined) {
  if (!service) return;
  killProcessTree(service.child.pid);
}

function buildServiceError(service: ServiceHandle) {
  return `${service.name} failed.\n${service.logs.join("\n")}`;
}

async function restartService(service: ServiceHandle, healthUrl: string) {
  stopService(service);
  const next = startService(service.name, service.cwd, service.env);
  await waitForHealth(healthUrl, `${service.name} restart`);
  return next;
}

async function deployContracts() {
  const forge = resolveFoundryExecutable("forge");
  const child = spawn(
    forge,
    ["script", "script/DeployLocal.s.sol:DeployLocalScript", "--rpc-url", RPC_URL, "--broadcast", "--non-interactive"],
    {
      cwd: resolve(ROOT, "contracts"),
      env: {
        ...process.env,
        PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
        TRUSTED_ISSUER: issuerAccount.address,
        USE_MOCK_GROTH16_VERIFIER: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    },
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  await new Promise<void>((resolvePromise, reject) => {
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(output || `forge exited with ${code}`));
      }
    });
  });

  const matchAddress = (label: string) => {
    const match = output.match(new RegExp(`${label}:\\s*(0x[a-fA-F0-9]{40})`));
    if (!match) throw new Error(`Unable to parse ${label} from deploy output`);
    return match[1] as `0x${string}`;
  };

  return {
    stateRegistry: matchAddress("IdentityStateRegistry"),
    complianceVerifier: matchAddress("ComplianceVerifier"),
  };
}

async function seedIdentityState(stateRegistryAddress: `0x${string}`) {
  const abi = [
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
  ] as const;
  const initialStates = [
    [rwaIdentity.identityId, 1],
    [paymentsIdentity.identityId, 1],
    [socialIdentity.identityId, 1],
    [anonymousIdentity.identityId, 2],
  ] as const;

  for (const [identityId, nextState] of initialStates) {
    const hash = await walletClient.writeContract({
      account: deployer,
      chain: undefined,
      address: stateRegistryAddress,
      abi,
      functionName: "setState",
      args: [identityId, nextState, rootIdentity.rootId, 1n],
    } as any);
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

async function sendTransaction(to: `0x${string}`, data: `0x${string}` = "0x", value = 1n) {
  const hash = await walletClient.sendTransaction({
    account: deployer,
    chain: undefined,
    to,
    data,
    value,
  } as any);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function currentBlockNumber() {
  const value = await rpcRequest<string>("eth_blockNumber");
  return BigInt(value);
}

async function backfillExact(identityId: Hex, fromBlock: bigint, toBlock: bigint) {
  return postJson<any>(`${ANALYZER_API_URL}/scan/backfill`, {
    identityId,
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
  });
}

async function registerAndBindDefaultTree() {
  await postJson(`${ISSUER_API_URL}/identities/register-tree`, {
    rootIdentity,
    subIdentities,
  });
  await postJson(`${ANALYZER_API_URL}/identities/register-tree`, {
    rootIdentity,
    subIdentities,
  });

  const rootChallenge = await postJson<{ challengeId: string; challengeMessage: string }>(`${ANALYZER_API_URL}/bindings/challenge`, {
    bindingType: "root_controller",
    candidateAddress: rootIdentity.controllerAddress,
    rootIdentityId: rootIdentity.identityId,
  });
  await postJson(`${ANALYZER_API_URL}/bindings`, {
    challengeId: rootChallenge.challengeId,
    candidateSignature: await deployer.signMessage({ message: rootChallenge.challengeMessage }),
  });

  for (const subIdentity of subIdentities) {
    const challenge = await postJson<{ challengeId: string; challengeMessage: string }>(`${ANALYZER_API_URL}/bindings/challenge`, {
      bindingType: "sub_identity_link",
      candidateAddress: rootIdentity.controllerAddress,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: subIdentity.identityId,
    });
    await postJson(`${ANALYZER_API_URL}/bindings`, {
      challengeId: challenge.challengeId,
      candidateSignature: await deployer.signMessage({ message: challenge.challengeMessage }),
      linkProof: createSubIdentityLinkProof(rootIdentity, subIdentity),
    });
  }
}

async function issueBundleAndPayload() {
  const issued = await postJson<any>(`${ISSUER_API_URL}/credentials/issue`, {
    holder: `did:pkh:eip155:31337:${DEFAULT_HOLDER}`,
    holderIdentityId: rwaIdentity.identityId,
    subjectAddress: DEFAULT_HOLDER,
    credentialKind: "kycAml",
    claimSet: { residency: "CN", accredited: true },
    policyHints: [POLICY_IDS.RWA_BUY_V2],
    evidenceRef: "acceptance:rwa-bundle",
  });
  const bundle = issued.bundle ?? issued;
  const proof = await generateComplianceProof(bundle, {
    mode: "node",
    subjectAddress: DEFAULT_HOLDER,
    wasmPath: resolve(ROOT, "packages/proof/artifacts/web3id_compliance_js/web3id_compliance.wasm"),
    zkeyPath: resolve(ROOT, "packages/proof/artifacts/web3id-compliance_final.zkey"),
  });

  const payload = {
    identityId: rwaIdentity.identityId,
    credentialAttestations: [bundle.attestation],
    zkProof: {
      proofPoints: proof.proofPoints.map((value) => value.toString()),
      publicSignals: proof.publicSignals.map((value) => value.toString()),
    },
    policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
    holderAuthorization: {
      identityId: rwaIdentity.identityId,
      subjectBinding: bundle.attestation.subjectBinding,
      policyId: POLICY_IDS.RWA_BUY_V2,
      requestHash: `0x${"11".repeat(32)}`,
      chainId: 31337,
      nonce: "1",
      deadline: String(Math.floor(Date.now() / 1000) + 900),
      signature: `0x${"22".repeat(65)}`,
    },
  };

  return { bundle, payload };
}

async function getRiskContext(identityId: Hex) {
  return getJson<any>(`${ANALYZER_API_URL}/identities/${identityId}/risk-context`);
}

async function getEvents(identityId: Hex) {
  return getJson<{ items: any[] }>(`${ANALYZER_API_URL}/identities/${identityId}/events`);
}

async function readOnchainSnapshot(stateRegistryAddress: `0x${string}`, identityId: Hex) {
  const snapshot = await publicClient.readContract({
    address: stateRegistryAddress,
    abi: stateRegistryAbi,
    functionName: "getStateSnapshotV2",
    args: [identityId],
  });
  return {
    state: Number(snapshot[0]),
    reasonCode: snapshot[1],
    version: Number(snapshot[2]),
    updatedAt: Number(snapshot[3]),
    lastStateHash: snapshot[4],
    lastEvidenceBundleHash: snapshot[5],
  };
}

function pendingAnchorCount(context: any) {
  return (context.anchors ?? []).filter((entry: any) => entry.status === "PENDING").length;
}

async function main() {
  mkdirSync(dirname(ANALYZER_DATA_FILE), { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
  killPorts([4100, 4200, 4300, 3000]);
  await rm(ANALYZER_DATA_FILE, { force: true });
  await rm(ISSUER_DATA_FILE, { force: true });

  let issuerService: ServiceHandle | undefined;
  let analyzerService: ServiceHandle | undefined;
  let policyService: ServiceHandle | undefined;
  let anvilProcess: ProcessHandle | undefined;

  try {
    anvilProcess = await ensureAnvil();
    await rpcRequest("anvil_reset");
    const deployment = await deployContracts();
    await seedIdentityState(deployment.stateRegistry);
    const issuerEnv = {
      ...process.env,
      ANVIL_RPC_URL: RPC_URL,
      VITE_CHAIN_ID: "31337",
      ISSUER_PRIVATE_KEY,
      ISSUER_ADDRESS: issuerAccount.address,
      ISSUER_DATA_FILE,
      COMPLIANCE_VERIFIER_ADDRESS: deployment.complianceVerifier,
    };
    const analyzerEnv = {
      ...process.env,
      ANVIL_RPC_URL: RPC_URL,
      PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
      RISK_MANAGER_PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
      ANALYZER_DATA_FILE,
      ANALYZER_PORT: "4200",
      VITE_CHAIN_ID: "31337",
      STATE_REGISTRY_ADDRESS: deployment.stateRegistry,
      ISSUER_API_URL: ISSUER_API_URL,
    };
    const policyEnv = {
      ...process.env,
      ANVIL_RPC_URL: RPC_URL,
      POLICY_API_PORT: "4300",
      ANALYZER_API_URL,
      ISSUER_API_URL,
      COMPLIANCE_VERIFIER_ADDRESS: deployment.complianceVerifier,
    };
    issuerService = startService("issuer-service", resolve(ROOT, "apps/issuer-service"), issuerEnv);
    analyzerService = startService("analyzer-service", resolve(ROOT, "apps/analyzer-service"), analyzerEnv);
    policyService = startService("policy-api", resolve(ROOT, "apps/policy-api"), policyEnv);

    await waitForHealth(`${ISSUER_API_URL}/health`, "issuer-service");
    await waitForHealth(`${ANALYZER_API_URL}/health`, "analyzer-service");
    await waitForHealth(`${POLICY_API_URL}/health`, "policy-api");

    await registerAndBindDefaultTree();
    await sendTransaction("0x00000000000000000000000000000000000000d1");
    await sendTransaction(GOVERNANCE_TARGET);

    const { bundle, payload } = await issueBundleAndPayload();

    const denyWithoutBundles = await postJson<any>(`${POLICY_API_URL}/policies/access/evaluate`, {
      identityId: rwaIdentity.identityId,
      policyId: POLICY_IDS.RWA_BUY_V2,
      policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
      payload,
    });
    const allowWithValidInputs = await postJson<any>(`${POLICY_API_URL}/policies/access/evaluate`, {
      identityId: rwaIdentity.identityId,
      policyId: POLICY_IDS.RWA_BUY_V2,
      policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
      payload,
      credentialBundles: [bundle],
    });

    const socialEventsBeforeStart = (await getEvents(socialIdentity.identityId)).items.length;
    await postJson(`${ANALYZER_API_URL}/scan/watch`, {
      action: "start",
      identityId: socialIdentity.identityId,
      recentBlocks: 4,
      pollIntervalMs: 2_000,
    });
    await sendTransaction(GOVERNANCE_TARGET);
    const socialEventsAfterAuto = await waitFor("social watcher auto scan", async () => {
      const events = await getEvents(socialIdentity.identityId);
      return events.items.length > socialEventsBeforeStart ? events.items.length : null;
    });
    analyzerService = await restartService(analyzerService, `${ANALYZER_API_URL}/health`);
    const restoredWatchStatus = await waitFor("restored watcher", async () => {
      const status = await getJson<{ items: any[] }>(`${ANALYZER_API_URL}/scan/watch/status?identityId=${socialIdentity.identityId}`);
      const item = status.items?.[0];
      return item?.status === "ACTIVE" && Boolean(item.lastScanCompletedAt) ? item : null;
    }, 60_000);
    const socialEventsBeforeRestartAuto = (await getEvents(socialIdentity.identityId)).items.length;
    await sendTransaction(GOVERNANCE_TARGET);
    const socialEventsAfterRestartAuto = await waitFor("social watcher post-restart auto scan", async () => {
      const events = await getEvents(socialIdentity.identityId);
      return events.items.length > socialEventsBeforeRestartAuto ? events.items.length : null;
    });
    await postJson(`${ANALYZER_API_URL}/scan/watch`, {
      action: "stop",
      identityId: socialIdentity.identityId,
    });
    const analyzerStoreRaw = await readFile(ANALYZER_DATA_FILE, "utf8");
    JSON.parse(analyzerStoreRaw);

    const paymentsChainBeforeObserved = await readOnchainSnapshot(deployment.stateRegistry, paymentsIdentity.identityId);
    const observedStartBlock = await currentBlockNumber();
    for (const target of UNKNOWN_TARGETS) {
      await sendTransaction(target, "0x1234", 0n);
    }
    const observedEndBlock = await currentBlockNumber();
    const observedScan = await backfillExact(paymentsIdentity.identityId, observedStartBlock + 1n, observedEndBlock);
    const paymentsObserved = await getRiskContext(paymentsIdentity.identityId);
    const warningBefore = pendingAnchorCount(paymentsObserved);
    const warningDecision = await postJson<any>(`${POLICY_API_URL}/policies/warning/evaluate`, {
      identityId: paymentsIdentity.identityId,
      policyId: "COUNTERPARTY_WARNING_V1",
      policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
    });
    const paymentsAfterWarning = await getRiskContext(paymentsIdentity.identityId);

    const restrictedStartBlock = await currentBlockNumber();
    await sendTransaction(HIGH_RISK_TARGET);
    const restrictedEndBlock = await currentBlockNumber();
    const restrictedScan = await backfillExact(rwaIdentity.identityId, restrictedStartBlock + 1n, restrictedEndBlock);
    const rwaRestricted = await getRiskContext(rwaIdentity.identityId);
    const rootAfterRestricted = await getRiskContext(rootIdentity.identityId);
    const socialAfterRestricted = await getRiskContext(socialIdentity.identityId);
    const anonymousAfterRestricted = await getRiskContext(anonymousIdentity.identityId);
    const restrictWithRisk = await postJson<any>(`${POLICY_API_URL}/policies/access/evaluate`, {
      identityId: rwaIdentity.identityId,
      policyId: POLICY_IDS.RWA_BUY_V2,
      policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
      payload,
      credentialBundles: [bundle],
    });

    const highRiskStartBlock = await currentBlockNumber();
    await sendTransaction(MIXER_TARGET);
    const highRiskEndBlock = await currentBlockNumber();
    const highRiskScan = await backfillExact(paymentsIdentity.identityId, highRiskStartBlock + 1n, highRiskEndBlock);
    const paymentsHighRisk = await getRiskContext(paymentsIdentity.identityId);

    const frozenStartBlock = await currentBlockNumber();
    await sendTransaction(SANCTIONED_TARGET);
    const frozenEndBlock = await currentBlockNumber();
    const frozenScan = await backfillExact(paymentsIdentity.identityId, frozenStartBlock + 1n, frozenEndBlock);
    const paymentsFrozen = await getRiskContext(paymentsIdentity.identityId);
    const paymentsChainAfter = await readOnchainSnapshot(deployment.stateRegistry, paymentsIdentity.identityId);
    const rwaChainAfter = await readOnchainSnapshot(deployment.stateRegistry, rwaIdentity.identityId);

    const missingSignature = await postRaw(`${ANALYZER_API_URL}/bindings`, { challengeId: "missing-signature" });
    const wrongSignerChallenge = await postJson<any>(`${ANALYZER_API_URL}/bindings/challenge`, {
      bindingType: "root_controller",
      candidateAddress: deployer.address,
      rootIdentityId: rootIdentity.identityId,
    });
    const wrongSigner = await postRaw(`${ANALYZER_API_URL}/bindings`, {
      challengeId: wrongSignerChallenge.challengeId,
      candidateSignature: await extensionAccount.signMessage({ message: wrongSignerChallenge.challengeMessage }),
    });
    const sameRootChallenge = await postJson<any>(`${ANALYZER_API_URL}/bindings/challenge`, {
      bindingType: "same_root_extension",
      candidateAddress: extensionAccount.address,
      rootIdentityId: rootIdentity.identityId,
    });
    const sameRootNoAuthorizer = await postRaw(`${ANALYZER_API_URL}/bindings`, {
      challengeId: sameRootChallenge.challengeId,
      candidateSignature: await extensionAccount.signMessage({ message: sameRootChallenge.challengeMessage }),
      sameRootProof: createSameRootProof(rootIdentity, [rwaIdentity, paymentsIdentity]),
    });

    const results = {
      watcher: {
        eventsBeforeStart: socialEventsBeforeStart,
        eventsAfterAuto: socialEventsAfterAuto,
        restoredWatchStatus,
        eventsBeforeRestartAuto: socialEventsBeforeRestartAuto,
        eventsAfterRestartAuto: socialEventsAfterRestartAuto,
        storeJsonValid: true,
      },
      anchoring: {
        observedScan,
        observedStoredState: paymentsObserved.summary.storedState,
        observedEffectiveState: paymentsObserved.summary.effectiveState,
        observedPendingAnchors: pendingAnchorCount(paymentsObserved),
        observedOnchainStateBefore: paymentsChainBeforeObserved.state,
        observedOnchainStateAfter: paymentsChainAfter.state,
        warningDecision: warningDecision.decision,
        warningPendingAnchorsBefore: warningBefore,
        warningPendingAnchorsAfter: pendingAnchorCount(paymentsAfterWarning),
        restrictedScan,
        restrictedPendingAnchors: pendingAnchorCount(rwaRestricted),
        highRiskScan,
        highRiskPendingAnchors: pendingAnchorCount(paymentsHighRisk),
        frozenScan,
        frozenPendingAnchors: pendingAnchorCount(paymentsFrozen),
        rwaOnchainStateWithoutFlush: rwaChainAfter.state,
      },
      storedEffective: {
        rwa: { stored: rwaRestricted.summary.storedState, effective: rwaRestricted.summary.effectiveState },
        root: { stored: rootAfterRestricted.summary.storedState, effective: rootAfterRestricted.summary.effectiveState },
        social: { stored: socialAfterRestricted.summary.storedState, effective: socialAfterRestricted.summary.effectiveState, warnings: socialAfterRestricted.summary.warnings },
        anonymous: { stored: anonymousAfterRestricted.summary.storedState, effective: anonymousAfterRestricted.summary.effectiveState, warnings: anonymousAfterRestricted.summary.warnings },
      },
      bindings: {
        missingSignature,
        wrongSigner,
        sameRootNoAuthorizer,
      },
      accessPolicy: {
        denyWithoutBundles: {
          decision: denyWithoutBundles.decision,
          credentialReasons: denyWithoutBundles.credentialReasons,
          riskReasons: denyWithoutBundles.riskReasons,
        },
        allowWithValidInputs: {
          decision: allowWithValidInputs.decision,
          credentialReasons: allowWithValidInputs.credentialReasons,
          riskReasons: allowWithValidInputs.riskReasons,
        },
        restrictWithRisk: {
          decision: restrictWithRisk.decision,
          credentialReasons: restrictWithRisk.credentialReasons,
          riskReasons: restrictWithRisk.riskReasons,
        },
      },
    };

    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    const serviceErrors = [issuerService, analyzerService, policyService]
      .filter((service): service is ServiceHandle => Boolean(service))
      .map((service) => buildServiceError(service))
      .join("\n\n");
    console.error(serviceErrors);
    throw error;
  } finally {
    stopService(issuerService);
    stopService(analyzerService);
    stopService(policyService);
    killProcessTree(anvilProcess?.pid);
    killPorts([4100, 4200, 4300, 3000]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
