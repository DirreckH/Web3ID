import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..", "..");

function resolvePnpmCommand() {
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "pnpm"] };
  }
  return { command: "pnpm", args: [] };
}

async function runAcceptance(stage: "stage1" | "platform") {
  const pnpm = resolvePnpmCommand();
  const basePort = stage === "stage1" ? 12055 : 12555;
  const portSeed = String(basePort + (process.pid % 100));
  return new Promise<any>((resolvePromise, reject) => {
    const child = spawn(
      pnpm.command,
      [...pnpm.args, "exec", "tsx", "scripts/verify-stage3-acceptance.ts", stage],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          WEB3ID_ACCEPTANCE_RPC_PORT: portSeed,
        },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Acceptance command failed with code ${code}`));
        return;
      }

      try {
        resolvePromise(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Failed to parse acceptance JSON for ${stage}: ${String(error)}\n${stdout}\n${stderr}`));
      }
    });
  });
}

describe.sequential("platform acceptance", () => {
  it(
    "covers the stage1 minimal baseline",
    async () => {
      const result = await runAcceptance("stage1");
      expect(result.stage).toBe("stage1");
      expect(result.result.rootIdentityId).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(result.result.subIdentityIds).toHaveLength(4);
      expect(result.result.proofPublicSignals).toHaveLength(1);
      expect(result.result.payloadIdentityId).toBeTruthy();
    },
    900_000,
  );

  it(
    "covers the platform full-stack baseline",
    async () => {
      const result = await runAcceptance("platform");
      expect(result.stage).toBe("platform");
      expect(result.result.accessPolicy.denyWithoutBundles).toBe("deny");
      expect(result.result.accessPolicy.allowWithValidInputs).toBe("allow");
      expect(result.result.accessPolicy.restrictWithRisk).toMatch(/restrict|deny/);
      expect(result.result.watcher.eventsAfterAuto).toBeGreaterThan(result.result.watcher.eventsBeforeStart);
      expect(result.result.reviewQueue.confirmedStatus).toBe("CONFIRMED_SIGNAL");
      expect(result.result.reviewQueue.dismissedStatus).toBe("DISMISSED");
      expect(result.result.reviewQueue.expiredStatus).toBe("EXPIRED");
      expect(result.result.auditExport.recordCount).toBeGreaterThan(0);
      expect(result.result.manualRelease.releaseFloorState).not.toBeNull();
      expect(result.result.manualRelease.releasedStoredState).not.toBeNull();
    },
    900_000,
  );
});
