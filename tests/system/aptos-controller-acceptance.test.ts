import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAptosFixture } from "../../packages/identity/src/controller-test-helpers.js";
import { registerAndBindControllerRoot, resetMainstreamAnalyzerState } from "./mainstream-helpers.js";

describe("Aptos controller acceptance", () => {
  beforeEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  afterEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  it("verifies signMessage envelopes offline and registers the root", async () => {
    const fixture = createAptosFixture("0x0303030303030303030303030303030303030303030303030303030303030303");
    const result = await registerAndBindControllerRoot({
      controllerRef: fixture.controllerRef,
      candidateProofFactory: (challengeMessage) => fixture.signMessage(challengeMessage),
    });

    expect(result.binding.proofEnvelopeSummary?.proofType).toBe("aptos_sign_message");
    expect(result.binding.usedFallbackResolver).toBe(false);
    expect(result.riskContext.rootIdentity.primaryControllerRef.normalizedAddress.toLowerCase()).toBe(
      fixture.controllerRef.normalizedAddress.toLowerCase(),
    );
  });
});
