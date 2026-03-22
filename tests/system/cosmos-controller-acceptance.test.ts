import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCosmosFixture } from "../../packages/identity/src/controller-test-helpers.js";
import { registerAndBindControllerRoot, resetMainstreamAnalyzerState } from "./mainstream-helpers.js";

describe("Cosmos controller acceptance", () => {
  beforeEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  afterEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  it("verifies ADR-036 direct proofs offline and registers the root", async () => {
    const fixture = createCosmosFixture("0x0202020202020202020202020202020202020202020202020202020202020202");
    const result = await registerAndBindControllerRoot({
      controllerRef: fixture.controllerRef,
      candidateProofFactory: (challengeMessage) => fixture.signDirect(challengeMessage),
    });

    expect(result.rootIdentity.primaryControllerRef.chainFamily).toBe("cosmos");
    expect(result.binding.proofEnvelopeSummary?.proofType).toBe("cosmos_adr036_direct");
    expect(result.binding.usedFallbackResolver).toBe(false);
  });
});
