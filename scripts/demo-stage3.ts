import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { createSubIdentityLinkProof, deriveRootIdentity, listDefaultSubIdentities, SubIdentityType } from "../packages/identity/src/index.js";
import { printDemoSummary } from "./demo-summary.ts";

const ROOT = process.cwd();
const DEMO_ENTRY = process.env.WEB3ID_DEMO_ENTRY ?? "stage3";
const RPC_URL = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
const DEPLOYER_PRIVATE_KEY =
  (process.env.PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;
const ISSUER_PRIVATE_KEY =
  (process.env.ISSUER_PRIVATE_KEY ??
    "0x59c6995e998f97a5a0044966f0945384d7d0f5fb8f7c8d17826dfec353bbf4d6") as `0x${string}`;
const DEFAULT_HOLDER =
  (process.env.DEFAULT_HOLDER ?? "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") as `0x${string}`;
const ISSUER_DATA_FILE_INPUT = process.env.ISSUER_DATA_FILE ?? ".web3id/issuer-store.demo.json";
const ANALYZER_DATA_FILE_INPUT = process.env.ANALYZER_DATA_FILE ?? ".web3id/analyzer-store.demo.json";
const ANALYZER_API_URL = "http://127.0.0.1:4200";
const POLICY_API_URL = "http://127.0.0.1:4300";

function resolveDataFile(pathLike: string) {
  return isAbsolute(pathLike) ? pathLike : resolve(ROOT, pathLike);
}

const ISSUER_DATA_FILE = resolveDataFile(ISSUER_DATA_FILE_INPUT);
const ANALYZER_DATA_FILE = resolveDataFile(ANALYZER_DATA_FILE_INPUT);

const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const issuer = privateKeyToAccount(ISSUER_PRIVATE_KEY);

const processes: Array<ReturnType<typeof spawn>> = [];

function resolveExecutable(name: string) {
  const pathCandidates = process.platform === "win32"
    ? [join(process.env.USERPROFILE ?? "", ".foundry", "bin", `${name}.exe`)]
    : [join(process.env.HOME ?? "", ".foundry", "bin", name)];

  for (const candidate of pathCandidates) {
    if (!candidate) {
      continue;
    }
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === "win32" ? `${name}.exe` : name;
}

function spawnCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env, stdio: "inherit" | "pipe" = "inherit") {
  const childStdio: any = stdio === "pipe"
    ? ["ignore", "pipe", "pipe"]
    : ["ignore", "inherit", "inherit"];

  const child = spawn(command, args, {
    cwd: ROOT,
    env,
    stdio: childStdio,
    shell: false,
  });
  processes.push(child);
  return child;
}

function resolvePnpmCommand() {
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "pnpm"] };
  }

  return { command: "pnpm", args: [] };
}

async function isRpcReady() {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function rpcRequest<T>(method: string, params: unknown[] = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed for ${method}`);
  }

  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (payload.error) {
    throw new Error(payload.error.message ?? `RPC request failed for ${method}`);
  }

  return payload.result as T;
}

async function ensureAnvil() {
  if (await isRpcReady()) {
    return;
  }

  const anvil = resolveExecutable("anvil");
  const child = spawnCommand(anvil, [], process.env, "inherit");
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await isRpcReady()) {
      return;
    }
    if (child.exitCode !== null) {
      throw new Error("anvil exited before RPC became ready");
    }
    await delay(1000);
  }
  throw new Error("Timed out waiting for anvil");
}

async function resetLocalAnvilIfNeeded() {
  const chainId = await rpcRequest<string>("eth_chainId");
  if (chainId !== "0x7a69") {
    return;
  }

  await rpcRequest("anvil_reset");
}

async function runCommandCapture(command: string, args: string[], env: NodeJS.ProcessEnv, cwd = ROOT) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || stdout || `Command failed with code ${code}`));
      }
    });
  });
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed (${response.status}): ${url}${errorText ? ` -> ${errorText}` : ""}`);
  }
  return response.json() as Promise<T>;
}

