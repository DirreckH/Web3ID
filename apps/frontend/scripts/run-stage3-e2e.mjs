import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendRoot = resolve(__dirname, "..");
const isWindows = process.platform === "win32";

const command = isWindows ? "cmd" : "pnpm";
const args = isWindows
  ? ["/c", "pnpm", "exec", "playwright", "test", "tests/stage3.spec.ts", "--config", "playwright.config.ts"]
  : ["exec", "playwright", "test", "tests/stage3.spec.ts", "--config", "playwright.config.ts"];

const child = spawn(command, args, {
  cwd: frontendRoot,
  env: process.env,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
