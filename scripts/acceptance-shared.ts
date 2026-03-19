import { setTimeout as delay } from "node:timers/promises";

export const ACCEPTANCE_DOCS = [
  "docs/PLATFORM_BASELINE.md",
  "docs/IDENTITY_INVARIANTS.md",
  "docs/STATE_SYSTEM_INVARIANTS.md",
  "docs/BOUNDARIES.md",
  "docs/DEMO_MATRIX.md",
] as const;

export function createAcceptanceJsonReplacer() {
  return (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);
}

export async function waitForAcceptance<T>(
  label: string,
  callback: () => Promise<T | null>,
  timeoutMs = 60_000,
  intervalMs = 1_000,
) {
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

export function pendingAnchorCount(context: { anchors?: Array<{ status?: string | null }> } | null | undefined) {
  return (context?.anchors ?? []).filter((entry) => entry.status === "PENDING").length;
}
