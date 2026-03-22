import { describe, expect, it } from "vitest";
import { submitBindingSchema } from "./server.js";

describe("analyzer binding schema", () => {
  it("rejects invalid candidateProof envelopes before verifier dispatch", () => {
    const parsed = submitBindingSchema.safeParse({
      challengeId: "challenge-1",
      candidateProof: {
        proofEnvelopeVersion: "1",
        proofType: "sui_personal_message_ed25519",
        signature: "0x1234",
        proofPayload: {
          address: "0x01",
          messageBytes: "0xdeadbeef",
        },
      },
    });

    expect(parsed.success).toBe(false);
  });
});
