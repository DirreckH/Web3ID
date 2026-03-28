import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import {
  ACCEPTANCE_DOCS,
  createAcceptanceJsonReplacer,
  pendingAnchorCount,
  waitForAcceptance as waitFor,
} from "./acceptance-shared.js";
import { createSameRootProof, createSubIdentityLinkProof, deriveRootIdentity, listDefaultSubIdentities, SubIdentityType } from "../packages/identity/src/index.js";
import { POLICY_DEFINITIONS, POLICY_IDS } from "../packages/policy/src/index.js";
import { generateSmokeProof, runtimePaths } from "../packages/proof/scripts/runtime.js";
import { IdentityState } from "../packages/state/src/index.js";

type AcceptanceStage = "stage1" | "stage2" | "stage3" | "platform";
type ServiceHandle = {
  name: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  child: ChildProcessWithoutNullStreams;
  logs: string[];
};

const ROOT = resolve(import.meta.dirname, "..");
const STAGES = new Set<AcceptanceStage>(["stage1", "stage2", "stage3", "platform"]);
const stage = (process.argv[2] ?? "stage3") as AcceptanceStage;
if (!STAGES.has(stage)) {
  throw new Error(`Unsupported acceptance stage "${stage}". Use stage1, stage2, stage3, or platform.`);
}

const DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const ISSUER_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945384d7d0f5fb8f7c8d17826dfec353bbf4d6" as const;
const SECOND_PRIVATE_KEY = "0x5de4111afa1a4b94908f83103e0a14158d1c3f28f1c0a4e22ea39bdeef3c4f5d" as const;
const DEFAULT_HOLDER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const UNKNOWN_TARGETS = [
  "0x00000000000000000000000000000000000000f4",
  "0x00000000000000000000000000000000000000f5",
  "0x00000000000000000000000000000000000000f6",
] as const;
const GOVERNANCE_TARGET = "0x00000000000000000000000000000000000000e1" as const;
const HIGH_RISK_TARGET = "0x00000000000000000000000000000000000000c1" as const;
const MIXER_TARGET = "0x00000000000000000000000000000000000000a1" as const;
const SANCTIONED_TARGET = "0x00000000000000000000000000000000000000b1" as const;

const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const issuerAccount = privateKeyToAccount(ISSUER_PRIVATE_KEY);
const extensionAccount = privateKeyToAccount(SECOND_PRIVATE_KEY);
const rootIdentity = deriveRootIdentity(DEFAULT_HOLDER, 31337);
const subIdentities = listDefaultSubIdentities(rootIdentity);
const rwaIdentity = subIdentities.find((item) => item.type === SubIdentityType.RWA_INVEST)!;
const paymentsIdentity = subIdentities.find((item) => item.type === SubIdentityType.PAYMENTS)!;
const socialIdentity = subIdentities.find((item) => item.type === SubIdentityType.SOCIAL)!;
const anonymousIdentity = subIdentities.find((item) => item.type === SubIdentityType.ANONYMOUS_LOWRISK)!;

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
  while (lines.length > 120) {
    lines.shift();
  }
}

function resolveFoundryExecutable(name: string) {
  const candidate =
    process.platform === "win32"
      ? join(process.env.USERPROFILE ?? "", ".foundry", "bin", `${name}.exe`)
      : join(process.env.HOME ?? "", ".foundry", "bin", name);
  return existsSync(candidate) ? candidate : name;
}

function resolvePnpmCommand() {
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "pnpm"] };
  }
  return { command: "pnpm", args: [] };
}

function createPorts(seed: number) {
  return {
    rpc: seed,
    issuer: seed + 1,
    analyzer: seed + 2,
    policy: seed + 3,
  };
}

async function canBindPort(port: number) {
  return new Promise<boolean>((resolvePromise) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolvePromise(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolvePromise(true));
    });
  });
}

async function resolvePortSeed(preferredSeed: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidateSeed = preferredSeed + attempt * 1_000;
    const ports = Object.values(createPorts(candidateSeed));
    const availability = await Promise.all(ports.map((port) => canBindPort(port)));
    if (availability.every(Boolean)) {
      return candidateSeed;
    }
  }

  throw new Error(`Unable to allocate an available acceptance port block starting from ${preferredSeed}.`);
}

function defaultRpcPortSeed(inputStage: AcceptanceStage) {
  switch (inputStage) {
    case "stage1":
      return 8555;
    case "stage2":
      return 9055;
    case "stage3":
      return 9555;
    case "platform":
      return 10055;
    default:
      return 8555;
  }
}

