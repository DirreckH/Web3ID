import { waitForAcceptance } from "../../scripts/acceptance-shared.js";
import { createServiceHarness, type ServiceHarness } from "../integration/service-harness.js";

export async function waitFor<T>(callback: () => Promise<T | null>, timeoutMs = 60_000, intervalMs = 1_000) {
  return waitForAcceptance("system acceptance condition", callback, timeoutMs, intervalMs);
}

export async function createSystemHarness(seedBase: number): Promise<ServiceHarness> {
  const harness = await createServiceHarness(seedBase);
  await harness.registerTree();
  await harness.createBindings();
  return harness;
}
