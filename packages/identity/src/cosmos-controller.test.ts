import { describe, expect, it } from "vitest";
import { verifyControllerChallenge } from "./controller.js";
import { createControllerChallengeFixture, createCosmosFixture } from "./controller-test-helpers.js";

const COSMOS_SECRET = "0x0202020202020202020202020202020202020202020202020202020202020202";

describe("cosmos controller", () => {
  it("verifies ADR-036 direct proofs offline", async () => {
    const fixture = createCosmosFixture(COSMOS_SECRET);
    const challenge = createControllerChallengeFixture({ controllerRef: fixture.controllerRef });
    const verification = await verifyControllerChallenge({
      challenge,
      candidateProof: fixture.signDirect(challenge.challengeMessage),
    });

    expect(verification.normalizedSigner).toBe(fixture.controllerRef.normalizedAddress);
  });

  it("verifies ADR-036 legacy amino proofs offline", async () => {
    const fixture = createCosmosFixture(COSMOS_SECRET);
    const challenge = createControllerChallengeFixture({ controllerRef: { ...fixture.controllerRef, proofType: "cosmos_adr036_legacy_amino" } });
    const verification = await verifyControllerChallenge({
      challenge,
      candidateProof: fixture.signLegacy(challenge.challengeMessage),
    });

    expect(verification.proofEnvelope.proofType).toBe("cosmos_adr036_legacy_amino");
  });
});
