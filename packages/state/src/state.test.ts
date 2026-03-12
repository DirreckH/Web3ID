import { describe, expect, it } from "vitest";
import { IdentityState, canTransition, compareStates, createStateTransition, isStateInRange, mapRiskSignalToState } from "./index.js";

describe("state machine", () => {
  it("uses the locked enum ordering", () => {
    expect(compareStates(IdentityState.NORMAL, IdentityState.INIT)).toBe(1);
    expect(compareStates(IdentityState.FROZEN, IdentityState.HIGH_RISK)).toBe(1);
  });

  it("evaluates state ranges numerically", () => {
    expect(isStateInRange(IdentityState.OBSERVED, IdentityState.NORMAL, IdentityState.RESTRICTED)).toBe(true);
    expect(isStateInRange(IdentityState.FROZEN, IdentityState.NORMAL, IdentityState.RESTRICTED)).toBe(false);
  });

  it("maps risk signals deterministically", () => {
    expect(
      mapRiskSignalToState(IdentityState.NORMAL, {
        type: "MIXER_INTERACTION",
        evidenceType: "MIXER_TRACE",
        actor: "analyzer",
        timestamp: 1,
        policyVersion: 1,
        reason: "trace",
      }),
    ).toBe(IdentityState.RESTRICTED);
  });

  it("rejects illegal transitions", () => {
    expect(() =>
      createStateTransition(IdentityState.NORMAL, {
        type: "MANUAL_REVIEW_RESULT",
        evidenceType: "MANUAL_REVIEW",
        actor: "reviewer",
        timestamp: 1,
        policyVersion: 1,
        requestedState: IdentityState.INIT,
        reason: "bad rollback",
      }),
    ).toThrow(/Illegal transition/);
    expect(canTransition(IdentityState.HIGH_RISK, IdentityState.NORMAL)).toBe(false);
  });
});
