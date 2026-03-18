import { describe, expect, it } from "vitest";
import { buildProofDescriptor, getProofCapabilities, getProofDescriptor } from "./index.js";

describe("proof privacy abstraction", () => {
  it("maps legacy holder-bound naming to holder-binding descriptors", () => {
    const descriptor = buildProofDescriptor({
      proofType: "holder_bound_proof",
      createdAt: new Date("2026-03-18T00:00:00Z").toISOString(),
    });

    expect(descriptor.privacyMode).toBe("holder_binding");
    expect(descriptor.proofType).toBe("holder_bound_proof");
    expect(getProofDescriptor("holder_bound_proof").privacyMode).toBe("holder_binding");
  });

  it("exposes current proof capability families without enabling reserved modes", () => {
    const capabilities = getProofCapabilities();

    expect(capabilities.find((item) => item.proofType === "credential_bound_proof")?.supportedPrivacyModes).toContain("credential_bound");
    expect(capabilities.find((item) => item.proofType === "holder_bound_proof")?.supportedPrivacyModes).toEqual(["holder_binding"]);
  });
});
