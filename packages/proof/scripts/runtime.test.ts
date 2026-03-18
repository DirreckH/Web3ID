import { describe, expect, it } from "vitest";
import { buildDir, runtimePaths } from "./runtime.js";

describe("proof runtime paths", () => {
  it("keeps transient compile artifacts inside artifacts-build", () => {
    expect(runtimePaths.compileR1cs.startsWith(buildDir)).toBe(true);
    expect(runtimePaths.compileSym.startsWith(buildDir)).toBe(true);
    expect(runtimePaths.compileWasmDir.startsWith(buildDir)).toBe(true);
    expect(runtimePaths.compileWasm.startsWith(buildDir)).toBe(true);
  });
});
