import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSuiFixture } from "../../packages/identity/src/controller-test-helpers.js";
import { registerAndBindControllerRoot, resetMainstreamAnalyzerState } from "./mainstream-helpers.js";

describe("Sui controller acceptance", () => {
  beforeEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  afterEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  it("verifies Ed25519 personal message proofs offline and registers the root", async () => {
    const fixture = createSuiFixture("0x0404040404040404040404040404040404040404040404040404040404040404");
    const result = await registerAndBindControllerRoot({
      controllerRef: fixture.controllerRef,
      candidateProofFactory: (challengeMessage) => fixture.signEd25519(challengeMessage),
    });

    expect(result.binding.proofEnvelopeSummary?.proofType).toBe("sui_personal_message_ed25519");
    expect(result.binding.usedFallbackResolver).toBe(false);
  });
});
