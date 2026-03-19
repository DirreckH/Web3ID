import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { waitForAcceptance as waitFor } from "../../scripts/acceptance-shared.js";
import {
  createSameRootProof,
  createSubIdentityLinkProof,
  deriveRootIdentity,
  listDefaultSubIdentities,
  SubIdentityType,
} from "../../packages/identity/src/index.js";
import { POLICY_DEFINITIONS, POLICY_IDS } from "../../packages/policy/src/index.js";
import { generateSmokeProof, runtimePaths } from "../../packages/proof/scripts/runtime.js";
import { IdentityState } from "../../packages/state/src/index.js";

const ROOT = resolve(import.meta.dirname, "..", "..");
const DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const ISSUER_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945384d7d0f5fb8f7c8d17826dfec353bbf4d6" as const;
const SECOND_PRIVATE_KEY = "0x5de4111afa1a4b94908f83103e0a14158d1c3f28f1c0a4e22ea39bdeef3c4f5d" as const;
const DEFAULT_HOLDER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

export const DEMO_TARGETS = {
  governance: "0x00000000000000000000000000000000000000e1" as const,
  highRisk: "0x00000000000000000000000000000000000000c1" as const,
  mixer: "0x00000000000000000000000000000000000000a1" as const,
  sanctioned: "0x00000000000000000000000000000000000000b1" as const,
  trustedDefi: [
    "0x00000000000000000000000000000000000000d1",
    "0x00000000000000000000000000000000000000d2",
  ] as const,
  unknownContracts: [
    "0x00000000000000000000000000000000000000f4",
    "0x00000000000000000000000000000000000000f5",
    "0x00000000000000000000000000000000000000f6",
  ] as const,
};

type ServiceHandle = {
  name: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  child: ChildProcessWithoutNullStreams;
  logs: string[];
};

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

export type ServiceHarness = {
  tempDir: string;
  urls: {
    rpc: string;
    issuer: string;
    analyzer: string;
    policy: string;
  };
  deployment: {
    stateRegistry: `0x${string}`;
    complianceVerifier: `0x${string}`;
    asset: `0x${string}`;
    rwaGate: `0x${string}`;
    enterpriseGate: `0x${string}`;
    socialGate: `0x${string}`;
  };
  rootIdentity: typeof rootIdentity;
  subIdentities: typeof subIdentities;
  rwaIdentity: typeof rwaIdentity;
  paymentsIdentity: typeof paymentsIdentity;
  socialIdentity: typeof socialIdentity;
  anonymousIdentity: typeof anonymousIdentity;
  stop: () => Promise<void>;
  registerTree: () => Promise<void>;
  createBindings: () => Promise<void>;
  issueRwaBundleAndPayload: () => Promise<{ bundle: any; payload: any; proof: any }>;
  currentBlockNumber: () => Promise<bigint>;
  sendTransaction: (to: `0x${string}`, data?: `0x${string}`, value?: bigint) => Promise<`0x${string}`>;
  backfillExact: (identityId: Hex, fromBlock: bigint, toBlock: bigint) => Promise<any>;
  getJson: <T>(url: string) => Promise<T>;
  postJson: <T>(url: string, body: unknown) => Promise<T>;
  postRaw: (url: string, body: unknown) => Promise<{ status: number; body: any }>;
  readOnchainSnapshot: (identityId: Hex) => Promise<any>;
  injectExpiredReview: (identityId: Hex, rootIdentityId: Hex, subIdentityId?: Hex) => Promise<void>;
};

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
    issuer: seed + 100,
    analyzer: seed + 200,
    policy: seed + 300,
  };
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

