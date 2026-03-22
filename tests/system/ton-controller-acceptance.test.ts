import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTonFixture } from "../../packages/identity/src/controller-test-helpers.js";
import { registerAndBindControllerRoot, resetMainstreamAnalyzerState } from "./mainstream-helpers.js";

describe("TON controller acceptance", () => {
  beforeEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  afterEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  it("verifies ton_proof_v2 offline and registers the root", async () => {
    const fixture = createTonFixture("0x0101010101010101010101010101010101010101010101010101010101010101");
    const result = await registerAndBindControllerRoot({
      controllerRef: fixture.controllerRef,
      candidateProofFactory: (challengeMessage) => fixture.signChallenge(challengeMessage),
    });

    expect(result.binding.usedFallbackResolver).toBe(false);
    expect(result.binding.proofEnvelopeSummary?.proofType).toBe("ton_proof_v2");
  });
});
