import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTronFixture } from "../../packages/identity/src/controller-test-helpers.js";
import { registerAndBindControllerRoot, resetMainstreamAnalyzerState } from "./mainstream-helpers.js";

describe("TRON controller acceptance", () => {
  beforeEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  afterEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  it("registers a TRON root through the common challenge/binding pipeline", async () => {
    const fixture = createTronFixture("0x1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f");
    const result = await registerAndBindControllerRoot({
      controllerRef: fixture.controllerRef,
      candidateProofFactory: (challengeMessage) => fixture.signChallenge(challengeMessage),
    });

    expect(result.rootIdentity.primaryControllerRef.chainFamily).toBe("tron");
    expect(result.binding.proofEnvelopeSummary?.proofType).toBe("tron_signed_message_v2");
    expect(result.binding.usedFallbackResolver).toBe(false);
    expect(result.riskContext.rootIdentity.primaryControllerRef.normalizedAddress).toBe(fixture.controllerRef.normalizedAddress);
  });
});