async function waitForHealth(url: string, label: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function registerTrees(rootIdentity: ReturnType<typeof deriveRootIdentity>) {
  const subIdentities = listDefaultSubIdentities(rootIdentity);
  await postJson(`${process.env.ISSUER_API_URL ?? "http://127.0.0.1:4100"}/identities/register-tree`, {
    rootIdentity,
    subIdentities,
  });
  await postJson(`${ANALYZER_API_URL}/identities/register-tree`, {
    rootIdentity,
    subIdentities,
  });
  return subIdentities;
}

async function bindAnalyzerIdentities(rootIdentity: ReturnType<typeof deriveRootIdentity>, subIdentities: ReturnType<typeof listDefaultSubIdentities>) {
  const rootChallenge = await postJson<{ challengeId: string; challengeMessage: string }>(`${ANALYZER_API_URL}/bindings/challenge`, {
    bindingType: "root_controller",
    candidateAddress: rootIdentity.controllerAddress,
    rootIdentityId: rootIdentity.identityId,
  });
  const rootSignature = await deployer.signMessage({ message: rootChallenge.challengeMessage });
  await postJson(`${ANALYZER_API_URL}/bindings`, {
    challengeId: rootChallenge.challengeId,
    candidateSignature: rootSignature,
  });

  for (const subIdentity of subIdentities) {
    const challenge = await postJson<{ challengeId: string; challengeMessage: string }>(`${ANALYZER_API_URL}/bindings/challenge`, {
      bindingType: "sub_identity_link",
      candidateAddress: rootIdentity.controllerAddress,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: subIdentity.identityId,
    });
    const signature = await deployer.signMessage({ message: challenge.challengeMessage });
    await postJson(`${ANALYZER_API_URL}/bindings`, {
      challengeId: challenge.challengeId,
      candidateSignature: signature,
      linkProof: createSubIdentityLinkProof(rootIdentity, subIdentity),
    });
  }
}

async function seedPhase3Transactions() {
  const holderWallet = createWalletClient({
    account: deployer,
    chain: foundry,
    transport: http(RPC_URL),
  });
  for (const to of [
    "0x00000000000000000000000000000000000000d1",
    "0x00000000000000000000000000000000000000e1",
  ] as const) {
    await holderWallet.sendTransaction({
      account: deployer,
      chain: undefined,
      to,
      value: 1n,
    } as any);
  }
}

async function deployContracts() {
  const output = await runCommandCapture(
    resolveExecutable("forge"),
    ["script", "script/DeployLocal.s.sol:DeployLocalScript", "--rpc-url", RPC_URL, "--broadcast", "--non-interactive"],
    {
      ...process.env,
    PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
    TRUSTED_ISSUER: issuer.address,
    USE_MOCK_GROTH16_VERIFIER: "true",
  },
    join(ROOT, "contracts"),
  );

  const matchAddress = (label: string) => {
    const match = output.match(new RegExp(`${label}:\\s*(0x[a-fA-F0-9]{40})`));
    if (!match) {
      throw new Error(`Unable to parse ${label} from deployment output`);
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

async function ensureProofArtifacts() {
  const packagedArtifactsDir = join(ROOT, "packages", "proof", "artifacts");
  const packagedWasm = join(packagedArtifactsDir, "web3id_compliance_js", "web3id_compliance.wasm");
  const packagedZkey = join(packagedArtifactsDir, "web3id-compliance_final.zkey");
  const packagedVk = join(packagedArtifactsDir, "verification_key.json");
  const frontendCircuitsDir = join(ROOT, "apps", "frontend", "public", "circuits");
  const frontendWasm = join(frontendCircuitsDir, "web3id-compliance.wasm");
  const frontendZkey = join(frontendCircuitsDir, "web3id-compliance_final.zkey");
  const frontendVk = join(frontendCircuitsDir, "verification_key.json");

  const hasPackagedRuntime = [packagedWasm, packagedZkey, packagedVk].every((path) => existsSync(path));
  if (hasPackagedRuntime) {
    mkdirSync(frontendCircuitsDir, { recursive: true });
    if (!existsSync(frontendWasm)) {
      copyFileSync(packagedWasm, frontendWasm);
    }
    if (!existsSync(frontendZkey)) {
      copyFileSync(packagedZkey, frontendZkey);
    }
    if (!existsSync(frontendVk)) {
      copyFileSync(packagedVk, frontendVk);
    }

    if ([frontendWasm, frontendZkey, frontendVk].every((path) => existsSync(path))) {
      console.log("Proof setup: reused cached runtime artifacts");
      return;
    }
  }

  const pnpm = resolvePnpmCommand();
  await runCommandCapture(pnpm.command, [...pnpm.args, "proof:setup"], process.env);
}

async function seedIdentityState(stateRegistryAddress: `0x${string}`) {
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account: deployer,
    chain: foundry,
    transport: http(RPC_URL),
  });

  const root = deriveRootIdentity(DEFAULT_HOLDER);
  const [rwa, payments, social, anonymous] = listDefaultSubIdentities(root);

  for (const [identityId, nextState] of [
    [rwa.identityId, 1],
    [payments.identityId, 1],
    [social.identityId, 1],
    [anonymous.identityId, 2],
  ] as const) {
    const hash = await walletClient.writeContract({
      account: deployer,
      chain: undefined,
      address: stateRegistryAddress,
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
      args: [identityId, nextState, root.rootId, 1n],
    } as any);
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

async function main() {
  await ensureAnvil();
  await resetLocalAnvilIfNeeded();
  rmSync(ISSUER_DATA_FILE, { force: true });
  rmSync(ANALYZER_DATA_FILE, { force: true });
  const deployment = await deployContracts();
  await seedIdentityState(deployment.stateRegistry);
  await ensureProofArtifacts();

  const sharedEnv = {
    ...process.env,
    WEB3ID_DEMO_ENTRY: DEMO_ENTRY,
    ANVIL_RPC_URL: RPC_URL,
    PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
    RISK_MANAGER_PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
    ISSUER_PRIVATE_KEY: ISSUER_PRIVATE_KEY,
    ISSUER_ADDRESS: issuer.address,
    ISSUER_DATA_FILE: ISSUER_DATA_FILE,
    ANALYZER_DATA_FILE: ANALYZER_DATA_FILE,
    ANALYZER_API_URL: ANALYZER_API_URL,
    POLICY_API_URL: POLICY_API_URL,
    VITE_ANALYZER_API_URL: ANALYZER_API_URL,
    VITE_POLICY_API_URL: POLICY_API_URL,
    COMPLIANCE_VERIFIER_ADDRESS: deployment.complianceVerifier,
    STATE_REGISTRY_ADDRESS: deployment.stateRegistry,
    VITE_CHAIN_ID: "31337",
    VITE_ANVIL_RPC_URL: RPC_URL,
    VITE_PLATFORM_ENTRY: process.env.VITE_PLATFORM_ENTRY ?? DEMO_ENTRY,
    VITE_COMPLIANCE_VERIFIER_ADDRESS: deployment.complianceVerifier,
    VITE_STATE_REGISTRY_ADDRESS: deployment.stateRegistry,
    VITE_MOCK_RWA_ASSET_ADDRESS: deployment.asset,
    VITE_RWA_GATE_ADDRESS: deployment.rwaGate,
    VITE_ENTERPRISE_GATE_ADDRESS: deployment.enterpriseGate,
    VITE_SOCIAL_GATE_ADDRESS: deployment.socialGate,
  };
  const pnpm = resolvePnpmCommand();

  spawnCommand(pnpm.command, [...pnpm.args, "--filter", "@web3id/issuer-service", "dev"], sharedEnv, "inherit");
  spawnCommand(pnpm.command, [...pnpm.args, "--filter", "@web3id/analyzer-service", "dev"], sharedEnv, "inherit");
  spawnCommand(pnpm.command, [...pnpm.args, "--filter", "@web3id/policy-api", "dev"], sharedEnv, "inherit");
  spawnCommand(pnpm.command, [...pnpm.args, "--filter", "@web3id/frontend", "dev"], sharedEnv, "inherit");

  await waitForHealth("http://127.0.0.1:4100/health", "issuer-service");
  await waitForHealth(`${ANALYZER_API_URL}/health`, "analyzer-service");
  await waitForHealth(`${POLICY_API_URL}/health`, "policy-api");

  const rootIdentity = deriveRootIdentity(DEFAULT_HOLDER);
  const subIdentities = await registerTrees(rootIdentity);
  const rwaIdentity = subIdentities.find((item) => item.type === SubIdentityType.RWA_INVEST) ?? subIdentities[0];
  await bindAnalyzerIdentities(rootIdentity, subIdentities);
  await seedPhase3Transactions();
  await postJson(`${ANALYZER_API_URL}/scan/backfill`, {
    identityId: rwaIdentity.identityId,
    recentBlocks: 32,
  });
  await postJson(`${ANALYZER_API_URL}/anchors/flush`, {});

  printDemoSummary({
    entry: DEMO_ENTRY as "stage3" | "platform",
    holder: DEFAULT_HOLDER,
    proofStatus: "pnpm proof:setup completed",
    services: ["anvil", "contracts", "issuer-service", "analyzer-service", "policy-api", "frontend", "proof runtime"],
    urls: [
      { label: "Issuer service", value: "http://127.0.0.1:4100" },
      { label: "Analyzer API", value: ANALYZER_API_URL },
      { label: "Policy API", value: POLICY_API_URL },
      { label: "Frontend", value: "http://127.0.0.1:3000" },
    ],
    seededData: [
      "issuer and analyzer stores reset",
      "root + default sub identities registered and bound",
      "trusted defi and governance transactions replayed",
      "initial backfill and anchor flush completed",
    ],
    docs: [
      "docs/WHAT_IS_WEB3ID.md",
      "docs/PLATFORM_BASELINE.md",
      "docs/DEMO_MATRIX.md",
      "docs/PLATFORM_CONSOLE.md",
      "docs/OPERATOR_WORKFLOWS.md",
    ],
  });

  await new Promise<void>((resolve) => {
    const shutdown = () => {
      for (const child of processes) {
        child.kill();
      }
      resolve();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

main().catch((error) => {
  console.error(error);
  for (const child of processes) {
    child.kill();
  }
  process.exitCode = 1;
});
