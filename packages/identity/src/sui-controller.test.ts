import { describe, expect, it } from "vitest";
import { verifyControllerChallenge } from "./controller.js";
import { createControllerChallengeFixture, createSuiFixture } from "./controller-test-helpers.js";
import type { SuiPersonalMessageProofPayload } from "./types.js";

const SUI_SECRET = "0x0404040404040404040404040404040404040404040404040404040404040404";

describe("sui controller", () => {
  it("verifies personal message ed25519 proofs", async () => {
    const fixture = createSuiFixture(SUI_SECRET);
    const challenge = createControllerChallengeFixture({ controllerRef: fixture.controllerRef });
    const verification = await verifyControllerChallenge({
      challenge,
      candidateProof: fixture.signEd25519(challenge.challengeMessage),
    });

    expect(verification.normalizedSigner.toLowerCase()).toBe(fixture.controllerRef.normalizedAddress.toLowerCase());
  });

  it("accepts secp256k1 and secp256r1 envelopes as typed fixtures", async () => {
    const fixture = createSuiFixture(SUI_SECRET);
    const secpK1Proof = fixture.signSecp256k1("fixture");
    const secpR1Proof = fixture.signSecp256r1("fixture");
    const secpK1Address = (secpK1Proof.proofPayload as SuiPersonalMessageProofPayload).address;
    const secpR1Address = (secpR1Proof.proofPayload as SuiPersonalMessageProofPayload).address;
    const secpK1Challenge = createControllerChallengeFixture({
      controllerRef: {
        ...fixture.controllerRef,
        proofType: "sui_personal_message_secp256k1",
        signatureScheme: "secp256k1",
        address: secpK1Address,
      },
    });
    const secpR1Challenge = createControllerChallengeFixture({
      controllerRef: {
        ...fixture.controllerRef,
        proofType: "sui_personal_message_secp256r1",
        signatureScheme: "secp256r1",
        address: secpR1Address,
      },
    });

    expect(
      (await verifyControllerChallenge({
        challenge: secpK1Challenge,
        candidateProof: fixture.signSecp256k1(secpK1Challenge.challengeMessage),
      })).proofEnvelope.proofType,
    ).toBe("sui_personal_message_secp256k1");
    expect(
      (await verifyControllerChallenge({
        challenge: secpR1Challenge,
        candidateProof: fixture.signSecp256r1(secpR1Challenge.challengeMessage),
      })).proofEnvelope.proofType,
    ).toBe("sui_personal_message_secp256r1");
  });
});
