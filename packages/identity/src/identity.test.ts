import { describe, expect, it } from "vitest";
import { deriveRootIdentity } from "./root.js";
import { SubIdentityType } from "./types.js";
import {
  createSameRootProof,
  createSubIdentityLinkProof,
  deriveSubIdentity,
  normalizeScope,
  verifySameRootProof,
  verifySubIdentityLinkProof,
} from "./sub.js";

describe("identity derivation", () => {
  const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  it("derives a deterministic root identity", () => {
    const first = deriveRootIdentity(address);
    const second = deriveRootIdentity(address);

    expect(first.rootId).toBe(second.rootId);
    expect(first.identityId).toBe(second.identityId);
    expect(first.didLikeId).toBe(second.didLikeId);
  });

  it("normalizes scope and derives deterministic sub identities", () => {
    const root = deriveRootIdentity(address);
    const first = deriveSubIdentity({ rootIdentity: root, scope: " Payments ", type: SubIdentityType.PAYMENTS });
    const second = deriveSubIdentity({ rootIdentity: root, scope: "payments", type: SubIdentityType.PAYMENTS });

    expect(normalizeScope(" Payments ")).toBe("payments");
    expect(first.subIdentityId).toBe(second.subIdentityId);
    expect(first.identityId).toBe(second.identityId);
  });

  it("creates link proofs for root/sub identity binding", () => {
    const root = deriveRootIdentity(address);
    const sub = deriveSubIdentity({ rootIdentity: root, scope: "rwa-invest", type: SubIdentityType.RWA_INVEST });
    const proof = createSubIdentityLinkProof(root, sub);

    expect(verifySubIdentityLinkProof(proof, root, sub)).toBe(true);
  });

  it("creates same-root proofs for multiple sub identities", () => {
    const root = deriveRootIdentity(address);
    const first = deriveSubIdentity({ rootIdentity: root, scope: "rwa-invest", type: SubIdentityType.RWA_INVEST });
    const second = deriveSubIdentity({ rootIdentity: root, scope: "payments", type: SubIdentityType.PAYMENTS });
    const proof = createSameRootProof(root, [first, second]);

    expect(verifySameRootProof(proof, root, [first, second])).toBe(true);
  });
});
