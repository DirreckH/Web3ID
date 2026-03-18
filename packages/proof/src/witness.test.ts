import { describe, expect, it } from "vitest";
import { buildSubjectCircuitInput } from "./witness.js";

describe("buildSubjectCircuitInput", () => {
  it("matches the current circuit input schema", () => {
    const { circuitInput, publicSignals } = buildSubjectCircuitInput("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

    expect(circuitInput.zkCommitment).toBe(publicSignals[0]);
    expect(circuitInput).not.toHaveProperty("statementSignal");
    expect(circuitInput.subjectBytes).toHaveLength(20);
  });
});
