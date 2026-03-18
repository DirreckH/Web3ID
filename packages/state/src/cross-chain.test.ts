import { describe, expect, it } from "vitest";
import { buildCrossChainStateMessage, buildStateMerkleCommitment, buildStateSnapshot } from "./cross-chain.js";
import { IdentityState } from "./state.js";

const identityId = "0x00000000000000000000000000000000000000000000000000000000000000ab" as const;
const rootIdentityId = "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;

describe("cross-chain state hooks", () => {
  it("builds a deterministic snapshot from structured state facts", () => {
    const snapshot = buildStateSnapshot(
      {
        identityId,
        rootIdentityId,
        subIdentityId: identityId,
        storedState: IdentityState.OBSERVED,
        effectiveState: IdentityState.RESTRICTED,
        stateContext: {
          currentState: IdentityState.NORMAL,
          decisions: [
            {
              decisionId: "decision-1",
              evidenceBundleHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
            },
          ] as any,
          assessments: [] as any,
          consequences: [
            {
              consequenceId: "limit-1",
              identityId,
              targetLevel: "sub",
              consequenceType: "limit",
              severity: "high",
              reasonCode: "NEGATIVE_RISK_FLAG",
              sourceDecisionId: "decision-1",
              effectiveFrom: new Date("2026-03-18T00:00:00Z").toISOString(),
              recoverable: true,
              createdAt: new Date("2026-03-18T00:00:00Z").toISOString(),
            },
          ] as any,
        },
        policyDecisions: [
          {
            policyLabel: "ENTITY_PAYMENT_V1",
            policyVersion: 1,
            createdAt: new Date("2026-03-19T00:00:00Z").toISOString(),
          },
        ],
      },
      { generatedAt: new Date("2026-03-20T00:00:00Z").toISOString() },
    );

    expect(snapshot.storedState).toBe("NORMAL");
    expect(snapshot.effectiveState).toBe("RESTRICTED");
    expect(snapshot.consequenceTypes).toEqual(["limit"]);
    expect(snapshot.policyContextVersion).toBe("ENTITY_PAYMENT_V1@1");
    expect(snapshot.stateVersion).toBe("decision-1");
  });

  it("builds deterministic commitments and target-sensitive messages", () => {
    const snapshot = buildStateSnapshot(
      {
        identityId,
        rootIdentityId,
        subIdentityId: identityId,
        storedState: IdentityState.NORMAL,
        effectiveState: IdentityState.FROZEN,
        stateContext: {
          currentState: IdentityState.NORMAL,
          decisions: [{ decisionId: "decision-2", evidenceBundleHash: undefined }] as any,
          assessments: [] as any,
          consequences: [] as any,
        },
        policyDecisions: [],
      },
      { generatedAt: new Date("2026-03-20T00:00:00Z").toISOString() },
    );

    const commitment = buildStateMerkleCommitment(snapshot, {
      createdAt: new Date("2026-03-20T00:00:00Z").toISOString(),
    });
    const first = buildCrossChainStateMessage(snapshot, 10, {
      sourceChainId: 31337,
      commitment,
      createdAt: new Date("2026-03-20T00:00:00Z").toISOString(),
    });
    const second = buildCrossChainStateMessage(snapshot, 42161, {
      sourceChainId: 31337,
      commitment,
      createdAt: new Date("2026-03-20T00:00:00Z").toISOString(),
    });

    expect(commitment.leafHash).toBe(commitment.merkleRoot);
    expect(first.snapshotRef).toBe(snapshot.snapshotId);
    expect(first.messageType).toBe("freeze_notice");
    expect(first.payloadHash).not.toBe(second.payloadHash);
  });
});