function buildSharedEnv(input: { urls: ReturnType<typeof createUrls>; tempDir: string; deployment: Awaited<ReturnType<typeof deployContracts>> }) {
  return {
    ...process.env,
    WEB3ID_DEMO_ENTRY: "platform",
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
    VITE_PLATFORM_ENTRY: "platform",
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

export async function createServiceHarness(portSeed = 13055): Promise<ServiceHarness> {
  const tempDir = await mkdtemp(join(tmpdir(), "web3id-service-integration-"));
  mkdirSync(dirname(resolve(tempDir, "issuer-store.json")), { recursive: true });
  const ports = createPorts(portSeed);
  const urls = createUrls(ports);
  const services: ServiceHandle[] = [];

  const anvil = await startAnvil(urls.rpc);
  if (anvil) {
    services.push(anvil);
  }
  await ensureProofArtifacts();
  const deployment = await deployContracts(urls.rpc);
  await seedIdentityState({ rpcUrl: urls.rpc, stateRegistryAddress: deployment.stateRegistry });
  const env = buildSharedEnv({ urls, tempDir, deployment });
  const issuerService = startService("issuer-service", resolve(ROOT, "apps/issuer-service"), env);
  const analyzerService = startService("analyzer-service", resolve(ROOT, "apps/analyzer-service"), env);
  const policyService = startService("policy-api", resolve(ROOT, "apps/policy-api"), env);
  services.push(issuerService, analyzerService, policyService);
  await waitForHealth(`${urls.issuer}/health`, "issuer-service");
  await waitForHealth(`${urls.analyzer}/health`, "analyzer-service");
  await waitForHealth(`${urls.policy}/health`, "policy-api");

  return {
    tempDir,
    urls,
    deployment,
    rootIdentity,
    subIdentities,
    rwaIdentity,
    paymentsIdentity,
    socialIdentity,
    anonymousIdentity,
    stop: async () => {
      for (const service of [...services].reverse()) {
        await stopTrackedProcess(service);
      }
      await rm(tempDir, { recursive: true, force: true });
    },
    registerTree: async () => {
      await postJson(`${urls.issuer}/identities/register-tree`, { rootIdentity, subIdentities });
      await postJson(`${urls.analyzer}/identities/register-tree`, { rootIdentity, subIdentities });
    },
    createBindings: async () => {
      const rootChallenge = await postJson<{ challengeId: string; challengeMessage: string }>(`${urls.analyzer}/bindings/challenge`, {
        bindingType: "root_controller",
        candidateAddress: rootIdentity.controllerAddress,
        rootIdentityId: rootIdentity.identityId,
      });
      await postJson(`${urls.analyzer}/bindings`, {
        challengeId: rootChallenge.challengeId,
        candidateSignature: await deployer.signMessage({ message: rootChallenge.challengeMessage }),
      });
      for (const subIdentity of subIdentities) {
        const challenge = await postJson<{ challengeId: string; challengeMessage: string }>(`${urls.analyzer}/bindings/challenge`, {
          bindingType: "sub_identity_link",
          candidateAddress: rootIdentity.controllerAddress,
          rootIdentityId: rootIdentity.identityId,
          subIdentityId: subIdentity.identityId,
        });
        await postJson(`${urls.analyzer}/bindings`, {
          challengeId: challenge.challengeId,
          candidateSignature: await deployer.signMessage({ message: challenge.challengeMessage }),
          linkProof: createSubIdentityLinkProof(rootIdentity, subIdentity),
        });
      }
      const sameRootChallenge = await postJson<{ challengeId: string; challengeMessage: string; challengeHash: `0x${string}` }>(`${urls.analyzer}/bindings/challenge`, {
        bindingType: "same_root_extension",
        candidateAddress: extensionAccount.address,
        rootIdentityId: rootIdentity.identityId,
      });
      const authorizationMessage = [
        "Web3ID Same Root Authorization",
        `challengeHash: ${sameRootChallenge.challengeHash}`,
        `candidateAddress: ${extensionAccount.address}`,
        `rootIdentityId: ${rootIdentity.identityId}`,
        `authorizerAddress: ${deployer.address}`,
      ].join("\n");
      await postJson(`${urls.analyzer}/bindings`, {
        challengeId: sameRootChallenge.challengeId,
        candidateSignature: await extensionAccount.signMessage({ message: sameRootChallenge.challengeMessage }),
        sameRootProof: createSameRootProof(rootIdentity, [rwaIdentity, paymentsIdentity]),
        authorizerAddress: deployer.address,
        authorizerSignature: await deployer.signMessage({ message: authorizationMessage }),
      });
    },
    issueRwaBundleAndPayload: async () => {
      const issued = await postJson<any>(`${urls.issuer}/credentials/issue`, {
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
        evidenceRef: "integration:rwa-bundle",
      });
      const bundle = issued.bundle ?? issued;
      const proof = await generateSmokeProof(DEFAULT_HOLDER);
      const payload = {
        identityId: rwaIdentity.identityId,
        credentialAttestations: [bundle.attestation],
        zkProof: {
          proofPoints: proof.proofPoints.map((value: bigint) => value.toString()),
          publicSignals: proof.publicSignals.map((value: bigint) => value.toString()),
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
      return { bundle, payload, proof };
    },
    currentBlockNumber: async () => {
      const blockNumber = await rpcRequest<string>(urls.rpc, "eth_blockNumber");
      return BigInt(blockNumber);
    },
    sendTransaction: async (to, data = "0x", value = 1n) => {
      const publicClient = createPublicClient({ chain: foundry, transport: http(urls.rpc) });
      const walletClient = createWalletClient({ account: deployer, chain: foundry, transport: http(urls.rpc) });
      const hash = await walletClient.sendTransaction({
        account: deployer,
        to,
        data,
        value,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    backfillExact: async (identityId, fromBlock, toBlock) => {
      return postJson(`${urls.analyzer}/scan/backfill`, {
        identityId,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
      });
    },
    getJson,
    postJson,
    postRaw,
    readOnchainSnapshot: async (identityId: Hex) => {
      const publicClient = createPublicClient({ chain: foundry, transport: http(urls.rpc) });
      const snapshot = await publicClient.readContract({
        address: deployment.stateRegistry,
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
    },
    injectExpiredReview: async (identityId: Hex, rootIdentityId: Hex, subIdentityId?: Hex) => {
      const analyzerDataFile = resolve(tempDir, "analyzer-store.json");
      const raw = await readFile(analyzerDataFile, "utf8");
      const parsed = JSON.parse(raw) as Record<string, any>;
      parsed.aiSuggestions = parsed.aiSuggestions ?? {};
      parsed.reviewQueue = parsed.reviewQueue ?? {};
      parsed.aiSuggestions["expired-suggestion"] = {
        id: "expired-suggestion",
        identityId,
        rootIdentityId,
        subIdentityId,
        kind: "risk_hint",
        severity: "high",
        summary: "Expired review item injected for integration coverage.",
        evidenceRefs: ["integration:expired-review"],
        recommendedAction: "review",
        audit: {
          provider: "deterministic",
          model: "integration-fixture",
          modelVersion: "fixture-v1",
          promptVersion: "integration-expiry.v1",
          inputHash: `0x${"33".repeat(32)}`,
          evidenceRefs: ["integration:expired-review"],
          outputSummary: "Expired review item injected for integration coverage.",
          confidence: 0.8,
          recommendedAction: "review",
        },
        createdAt: new Date("2026-03-01T00:00:00.000Z").toISOString(),
      };
      parsed.reviewQueue["expired-review"] = {
        reviewItemId: "expired-review",
        identityId,
        rootIdentityId,
        subIdentityId,
        sourceSuggestionId: "expired-suggestion",
        status: "PENDING_REVIEW",
        createdAt: new Date("2026-03-01T00:00:00.000Z").toISOString(),
        expiresAt: new Date("2026-03-02T00:00:00.000Z").toISOString(),
        evidenceRefs: ["integration:expired-review"],
      };
      await writeFile(analyzerDataFile, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    },
  };
}
