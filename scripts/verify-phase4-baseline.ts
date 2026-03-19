import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const commands = [
  "pnpm proof:smoke",
  "pnpm test:integration",
  "pnpm test:system:smoke",
  "pnpm test:system",
];

async function runCommand(command: string) {
  const isWindows = process.platform === "win32";
  const child = spawn(isWindows ? "cmd" : "sh", isWindows ? ["/c", command] : ["-lc", command], {
    cwd: root,
    stdio: "inherit",
  });

  const code = await new Promise<number>((resolvePromise, reject) => {
    child.on("error", reject);
    child.on("exit", (exitCode) => resolvePromise(exitCode ?? 1));
  });

  if (code !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

for (const command of commands) {
  // Keep the runner simple and explicit so the baseline log mirrors Phase4 gates.
  // The caller decides whether failures are blockers or baseline follow-ups.
  console.log(`\n[phase4:baseline] ${command}`);
  await runCommand(command);
}

console.log("\n[phase4:baseline] complete");
