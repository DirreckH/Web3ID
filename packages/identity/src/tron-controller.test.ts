import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { verifyControllerChallenge } from "./controller.js";
import { createControllerChallengeFixture, createTronFixture } from "./controller-test-helpers.js";

const TRON_SECRET = "0x1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f";

function decodeHex(value: string) {
  return Uint8Array.from(Buffer.from(value.slice(2), "hex"));
}

function encodeHex(value: Uint8Array) {
  return `0x${Buffer.from(value).toString("hex")}`;
}

function toRsvEthStyle(signatureHex: string) {
  const bytes = decodeHex(signatureHex);
  const payload = bytes.slice(1);
  const recovery = bytes[0] + 27;
  return encodeHex(Uint8Array.from([...payload, recovery]));
}

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

  it("accepts TRON signatures encoded as r|s|v with ethereum-style recovery values", async () => {
    const fixture = createTronFixture(TRON_SECRET);
    const challenge = createControllerChallengeFixture({ controllerRef: fixture.controllerRef });
    const candidateProof = fixture.signChallenge(challenge.challengeMessage);
    const verification = await verifyControllerChallenge({
      challenge,
      candidateProof: {
        ...candidateProof,
        signature: toRsvEthStyle(candidateProof.signature),
      },
    });

    expect(verification.normalizedSigner).toBe(fixture.controllerRef.normalizedAddress);
  });

  it("does not misread recovery byte when v|r|s signatures end with a low s byte", async () => {
    const fixture = createTronFixture(TRON_SECRET);

    let challenge = createControllerChallengeFixture({ controllerRef: fixture.controllerRef, nonce: "tron-low-tail-0" });
    let candidateProof = fixture.signChallenge(challenge.challengeMessage);
    let signatureBytes = decodeHex(candidateProof.signature);

    for (let index = 1; index <= 4096 && signatureBytes[64] > 3; index += 1) {
      challenge = createControllerChallengeFixture({
        controllerRef: fixture.controllerRef,
        nonce: `tron-low-tail-${index}`,
      });
      candidateProof = fixture.signChallenge(challenge.challengeMessage);
      signatureBytes = decodeHex(candidateProof.signature);
    }

    expect(signatureBytes[0]).toBeLessThanOrEqual(1);
    expect(signatureBytes[64]).toBeLessThanOrEqual(3);

    const verification = await verifyControllerChallenge({
      challenge,
      candidateProof,
    });

    expect(verification.normalizedSigner).toBe(fixture.controllerRef.normalizedAddress);
  });
});
