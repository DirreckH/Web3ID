import { execSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(frontendRoot, "..", "..");
const isWindows = process.platform === "win32";

function spawnCommand(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
    shell: false,
  });
}

function listPidsForPort(port) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano -p tcp | findstr :${port}`, {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();
      return [...new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.split(/\s+/).at(-1))
          .filter((pid) => pid && /^\d+$/.test(pid)),
      )];
    }

    const output = execSync(`lsof -ti tcp:${port}`, {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

async function freePorts(ports) {
  const pids = [...new Set(ports.flatMap((port) => listPidsForPort(port)))];
  for (const pid of pids) {
    await killTree(Number(pid));
  }
}

async function waitForHttp(url, { method = "GET", body } = {}) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body,
      });

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the stack is ready.
    }

    await delay(2000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForDemoReady() {
  await waitForHttp("http://127.0.0.1:3000");
  await waitForHttp("http://127.0.0.1:4100/health");
  await waitForHttp("http://127.0.0.1:8545", {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  });
}

async function killTree(pid) {
  if (!pid) {
    return;
  }

  if (isWindows) {
    await new Promise((resolveKill) => {
      const killer = spawn("cmd", ["/c", "taskkill", "/pid", String(pid), "/t", "/f"], {
        cwd: workspaceRoot,
        stdio: "ignore",
        shell: false,
      });
      killer.on("exit", () => resolveKill());
      killer.on("error", () => resolveKill());
    });
    return;
  }

  process.kill(-pid, "SIGTERM");
}

const demoCommand = isWindows ? "cmd" : "pnpm";
const demoArgs = isWindows ? ["/c", "pnpm", "demo:stage2"] : ["demo:stage2"];
const testCommand = isWindows ? "cmd" : "pnpm";
const testArgs = isWindows
  ? ["/c", "pnpm", "exec", "playwright", "test", "--config", "playwright.config.ts"]
  : ["exec", "playwright", "test", "--config", "playwright.config.ts"];

let demoProcess;

const shutdown = async () => {
  await killTree(demoProcess?.pid);
};

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(130);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(143);
});

try {
  await freePorts([3000, 4100, 8545]);
  demoProcess = spawnCommand(demoCommand, demoArgs, workspaceRoot);
  await waitForDemoReady();

  const exitCode = await new Promise((resolveTest, rejectTest) => {
    const testProcess = spawnCommand(testCommand, testArgs, frontendRoot);
    testProcess.on("exit", (code) => resolveTest(code ?? 1));
    testProcess.on("error", rejectTest);
  });

  await shutdown();
  process.exit(exitCode);
} catch (error) {
  await shutdown();
  console.error(error);
  process.exit(1);
}
