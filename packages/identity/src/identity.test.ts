import { describe, expect, it } from "vitest";
import { buildControllerChallengeFields, buildControllerChallengeMessage, deriveRootIdentity, normalizeControllerRef } from "./index.js";
import { IdentityMode, SubIdentityType } from "./types.js";
import {
  canEnterCompliancePath,
  canUseDefaultPath,
  createSameRootProof,
  createSubIdentityLinkProof,
  deriveSubIdentity,
  getIdentityCapabilities,
  isComplianceCapableSubIdentityType,
  isDefaultOnlySubIdentityType,
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

  it("keeps the legacy EVM didLikeId and rootId byte-for-byte stable", () => {
    const root = deriveRootIdentity(address, 31337);
    const multichain = deriveRootIdentity({
      chainFamily: "evm",
      networkId: 31337,
      address,
    });

    expect(root.didLikeId).toBe("did:pkh:eip155:31337:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(multichain.didLikeId).toBe(root.didLikeId);
    expect(multichain.rootId).toBe(root.rootId);
    expect(multichain.identityId).toBe(root.identityId);
    expect(multichain.primaryControllerRef.normalizedAddress).toBe(root.controllerAddress);
  });

  it("normalizes multichain controllers and avoids cross-family root collisions", () => {
    const evm = normalizeControllerRef({
      chainFamily: "evm",
      networkId: 31337,
      address,
    });
    const solana = normalizeControllerRef({
      chainFamily: "solana",
      networkId: "devnet",
      address: "11111111111111111111111111111111",
    });
    const bitcoin = normalizeControllerRef({
      chainFamily: "bitcoin",
      networkId: "testnet",
      address: "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn",
      proofType: "bitcoin_legacy",
    });

    expect(solana.normalizedAddress).toBe("11111111111111111111111111111111");
    expect(bitcoin.normalizedAddress).toBe("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn");
    expect(deriveRootIdentity(evm).rootId).not.toBe(deriveRootIdentity(solana).rootId);
    expect(deriveRootIdentity(solana).rootId).not.toBe(deriveRootIdentity(bitcoin).rootId);
  });

  it("builds canonical controller challenges with deterministic replay scope", () => {
    const controllerRef = normalizeControllerRef({
      chainFamily: "evm",
      networkId: 31337,
      address,
    });
    const fields = buildControllerChallengeFields({
      bindingType: "subject_aggregate_link",
      controllerRef,
      rootIdentityId: "0xabc",
      subjectAggregateId: "subject-1",
      nonce: "nonce-1",
      issuedAt: "2026-03-22T00:00:00.000Z",
      expiresAt: "2026-03-22T00:10:00.000Z",
    });

    expect(fields.replayScope).toBe(
      "web3id.controller.challenge.v1:subject_aggregate_link:evm:31337:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266:0xabc:subject-1",
    );
    expect(buildControllerChallengeMessage(fields)).toContain("Web3ID Controller Challenge");
    expect(buildControllerChallengeMessage(fields)).toContain("bindingType: subject_aggregate_link");
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
    expect(isDefaultOnlySubIdentityType(SubIdentityType.SOCIAL)).toBe(true);
    expect(isComplianceCapableSubIdentityType(SubIdentityType.RWA_INVEST)).toBe(true);
    expect(canUseDefaultPath(social)).toBe(true);
    expect(canEnterCompliancePath(rwa)).toBe(false);

    expect(resolveEffectiveMode(social, govPolicy)).toBe("DEFAULT_BEHAVIOR_MODE");
    expect(resolveEffectiveMode(rwa, rwaPolicy)).toBeNull();
    expect(
      resolveEffectiveMode(rwa, rwaPolicy, {
        linkedCredentialTypes: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
      }),
    ).toBe("COMPLIANCE_MODE");
    expect(
      canEnterCompliancePath(rwa, {
        linkedCredentialTypes: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
      }),
    ).toBe(true);

    expect(supportsPolicy(social, rwaPolicy).supported).toBe(false);
  });
});
