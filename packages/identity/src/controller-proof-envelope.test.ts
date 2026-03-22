import { describe, expect, it } from "vitest";
import { normalizeLegacyCandidateSignature, parseControllerProofEnvelope } from "./controller-proof-envelope.js";
import { CONTROLLER_PROOF_ENVELOPE_VERSION } from "./types.js";

describe("controller proof envelope", () => {
  it("parses structured proof envelopes with explicit proofType schemas", () => {
    const parsed = parseControllerProofEnvelope({
      proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
      proofType: "aptos_sign_message",
      signature: "0x1234",
      publicKey: "0xabcd",
      fullMessage: "full-message",
      proofPayload: {
        address: "0x01",
        application: "web3id",
        chainId: 1,
        nonce: "nonce-1",
        message: "challenge",
      },
    });

    expect(parsed.proofType).toBe("aptos_sign_message");
    expect(parsed.fullMessage).toBe("full-message");
  });

  it("rejects invalid structured proof envelopes before verifier dispatch", () => {
    expect(() =>
      parseControllerProofEnvelope({
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "sui_personal_message_ed25519",
        signature: "0x1234",
        proofPayload: {
          address: "0x01",
          messageBytes: "0xdeadbeef",
        },
      }),
    ).toThrow(/publicKey/i);
  });

  it("normalizes legacy candidate signatures into the shared envelope path", () => {
    const normalized = normalizeLegacyCandidateSignature(
      { proofType: "tron_signed_message_v2" },
      "0xfeed",
    );

    expect(normalized.proofEnvelopeVersion).toBe(CONTROLLER_PROOF_ENVELOPE_VERSION);
    expect(normalized.proofType).toBe("tron_signed_message_v2");
    expect(normalized.signature).toBe("0xfeed");
  });
});
