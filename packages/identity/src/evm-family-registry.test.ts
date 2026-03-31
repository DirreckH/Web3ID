import { describe, expect, it } from "vitest";
import { buildDidPkh, deriveRootIdentity, listSupportedEvmNetworks, normalizeControllerRef, resolveEvmNetworkPreset } from "./index.js";

describe("evm family registry", () => {
  it("exposes the frozen EVM network presets", () => {
    expect(listSupportedEvmNetworks().map((item) => item.networkRef)).toEqual([
      "eip155:1",
      "eip155:56",
      "eip155:42161",
      "eip155:8453",
      "eip155:10",
    ]);
  });

  it("keeps EVM derivation byte-for-byte compatible", () => {
    const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
    const legacy = deriveRootIdentity(address, 1);
    const registryPath = deriveRootIdentity({
      chainFamily: "evm",
      networkId: 1,
      address,
    });

    expect(registryPath.didLikeId).toBe(buildDidPkh(address, 1));
    expect(registryPath.rootId).toBe(legacy.rootId);
    expect(resolveEvmNetworkPreset(56)?.label).toBe("BNB Chain");
    expect(resolveEvmNetworkPreset(8453)?.label).toBe("Base");
    expect(normalizeControllerRef({ chainFamily: "evm", networkId: 10, address }).networkId).toBe("10");
  });
});
