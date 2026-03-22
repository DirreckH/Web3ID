import { describe, expect, it } from "vitest";
import { verifyControllerChallenge } from "./controller.js";
import { createControllerChallengeFixture, createTronFixture } from "./controller-test-helpers.js";

const TRON_SECRET = "0x1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f";

describe("tron controller", () => {
  it("derives stable TRON roots and verifies signed message v2 proofs", async () => {
    const fixture = createTronFixture(TRON_SECRET);
    const challenge = createControllerChallengeFixture({ controllerRef: fixture.controllerRef });
    const candidateProof = fixture.signChallenge(challenge.challengeMessage);
    const verification = await verifyControllerChallenge({
      challenge,
      candidateProof,
    });

    expect(verification.normalizedSigner).toBe(fixture.controllerRef.normalizedAddress);
    expect(verification.proofEnvelope.proofType).toBe("tron_signed_message_v2");
  });
});
