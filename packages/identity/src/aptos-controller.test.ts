import { describe, expect, it } from "vitest";
import { verifyControllerChallenge } from "./controller.js";
import { createAptosFixture, createControllerChallengeFixture } from "./controller-test-helpers.js";

const APTOS_SECRET = "0x0303030303030303030303030303030303030303030303030303030303030303";

describe("aptos controller", () => {
  it("verifies signMessage envelopes for single-signer accounts", async () => {
    const fixture = createAptosFixture(APTOS_SECRET);
    const challenge = createControllerChallengeFixture({ controllerRef: fixture.controllerRef });
    const verification = await verifyControllerChallenge({
      challenge,
      candidateProof: fixture.signMessage(challenge.challengeMessage),
    });

    expect(verification.normalizedSigner.toLowerCase()).toBe(fixture.controllerRef.normalizedAddress.toLowerCase());
    expect(verification.proofEnvelope.proofType).toBe("aptos_sign_message");
  });
});
