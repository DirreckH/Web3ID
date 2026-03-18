import { afterEach, describe, expect, it } from "vitest";
import {
  clearRecoveryHooksForTests,
  createRecoveryIntent,
  getRecoveryPolicySlot,
  listRecoveryGuardians,
  listRecoveryIntents,
  registerRecoveryGuardians,
  registerRecoveryPolicySlot,
} from "./recovery.js";

const rootIdentityId = "0x00000000000000000000000000000000000000000000000000000000000000aa";

describe("recovery hooks", () => {
  afterEach(() => {
    clearRecoveryHooksForTests();
  });

  it("registers recovery slots and guardians for a root identity", () => {
    const slot = registerRecoveryPolicySlot({
      policySlotId: "slot-1",
      rootIdentityId,
      enabled: true,
      minGuardianApprovals: 2,
      cooldownSeconds: 3600,
      scope: "root_only",
      allowedRecoveryActions: ["unlock", "rebind"],
      createdAt: new Date("2026-03-18T00:00:00Z").toISOString(),
      updatedAt: new Date("2026-03-18T00:00:00Z").toISOString(),
    });
    const guardians = registerRecoveryGuardians(rootIdentityId, [
      {
        guardianId: "guardian-1",
        guardianType: "address",
        guardianRef: "0x00000000000000000000000000000000000000a1",
        role: "primary",
        weight: 1,
        addedAt: new Date("2026-03-18T00:00:00Z").toISOString(),
        status: "active",
      },
    ]);

    expect(getRecoveryPolicySlot(slot.policySlotId)?.minGuardianApprovals).toBe(2);
    expect(listRecoveryGuardians(rootIdentityId)).toEqual(guardians);
  });

  it("records blocked intents when governance controls are active", () => {
    const intent = createRecoveryIntent(
      {
        intentId: "intent-1",
        rootIdentityId,
        action: "unlock",
        initiatedBy: "guardian-1",
        createdAt: new Date("2026-03-18T01:00:00Z").toISOString(),
      },
      { propagationLevel: "GLOBAL_LOCKDOWN" },
    );

    expect(intent.status).toBe("rejected");
    expect(intent.blockedReason).toMatch(/global lockdown/i);
    expect(listRecoveryIntents(rootIdentityId)).toHaveLength(1);
  });
});
