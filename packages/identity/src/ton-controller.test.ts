import { describe, expect, it } from "vitest";
import { verifyControllerChallenge } from "./controller.js";
import { createControllerChallengeFixture, createTonFixture } from "./controller-test-helpers.js";

const TON_SECRET = "0x0101010101010101010101010101010101010101010101010101010101010101";

describe("ton controller", () => {
  it("verifies ton_proof_v2 envelopes offline with deterministic fixtures", async () => {
    const fixture = createTonFixture(TON_SECRET);
    const challenge = createControllerChallengeFixture({
      controllerRef: fixture.controllerRef,
      issuedAt: "2030-03-09T16:00:00.000Z",
      expiresAt: "2030-03-09T18:00:00.000Z",
    });
    const candidateProof = fixture.signChallenge(challenge.challengeMessage, 1_899_306_000);
    const verification = await verifyControllerChallenge({
      challenge,
      candidateProof,
    });

    expect(verification.normalizedSigner).toBe(fixture.controllerRef.normalizedAddress);
    expect(verification.usedFallbackResolver).toBe(false);
  });
});
