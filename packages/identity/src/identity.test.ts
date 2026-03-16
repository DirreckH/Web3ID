import { describe, expect, it } from "vitest";
import { deriveRootIdentity } from "./root.js";
import { IdentityMode, SubIdentityType } from "./types.js";
import {
  createSameRootProof,
  createSubIdentityLinkProof,
  deriveSubIdentity,
  getIdentityCapabilities,
  normalizeScope,
  resolveEffectiveMode,
  supportsPolicy,
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

  it("derives capability-first identities and resolves effective mode per policy", () => {
    const root = deriveRootIdentity(address);
    const social = deriveSubIdentity({ rootIdentity: root, scope: "social", type: SubIdentityType.SOCIAL });
    const rwa = deriveSubIdentity({ rootIdentity: root, scope: "rwa-invest", type: SubIdentityType.RWA_INVEST });
    const govPolicy = {
      allowedModes: [IdentityMode.DEFAULT_BEHAVIOR_MODE],
      requiresComplianceMode: false,
    };
    const rwaPolicy = {
      allowedModes: [IdentityMode.COMPLIANCE_MODE],
      requiresComplianceMode: true,
    };

    const socialCapabilities = getIdentityCapabilities(social);
    expect(socialCapabilities.supportedProofKinds).toEqual(["holder_bound_proof"]);

    expect(resolveEffectiveMode(social, govPolicy)).toBe("DEFAULT_BEHAVIOR_MODE");
    expect(resolveEffectiveMode(rwa, rwaPolicy)).toBeNull();
    expect(
      resolveEffectiveMode(rwa, rwaPolicy, {
        linkedCredentialTypes: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
      }),
    ).toBe("COMPLIANCE_MODE");

    expect(supportsPolicy(social, rwaPolicy).supported).toBe(false);
  });
});
