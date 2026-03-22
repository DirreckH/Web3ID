import { describe, expect, it } from "vitest";
import { buildDidPkh, deriveRootIdentity, normalizeControllerRef } from "../../packages/identity/src/index.js";

describe("multi-chain root acceptance", () => {
  it("keeps EVM derivation byte-for-byte stable while adding controllerRef derivation", () => {
    const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
    const legacy = deriveRootIdentity(address, 31337);
    const controllerRefPath = deriveRootIdentity({
      chainFamily: "evm",
      networkId: 31337,
      address,
    });

    expect(controllerRefPath.didLikeId).toBe(buildDidPkh(address, 31337));
    expect(controllerRefPath.rootId).toBe(legacy.rootId);
    expect(controllerRefPath.identityId).toBe(legacy.identityId);
  });

  it("derives stable per-chain roots and prevents cross-family collisions", () => {
    const sharedBase58Like = "11111111111111111111111111111111";
    const solanaController = normalizeControllerRef({
      chainFamily: "solana",
      networkId: "mainnet-beta",
      address: sharedBase58Like,
    });
    const bitcoinController = normalizeControllerRef({
      chainFamily: "bitcoin",
      networkId: "mainnet",
      address: sharedBase58Like,
    });
    const bitcoinLegacyController = normalizeControllerRef({
      chainFamily: "bitcoin",
      networkId: "mainnet",
      address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      proofType: "bitcoin_legacy",
    });

    const solanaRoot = deriveRootIdentity(solanaController);
    const bitcoinRoot = deriveRootIdentity(bitcoinController);
    const bitcoinLegacyRoot = deriveRootIdentity(bitcoinLegacyController);

    expect(deriveRootIdentity(solanaController).rootId).toBe(solanaRoot.rootId);
    expect(deriveRootIdentity(bitcoinController).rootId).toBe(bitcoinRoot.rootId);
    expect(solanaRoot.rootId).not.toBe(bitcoinRoot.rootId);
    expect(bitcoinLegacyRoot.rootId).not.toBe(solanaRoot.rootId);
    expect(bitcoinLegacyRoot.primaryControllerRef.proofType).toBe("bitcoin_legacy");
  });
});
