import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { deriveRootIdentity, deriveSubIdentity, SubIdentityType } from "../packages/identity/src/index.js";

const ROOT = process.cwd();
const RPC_URL = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
const DEPLOYER_PRIVATE_KEY =
  (process.env.PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;
const ISSUER_PRIVATE_KEY =
  (process.env.ISSUER_PRIVATE_KEY ??
    "0x59c6995e998f97a5a0044966f0945384d7d0f5fb8f7c8d17826dfec353bbf4d6") as `0x${string}`;
const DEFAULT_HOLDER =
  (process.env.DEFAULT_HOLDER ?? "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") as `0x${string}`;
const ISSUER_DATA_FILE = process.env.ISSUER_DATA_FILE ?? ".web3id/issuer-store.demo.json";

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
  const childStdio = stdio === "pipe"
    ? ["ignore", "pipe", "pipe"] as const
    : ["ignore", "inherit", "inherit"] as const;

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
  const rwa = deriveSubIdentity({ rootIdentity: root, scope: "rwa-invest", type: SubIdentityType.RWA_INVEST });
  const payments = deriveSubIdentity({ rootIdentity: root, scope: "payments", type: SubIdentityType.PAYMENTS });
  const social = deriveSubIdentity({ rootIdentity: root, scope: "social", type: SubIdentityType.SOCIAL });
  const anonymous = deriveSubIdentity({ rootIdentity: root, scope: "anonymous-lowrisk", type: SubIdentityType.ANONYMOUS_LOWRISK });

  for (const [identityId, nextState] of [
    [rwa.identityId, 1],
    [payments.identityId, 1],
    [social.identityId, 1],
    [anonymous.identityId, 2],
  ] as const) {
    const hash = await walletClient.writeContract({
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
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

async function main() {
  await ensureAnvil();
  await resetLocalAnvilIfNeeded();
  rmSync(join(ROOT, ISSUER_DATA_FILE), { force: true });
  const deployment = await deployContracts();
  await seedIdentityState(deployment.stateRegistry);
  await ensureProofArtifacts();

  const sharedEnv = {
    ...process.env,
    ANVIL_RPC_URL: RPC_URL,
    PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
    RISK_MANAGER_PRIVATE_KEY: DEPLOYER_PRIVATE_KEY,
    ISSUER_PRIVATE_KEY: ISSUER_PRIVATE_KEY,
    ISSUER_ADDRESS: issuer.address,
    ISSUER_DATA_FILE: ISSUER_DATA_FILE,
    COMPLIANCE_VERIFIER_ADDRESS: deployment.complianceVerifier,
    STATE_REGISTRY_ADDRESS: deployment.stateRegistry,
    VITE_CHAIN_ID: "31337",
    VITE_ANVIL_RPC_URL: RPC_URL,
    VITE_COMPLIANCE_VERIFIER_ADDRESS: deployment.complianceVerifier,
    VITE_STATE_REGISTRY_ADDRESS: deployment.stateRegistry,
    VITE_MOCK_RWA_ASSET_ADDRESS: deployment.asset,
    VITE_RWA_GATE_ADDRESS: deployment.rwaGate,
    VITE_ENTERPRISE_GATE_ADDRESS: deployment.enterpriseGate,
    VITE_SOCIAL_GATE_ADDRESS: deployment.socialGate,
  };

  spawnCommand("cmd", ["/c", "pnpm --filter @web3id/issuer-service dev"], sharedEnv, "inherit");
  spawnCommand("cmd", ["/c", "pnpm --filter @web3id/frontend dev"], sharedEnv, "inherit");

  console.log("Phase2 demo running");
  console.log(`Issuer service: http://127.0.0.1:4100`);
  console.log(`Frontend:      http://127.0.0.1:3000`);
  console.log(`Holder:        ${DEFAULT_HOLDER}`);
  console.log(`Proof setup:   pnpm proof:setup completed`);

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
