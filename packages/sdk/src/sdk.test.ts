import { describe, expect, it } from "vitest";
import { buildEnterpriseAuditRequestHash, buildEnterprisePaymentRequestHash, buildHolderAuthorizationPayload, buildRwaRequestHash } from "./index.js";

describe("sdk helpers", () => {
  it("builds deterministic request hashes", () => {
    expect(buildRwaRequestHash("0x0000000000000000000000000000000000000001", 1n)).toBe(
      buildRwaRequestHash("0x0000000000000000000000000000000000000001", 1n),
    );
    expect(
      buildEnterprisePaymentRequestHash(
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        5n,
        "0x0000000000000000000000000000000000000000000000000000000000000003",
      ),
    ).toMatch(/^0x[0-9a-f]{64}$/);
    expect(
      buildEnterpriseAuditRequestHash(
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000000000000000000000000000004",
      ),
    ).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("builds holder authorization payload objects", () => {
    const payload = buildHolderAuthorizationPayload(
      {
        identityId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        subjectBinding: "0x0000000000000000000000000000000000000000000000000000000000000002",
        policyId: "0x0000000000000000000000000000000000000000000000000000000000000003",
        requestHash: "0x0000000000000000000000000000000000000000000000000000000000000004",
        chainId: 31337,
        nonce: 1n,
        deadline: 2n,
      },
      "0x1234",
    );

    expect(payload.nonce).toBe(1n);
    expect(payload.policyId).toBe("0x0000000000000000000000000000000000000000000000000000000000000003");
  });
});