function createUrls(ports: ReturnType<typeof createPorts>) {
  return {
    rpc: `http://127.0.0.1:${ports.rpc}`,
    issuer: `http://127.0.0.1:${ports.issuer}`,
    analyzer: `http://127.0.0.1:${ports.analyzer}`,
    policy: `http://127.0.0.1:${ports.policy}`,
  };
}

function startTrackedProcess(name: string, cwd: string, command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, {
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

async function stopTrackedProcess(handle: ServiceHandle | undefined) {
  if (!handle || handle.child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32" && handle.child.pid) {
    await runCommandCapture("taskkill", ["/PID", String(handle.child.pid), "/T", "/F"]).catch(() => undefined);
    return;
  }

  handle.child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise<boolean>((resolvePromise) => handle.child.once("exit", () => resolvePromise(true))),
    delay(5_000).then(() => false),
  ]);
  if (!exited && handle.child.exitCode === null) {
    handle.child.kill("SIGKILL");
    await new Promise((resolvePromise) => handle.child.once("exit", resolvePromise));
  }
}

function buildServiceError(handle: ServiceHandle) {
  return `${handle.name} logs:\n${handle.logs.join("\n")}`;
}

async function runCommandCapture(command: string, args: string[], input: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: input.cwd ?? ROOT,
      env: input.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
      } else {
        reject(new Error(stderr || stdout || `Command failed with code ${code}`));
      }
    });
  });
}

async function rpcRequest<T>(rpcUrl: string, method: string, params: unknown[] = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = (await response.json()) as { result?: T; error?: { message?: string } };
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `RPC ${method} failed`);
  }
  return payload.result as T;
}

async function isRpcReady(rpcUrl: string) {
  try {
    await rpcRequest(rpcUrl, "eth_chainId");
    return true;
  } catch {
    return false;
  }
}

