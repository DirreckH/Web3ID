import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");

function readDoc(name: string) {
  return readFileSync(resolve(ROOT, "docs", name), "utf8");
}

describe("P2 documentation consistency", () => {
  it("documents the reserved hooks and their boundaries", () => {
    const baseline = readDoc("PLATFORM_BASELINE.md");
    const phase4 = readDoc("PHASE4_INPUT.md");
    const crossChain = readDoc("CROSS_CHAIN_STATE_HOOKS.md");
    const recovery = readDoc("RECOVERY_HOOKS.md");
    const proof = readDoc("PROOF_PRIVACY_ABSTRACTION.md");

    expect(baseline).toContain("P2 Reserved Hooks");
    expect(baseline).toContain("cross-chain state hooks");
    expect(baseline).toContain("recovery hooks");
    expect(baseline).toContain("proof privacy abstraction");
    expect(phase4).toContain("Phase4");
    expect(crossChain).toContain("StateSnapshot");
    expect(crossChain).toContain("CrossChainStateMessage");
    expect(recovery).toContain("RecoveryPolicySlot");
    expect(recovery).toContain("governance emergency freeze");
    expect(proof).toContain("holder_binding");
    expect(proof).toContain("issuer_hidden_reserved");
  });
});