async function waitForHealth(url: string, label: string, timeoutMs = 120_000) {
  await waitFor(label, async () => {
    try {
      const response = await fetch(url);
      return response.ok ? true : null;
    } catch {
      return null;
    }
  }, timeoutMs, 1_000);
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

async function ensureProofArtifacts() {
  const hasRuntime = [runtimePaths.packagedWasm, runtimePaths.zkeyFinal, runtimePaths.verificationKey].every((path) => existsSync(path));
  const pnpm = resolvePnpmCommand();
  if (!hasRuntime) {
    await runCommandCapture(pnpm.command, [...pnpm.args, "proof:setup"]);
    return;
  }
  await runCommandCapture(pnpm.command, [...pnpm.args, "proof:smoke"]);
}

async function startAnvil(rpcUrl: string) {
  if (await isRpcReady(rpcUrl)) {
    await rpcRequest(rpcUrl, "anvil_reset");
    return undefined;
  }

  const port = new URL(rpcUrl).port;
  const anvil = startTrackedProcess("anvil", ROOT, resolveFoundryExecutable("anvil"), ["-p", port], process.env);
  await waitFor("anvil rpc", async () => (await isRpcReady(rpcUrl)) ? true : null, 60_000, 1_000);
  await rpcRequest(rpcUrl, "anvil_reset");
  return anvil;
}

async function deployContracts(rpcUrl: string) {
  const forgeOutput = await runCommandCapture(
    resolveFoundryExecutable("forge"),
    ["script", "script/DeployLocal.s.sol:DeployLocalScript", "--rpc-url", rpcUrl, "--broadcast", "--non-interactive"],
    {
      cwd: resolve(ROOT, "contracts"),
      env: {
        ...process.env,
        PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
        TRUSTED_ISSUER: issuerAccount.address,
        USE_MOCK_GROTH16_VERIFIER: "true",
      },
    },
  );

  const matchAddress = (label: string) => {
    const match = forgeOutput.match(new RegExp(`${label}:\\s*(0x[a-fA-F0-9]{40})`));
    if (!match) {
      throw new Error(`Unable to parse ${label} from deploy output`);
    }
    return match[1] as `0x${string}`;
  };

  return {
    stateRegistry: matchAddress("IdentityStateRegistry"),
    complianceVerifier: matchAddress("ComplianceVerifier"),
    asset: matchAddress("MockRWAAsset"),
    rwaGate: matchAddress("RWAGate"),
    enterpriseGate: matchAddress("EnterpriseGate"),
    socialGate: matchAddress("SocialGate"),
  };
}

async function seedIdentityState(input: { rpcUrl: string; stateRegistryAddress: `0x${string}` }) {
  const publicClient = createPublicClient({ chain: foundry, transport: http(input.rpcUrl) });
  const walletClient = createWalletClient({ account: deployer, chain: foundry, transport: http(input.rpcUrl) });

  for (const [identityId, nextState] of [
    [rwaIdentity.identityId, 1],
    [paymentsIdentity.identityId, 1],
    [socialIdentity.identityId, 1],
    [anonymousIdentity.identityId, 2],
  ] as const) {
    const hash = await walletClient.writeContract({
      account: deployer,
      chain: undefined,
      address: input.stateRegistryAddress,
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
      args: [identityId, nextState, rootIdentity.rootId, 1n],
    } as never);
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

function buildSharedEnv(input: {
  stage: AcceptanceStage;
  urls: ReturnType<typeof createUrls>;
  tempDir: string;
  deployment: Awaited<ReturnType<typeof deployContracts>>;
}) {
  return {
    ...process.env,
    WEB3ID_DEMO_ENTRY: input.stage,
    ANVIL_RPC_URL: input.urls.rpc,
    PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
    RISK_MANAGER_PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
    ISSUER_PRIVATE_KEY: ISSUER_PRIVATE_KEY,
    ISSUER_ADDRESS: issuerAccount.address,
    ISSUER_PORT: String(new URL(input.urls.issuer).port),
    ANALYZER_PORT: String(new URL(input.urls.analyzer).port),
    POLICY_API_PORT: String(new URL(input.urls.policy).port),
    ISSUER_API_URL: input.urls.issuer,
    ANALYZER_API_URL: input.urls.analyzer,
    POLICY_API_URL: input.urls.policy,
    ISSUER_DATA_FILE: resolve(input.tempDir, "issuer-store.json"),
    ANALYZER_DATA_FILE: resolve(input.tempDir, "analyzer-store.json"),
    COMPLIANCE_VERIFIER_ADDRESS: input.deployment.complianceVerifier,
    STATE_REGISTRY_ADDRESS: input.deployment.stateRegistry,
    VITE_CHAIN_ID: "31337",
    VITE_ANVIL_RPC_URL: input.urls.rpc,
    VITE_ISSUER_API_URL: input.urls.issuer,
    VITE_ANALYZER_API_URL: input.urls.analyzer,
    VITE_POLICY_API_URL: input.urls.policy,
    VITE_PLATFORM_ENTRY: input.stage,
    VITE_COMPLIANCE_VERIFIER_ADDRESS: input.deployment.complianceVerifier,
    VITE_STATE_REGISTRY_ADDRESS: input.deployment.stateRegistry,
    VITE_MOCK_RWA_ASSET_ADDRESS: input.deployment.asset,
    VITE_RWA_GATE_ADDRESS: input.deployment.rwaGate,
    VITE_ENTERPRISE_GATE_ADDRESS: input.deployment.enterpriseGate,
    VITE_SOCIAL_GATE_ADDRESS: input.deployment.socialGate,
  };
}

function startService(name: string, cwd: string, env: NodeJS.ProcessEnv) {
  const pnpm = resolvePnpmCommand();
  return startTrackedProcess(name, cwd, pnpm.command, [...pnpm.args, "exec", "tsx", "src/server.ts"], env);
}

async function registerTreeWithIssuer(issuerUrl: string) {
  return postJson(`${issuerUrl}/identities/register-tree`, {
    rootIdentity,
    subIdentities,
  });
}

async function registerTreeWithAnalyzer(analyzerUrl: string) {
  return postJson(`${analyzerUrl}/identities/register-tree`, {
    rootIdentity,
    subIdentities,
  });
}

async function createRootBinding(analyzerUrl: string) {
  const challenge = await postJson<{ challengeId: string; challengeMessage: string }>(`${analyzerUrl}/bindings/challenge`, {
    bindingType: "root_controller",
    controllerRef: rootIdentity.primaryControllerRef,
    rootIdentityId: rootIdentity.identityId,
  });
  return postJson<any>(`${analyzerUrl}/bindings`, {
    challengeId: challenge.challengeId,
    candidateSignature: await deployer.signMessage({ message: challenge.challengeMessage }),
  });
}

async function createSubBindings(analyzerUrl: string) {
  const results: any[] = [];
  for (const subIdentity of subIdentities) {
    const challenge = await postJson<{ challengeId: string; challengeMessage: string }>(`${analyzerUrl}/bindings/challenge`, {
      bindingType: "sub_identity_link",
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: subIdentity.identityId,
    });
    const binding = await postJson<any>(`${analyzerUrl}/bindings`, {
      challengeId: challenge.challengeId,
      candidateSignature: await deployer.signMessage({ message: challenge.challengeMessage }),
      linkProof: createSubIdentityLinkProof(rootIdentity, subIdentity),
    });
    results.push(binding);
  }
  return results;
}

async function createSameRootBinding(analyzerUrl: string) {
  const challenge = await postJson<{ challengeId: string; challengeMessage: string; challengeHash: `0x${string}` }>(`${analyzerUrl}/bindings/challenge`, {
    bindingType: "same_root_extension",
    controllerRef: deriveRootIdentity(extensionAccount.address, 31337).primaryControllerRef,
    rootIdentityId: rootIdentity.identityId,
  });
  const authorizationMessage = [
    "Web3ID Same Root Authorization",
    `challengeHash: ${challenge.challengeHash}`,
    `candidateAddress: ${extensionAccount.address}`,
    `rootIdentityId: ${rootIdentity.identityId}`,
    `authorizerAddress: ${deployer.address}`,
  ].join("\n");

  return postJson<any>(`${analyzerUrl}/bindings`, {
    challengeId: challenge.challengeId,
    candidateSignature: await extensionAccount.signMessage({ message: challenge.challengeMessage }),
    sameRootProof: createSameRootProof(rootIdentity, [rwaIdentity, paymentsIdentity]),
    authorizerAddress: deployer.address,
    authorizerSignature: await deployer.signMessage({ message: authorizationMessage }),
  });
}

async function issueBundleAndPayload(input: { issuerUrl: string; verifierAddress: `0x${string}`; rwaGate: `0x${string}` }) {
  const issued = await postJson<any>(`${input.issuerUrl}/credentials/issue`, {
    holder: rootIdentity.didLikeId,
    holderIdentityId: rwaIdentity.identityId,
    subjectAddress: DEFAULT_HOLDER,
    credentialKind: "kycAml",
    claimSet: {
      amlPassed: true,
      nonUSResident: true,
      accreditedInvestor: true,
    },
    policyHints: [POLICY_IDS.RWA_BUY_V2],
    evidenceRef: "acceptance:rwa-bundle",
  });
  const bundle = issued.bundle ?? issued;
  const proof = await generateSmokeProof(DEFAULT_HOLDER);
  if (BigInt(bundle.attestation.subjectBinding).toString() !== proof.publicSignals[0]) {
    throw new Error("Smoke proof fixture does not match the issued bundle subject binding.");
  }

  return {
    bundle,
    proof,
    payload: {
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
      verifierAddress: input.verifierAddress,
      rwaGate: input.rwaGate,
    },
  };
}

async function sendTransaction(rpcUrl: string, to: `0x${string}`, data: `0x${string}` = "0x", value = 1n) {
  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account: deployer, chain: foundry, transport: http(rpcUrl) });
  const hash = await walletClient.sendTransaction({
    account: deployer,
    chain: undefined,
    to,
    data,
    value,
  } as never);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function currentBlockNumber(rpcUrl: string) {
  const value = await rpcRequest<string>(rpcUrl, "eth_blockNumber");
  return BigInt(value);
}

async function backfillExact(analyzerUrl: string, identityId: Hex, fromBlock: bigint, toBlock: bigint) {
  return postJson<any>(`${analyzerUrl}/scan/backfill`, {
    identityId,
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
  });
}

async function readOnchainSnapshot(rpcUrl: string, stateRegistryAddress: `0x${string}`, identityId: Hex) {
  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
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

async function injectExpiredReview(input: {
  analyzerDataFile: string;
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
}) {
  const raw = await readFile(input.analyzerDataFile, "utf8");
  const parsed = JSON.parse(raw) as Record<string, any>;
  parsed.aiSuggestions = parsed.aiSuggestions ?? {};
  parsed.reviewQueue = parsed.reviewQueue ?? {};

  parsed.aiSuggestions["expired-suggestion"] = {
    id: "expired-suggestion",
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    kind: "risk_hint",
    severity: "high",
    summary: "Expired review item injected for acceptance coverage.",
    evidenceRefs: ["acceptance:expired-review"],
    recommendedAction: "review",
    audit: {
      provider: "deterministic",
      model: "acceptance-fixture",
      modelVersion: "fixture-v1",
      promptVersion: "acceptance-expiry.v1",
      inputHash: `0x${"33".repeat(32)}`,
      evidenceRefs: ["acceptance:expired-review"],
      outputSummary: "Expired review item injected for acceptance coverage.",
      confidence: 0.8,
      recommendedAction: "review",
    },
    createdAt: new Date("2026-03-01T00:00:00.000Z").toISOString(),
  };
  parsed.reviewQueue["expired-review"] = {
    reviewItemId: "expired-review",
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    sourceSuggestionId: "expired-suggestion",
    status: "PENDING_REVIEW",
    createdAt: new Date("2026-03-01T00:00:00.000Z").toISOString(),
    expiresAt: new Date("2026-03-02T00:00:00.000Z").toISOString(),
    evidenceRefs: ["acceptance:expired-review"],
  };

  await writeFile(input.analyzerDataFile, JSON.stringify(parsed, null, 2) + "\n", "utf8");
}

async function runStage1Acceptance(input: {
  issuerUrl: string;
  verifierAddress: `0x${string}`;
  rwaGate: `0x${string}`;
}) {
  await registerTreeWithIssuer(input.issuerUrl);
  const { bundle, proof, payload } = await issueBundleAndPayload({
    issuerUrl: input.issuerUrl,
    verifierAddress: input.verifierAddress,
    rwaGate: input.rwaGate,
  });
  const verifyResult = await postJson<any>(`${input.issuerUrl}/credentials/verify`, { bundle });
  const context = await getJson<any>(`${input.issuerUrl}/identities/${rwaIdentity.identityId}/context`);

  return {
    rootIdentityId: rootIdentity.identityId,
    subIdentityIds: subIdentities.map((item) => item.identityId),
    credentialType: bundle.attestation.credentialType,
    proofPublicSignals: proof.publicSignals.map((value) => value.toString()),
    verifyResult,
    payloadIdentityId: payload.identityId,
    storedState: context.currentState ?? null,
    decisionCount: context.decisions?.length ?? 0,
  };
}

async function runStage2Acceptance(input: {
  issuerUrl: string;
  verifierAddress: `0x${string}`;
  rwaGate: `0x${string}`;
}) {
  const base = await runStage1Acceptance(input);
  await postJson<any>(`${input.issuerUrl}/identities/${rwaIdentity.identityId}/signals`, {
    signalKey: "new_wallet_observation",
    actor: "stage2-acceptance",
  });
  const observedContext = await getJson<any>(`${input.issuerUrl}/identities/${rwaIdentity.identityId}/context`);
  await postJson<any>(`${input.issuerUrl}/identities/${rwaIdentity.identityId}/signals`, {
    signalKey: "negative_risk_flag",
    actor: "stage2-acceptance",
  });
  const restrictedContext = await getJson<any>(`${input.issuerUrl}/identities/${rwaIdentity.identityId}/context`);
  await postJson<any>(`${input.issuerUrl}/identities/${rwaIdentity.identityId}/signals`, {
    signalKey: "good_standing",
    actor: "stage2-acceptance",
  });
  const finalContext = await getJson<any>(`${input.issuerUrl}/identities/${rwaIdentity.identityId}/context`);

  return {
    ...base,
    observedState: observedContext.currentState ?? null,
    restrictedState: restrictedContext.currentState ?? null,
    recoveredState: finalContext.currentState ?? null,
    activeConsequences: finalContext.activeConsequences?.length ?? 0,
    signalCount: finalContext.signals?.length ?? 0,
    assessmentCount: finalContext.assessments?.length ?? 0,
    finalState: finalContext.currentState ?? null,
  };
}

async function runStage3Acceptance(input: {
  stage: AcceptanceStage;
  urls: ReturnType<typeof createUrls>;
  deployment: Awaited<ReturnType<typeof deployContracts>>;
  analyzerDataFile: string;
}) {
  await registerTreeWithIssuer(input.urls.issuer);
  await registerTreeWithAnalyzer(input.urls.analyzer);

  const rootBinding = await createRootBinding(input.urls.analyzer);
  const subBindings = await createSubBindings(input.urls.analyzer);
  const sameRootBinding = await createSameRootBinding(input.urls.analyzer);

  const { bundle, payload } = await issueBundleAndPayload({
    issuerUrl: input.urls.issuer,
    verifierAddress: input.deployment.complianceVerifier,
    rwaGate: input.deployment.rwaGate,
  });

  const denyWithoutBundles = await postJson<any>(`${input.urls.policy}/policies/access/evaluate`, {
    identityId: rwaIdentity.identityId,
    policyId: POLICY_IDS.RWA_BUY_V2,
    policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
    payload,
  });
  const allowWithValidInputs = await postJson<any>(`${input.urls.policy}/policies/access/evaluate`, {
    identityId: rwaIdentity.identityId,
    policyId: POLICY_IDS.RWA_BUY_V2,
    policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
    payload,
    credentialBundles: [bundle],
  });

  const socialEventsBeforeStart = (await getJson<{ items: any[] }>(`${input.urls.analyzer}/identities/${socialIdentity.identityId}/events`)).items.length;
  await postJson(`${input.urls.analyzer}/scan/watch`, {
    action: "start",
    identityId: socialIdentity.identityId,
    recentBlocks: 4,
    pollIntervalMs: 2_000,
  });
  await sendTransaction(input.urls.rpc, GOVERNANCE_TARGET);
  const socialEventsAfterAuto = await waitFor("social watcher auto scan", async () => {
    const events = await getJson<{ items: any[] }>(`${input.urls.analyzer}/identities/${socialIdentity.identityId}/events`);
    return events.items.length > socialEventsBeforeStart ? events.items.length : null;
  });
  const watcherRefresh = await postJson<any>(`${input.urls.analyzer}/scan/watch`, {
    action: "refresh",
    identityId: socialIdentity.identityId,
    recentBlocks: 8,
  });
  const watcherStopped = await postJson<any>(`${input.urls.analyzer}/scan/watch`, {
    action: "stop",
    identityId: socialIdentity.identityId,
  });

  const paymentsChainBeforeObserved = await readOnchainSnapshot(input.urls.rpc, input.deployment.stateRegistry, paymentsIdentity.identityId);
  const observedStartBlock = await currentBlockNumber(input.urls.rpc);
  for (const target of UNKNOWN_TARGETS) {
    await sendTransaction(input.urls.rpc, target, "0x1234", 0n);
  }
  const observedEndBlock = await currentBlockNumber(input.urls.rpc);
  const observedScan = await backfillExact(input.urls.analyzer, paymentsIdentity.identityId, observedStartBlock + 1n, observedEndBlock);
  const paymentsObserved = await getJson<any>(`${input.urls.analyzer}/identities/${paymentsIdentity.identityId}/risk-context`);
  const warningDecision = await postJson<any>(`${input.urls.policy}/policies/warning/evaluate`, {
    identityId: paymentsIdentity.identityId,
    policyId: "COUNTERPARTY_WARNING_V1",
    policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
  });

  const restrictedStartBlock = await currentBlockNumber(input.urls.rpc);
  await sendTransaction(input.urls.rpc, HIGH_RISK_TARGET);
  const restrictedEndBlock = await currentBlockNumber(input.urls.rpc);
  const restrictedScan = await backfillExact(input.urls.analyzer, rwaIdentity.identityId, restrictedStartBlock + 1n, restrictedEndBlock);
  const rwaRestricted = await getJson<any>(`${input.urls.analyzer}/identities/${rwaIdentity.identityId}/risk-context`);
  const rootAfterRestricted = await getJson<any>(`${input.urls.analyzer}/identities/${rootIdentity.identityId}/risk-context`);
  const socialAfterRestricted = await getJson<any>(`${input.urls.analyzer}/identities/${socialIdentity.identityId}/risk-context`);
  const restrictWithRisk = await postJson<any>(`${input.urls.policy}/policies/access/evaluate`, {
    identityId: rwaIdentity.identityId,
    policyId: POLICY_IDS.RWA_BUY_V2,
    policyVersion: POLICY_DEFINITIONS.RWA_BUY_V2.policyVersion,
    payload,
    credentialBundles: [bundle],
  });

  const highRiskStartBlock = await currentBlockNumber(input.urls.rpc);
  await sendTransaction(input.urls.rpc, MIXER_TARGET);
  const highRiskEndBlock = await currentBlockNumber(input.urls.rpc);
  const highRiskScan = await backfillExact(input.urls.analyzer, paymentsIdentity.identityId, highRiskStartBlock + 1n, highRiskEndBlock);
  const paymentsHighRisk = await getJson<any>(`${input.urls.analyzer}/identities/${paymentsIdentity.identityId}/risk-context`);

  const reviewQueueBeforeActions = await getJson<{ items: any[] }>(`${input.urls.analyzer}/review-queue?identityId=${paymentsIdentity.identityId}`);
  const pendingPaymentsReview = await waitFor("payments review queue", async () => {
    const queue = await getJson<{ items: any[] }>(`${input.urls.analyzer}/review-queue?identityId=${paymentsIdentity.identityId}`);
    return queue.items.find((item) => item.status === "PENDING_REVIEW") ?? null;
  });
  const confirmedReview = await postJson<any>(`${input.urls.analyzer}/review-queue/${(pendingPaymentsReview as any).reviewItemId}/confirm`, {
    actor: "risk-ops",
    requestedState: IdentityState.RESTRICTED,
    reasonCode: "AI_CONFIRMED_SIGNAL",
    note: "Platform acceptance confirmation",
  });

  const pendingRwaReview = await waitFor("rwa review queue", async () => {
    const queue = await getJson<{ items: any[] }>(`${input.urls.analyzer}/review-queue?identityId=${rwaIdentity.identityId}`);
    return queue.items.find((item) => item.status === "PENDING_REVIEW") ?? null;
  });
  const dismissedReview = await postJson<any>(`${input.urls.analyzer}/review-queue/${(pendingRwaReview as any).reviewItemId}/dismiss`, {
    actor: "risk-ops",
    reason: "Handled as false positive during acceptance",
  });

  await injectExpiredReview({
    analyzerDataFile: input.analyzerDataFile,
    identityId: anonymousIdentity.identityId,
    rootIdentityId: rootIdentity.identityId,
    subIdentityId: anonymousIdentity.identityId,
  });
  await postJson(`${input.urls.analyzer}/identities/${anonymousIdentity.identityId}/recompute`, {});
  const expiredReview = await waitFor("expired review", async () => {
    const queue = await getJson<{ items: any[] }>(`${input.urls.analyzer}/review-queue?identityId=${anonymousIdentity.identityId}`);
    return queue.items.find((item) => item.reviewItemId === "expired-review" && item.status === "EXPIRED") ?? null;
  });

  const frozenStartBlock = await currentBlockNumber(input.urls.rpc);
  await sendTransaction(input.urls.rpc, SANCTIONED_TARGET);
  const frozenEndBlock = await currentBlockNumber(input.urls.rpc);
  const frozenScan = await backfillExact(input.urls.analyzer, paymentsIdentity.identityId, frozenStartBlock + 1n, frozenEndBlock);
  const paymentsFrozen = await getJson<any>(`${input.urls.analyzer}/identities/${paymentsIdentity.identityId}/risk-context`);
  const manualRelease = await postJson<any>(`${input.urls.analyzer}/manual-release`, {
    identityId: paymentsIdentity.identityId,
    actor: "risk-ops",
    reasonCode: "MANUAL_RELEASE_REVIEWED",
    evidenceRefs: ["acceptance:manual-release"],
    note: "Manual release applied during acceptance coverage.",
  });
  const paymentsRecovered = manualRelease;

  const flushResult = await postJson<any>(`${input.urls.analyzer}/anchors/flush`, {});
  const auditExport = await getJson<any>(`${input.urls.analyzer}/identities/${paymentsIdentity.identityId}/audit/export`);
  const paymentsChainAfter = await readOnchainSnapshot(input.urls.rpc, input.deployment.stateRegistry, paymentsIdentity.identityId);
  const rwaChainAfter = await readOnchainSnapshot(input.urls.rpc, input.deployment.stateRegistry, rwaIdentity.identityId);

  const missingSignature = await postRaw(`${input.urls.analyzer}/bindings`, { challengeId: "missing-signature" });
  const wrongSignerChallenge = await postJson<any>(`${input.urls.analyzer}/bindings/challenge`, {
    bindingType: "root_controller",
    controllerRef: rootIdentity.primaryControllerRef,
    rootIdentityId: rootIdentity.identityId,
  });
  const wrongSigner = await postRaw(`${input.urls.analyzer}/bindings`, {
    challengeId: wrongSignerChallenge.challengeId,
    candidateSignature: await extensionAccount.signMessage({ message: wrongSignerChallenge.challengeMessage }),
  });
  const sameRootChallenge = await postJson<any>(`${input.urls.analyzer}/bindings/challenge`, {
    bindingType: "same_root_extension",
    controllerRef: deriveRootIdentity(extensionAccount.address, 31337).primaryControllerRef,
    rootIdentityId: rootIdentity.identityId,
  });
  const sameRootNoAuthorizer = await postRaw(`${input.urls.analyzer}/bindings`, {
    challengeId: sameRootChallenge.challengeId,
    candidateSignature: await extensionAccount.signMessage({ message: sameRootChallenge.challengeMessage }),
    sameRootProof: createSameRootProof(rootIdentity, [rwaIdentity, paymentsIdentity]),
  });

  return {
    entry: input.stage,
    bindings: {
      rootBindingId: rootBinding.bindingId,
      subBindingCount: subBindings.length,
      sameRootBindingId: sameRootBinding.bindingId,
      missingSignature,
      wrongSigner,
      sameRootNoAuthorizer,
    },
    watcher: {
      eventsBeforeStart: socialEventsBeforeStart,
      eventsAfterAuto: socialEventsAfterAuto,
      refreshInserted: watcherRefresh.inserted ?? 0,
      stopItemCount: watcherStopped.items?.length ?? 0,
    },
    accessPolicy: {
      denyWithoutBundles: denyWithoutBundles.decision,
      allowWithValidInputs: allowWithValidInputs.decision,
      restrictWithRisk: restrictWithRisk.decision,
    },
    warningPolicy: {
      decision: warningDecision.decision,
      warnings: warningDecision.warnings ?? [],
    },
    backfill: {
      observedScan,
      restrictedScan,
      highRiskScan,
      frozenScan,
      recoveryScan: "manual-release-floor",
    },
    propagation: {
      rootStoredState: rootAfterRestricted.summary?.storedState ?? null,
      rootEffectiveState: rootAfterRestricted.summary?.effectiveState ?? null,
      socialEffectiveState: socialAfterRestricted.summary?.effectiveState ?? null,
      rwaStoredState: rwaRestricted.summary?.storedState ?? null,
      rwaEffectiveState: rwaRestricted.summary?.effectiveState ?? null,
    },
    reviewQueue: {
      pendingBeforeActions: reviewQueueBeforeActions.items.length,
      confirmedStatus: confirmedReview.reviewQueue?.find((item: any) => item.reviewItemId === (pendingPaymentsReview as any).reviewItemId)?.status ?? "UNKNOWN",
      dismissedStatus: dismissedReview.reviewQueue?.find((item: any) => item.reviewItemId === (pendingRwaReview as any).reviewItemId)?.status ?? "UNKNOWN",
      expiredStatus: (expiredReview as any).status,
    },
    manualRelease: {
      frozenStoredState: paymentsFrozen.summary?.storedState ?? null,
      releasedStoredState: manualRelease.summary?.storedState ?? null,
      releaseFloorState: manualRelease.summary?.manualReleaseWindow?.floorState ?? null,
      recoveredStoredState: paymentsRecovered.summary?.storedState ?? null,
    },
    riskContext: {
      paymentsObservedStoredState: paymentsObserved.summary?.storedState ?? null,
      paymentsObservedEffectiveState: paymentsObserved.summary?.effectiveState ?? null,
      paymentsHighRiskStoredState: paymentsHighRisk.summary?.storedState ?? null,
      paymentsRecoveredEffectiveState: paymentsRecovered.summary?.effectiveState ?? null,
      pendingAnchors: pendingAnchorCount(paymentsObserved),
    },
    anchors: {
      flushResult,
      paymentsChainBeforeObserved: paymentsChainBeforeObserved.state,
      paymentsChainAfter: paymentsChainAfter.state,
      rwaChainAfter: rwaChainAfter.state,
    },
    auditExport: {
      recordCount: auditExport.records?.length ?? 0,
      lastActions: (auditExport.records ?? []).slice(-5).map((record: any) => record.action),
    },
  };
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), `web3id-${stage}-acceptance-`));
  mkdirSync(dirname(resolve(tempDir, "issuer-store.json")), { recursive: true });
  const preferredPortSeed = Number(process.env.WEB3ID_ACCEPTANCE_RPC_PORT ?? defaultRpcPortSeed(stage));
  const resolvedPortSeed = await resolvePortSeed(preferredPortSeed);
  const ports = createPorts(resolvedPortSeed);
  const urls = createUrls(ports);
  const services: ServiceHandle[] = [];

  try {
    const anvil = await startAnvil(urls.rpc);
    if (anvil) {
      services.push(anvil);
    }

    await ensureProofArtifacts();
    const deployment = await deployContracts(urls.rpc);
    await seedIdentityState({ rpcUrl: urls.rpc, stateRegistryAddress: deployment.stateRegistry });
    const sharedEnv = buildSharedEnv({ stage, urls, tempDir, deployment });

    const issuerService = startService("issuer-service", resolve(ROOT, "apps/issuer-service"), sharedEnv);
    services.push(issuerService);
    await waitForHealth(`${urls.issuer}/health`, "issuer-service");

    let result: Record<string, unknown>;
    if (stage === "stage1") {
      result = await runStage1Acceptance({
        issuerUrl: urls.issuer,
        verifierAddress: deployment.complianceVerifier,
        rwaGate: deployment.rwaGate,
      });
    } else if (stage === "stage2") {
      result = await runStage2Acceptance({
        issuerUrl: urls.issuer,
        verifierAddress: deployment.complianceVerifier,
        rwaGate: deployment.rwaGate,
      });
    } else {
      const analyzerService = startService("analyzer-service", resolve(ROOT, "apps/analyzer-service"), sharedEnv);
      const policyService = startService("policy-api", resolve(ROOT, "apps/policy-api"), sharedEnv);
      services.push(analyzerService, policyService);
      await waitForHealth(`${urls.analyzer}/health`, "analyzer-service");
      await waitForHealth(`${urls.policy}/health`, "policy-api");
      result = await runStage3Acceptance({
        stage,
        urls,
        deployment,
        analyzerDataFile: resolve(tempDir, "analyzer-store.json"),
      });
    }

    console.log(JSON.stringify({
      stage,
      urls,
      docs: ACCEPTANCE_DOCS,
      result,
    }, createAcceptanceJsonReplacer(), 2));
  } catch (error) {
    const logDump = services.map((service) => buildServiceError(service)).join("\n\n");
    if (logDump) {
      console.error(logDump);
    }
    throw error;
  } finally {
    for (const service of [...services].reverse()) {
      await stopTrackedProcess(service);
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
