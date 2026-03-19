import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  assertRecoveryHooksRemainPassive,
  clearRecoveryHooksForTests,
  createRecoveryIntent,
  deriveRootIdentity,
  registerRecoveryGuardians,
  registerRecoveryPolicySlot,
} from "../../packages/identity/src/index.js";
import {
  assertProofPrivacyGuardrails,
  getProofDescriptorSafe,
  proofPrivacyGuardrails,
} from "../../packages/proof/src/index.js";
import { buildCrossChainStateMessage, buildStateSnapshot, getRecoveryHooksSnapshot } from "../../packages/sdk/src/index.js";
import { assertCrossChainHookGuardrails } from "../../packages/state/src/index.js";
import { type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";

describe.sequential("reserved safety acceptance", () => {
  let harness: ServiceHarness;

  beforeAll(async () => {
    harness = await createSystemHarness(14355);
  }, 900_000);

  afterEach(() => {
    clearRecoveryHooksForTests();
  });

  afterAll(async () => {
    clearRecoveryHooksForTests();
    await harness.stop();
  });

  it("keeps cross-chain hooks read-only and outside policy fact sourcing", async () => {
    const { bundle, payload } = await harness.issueRwaBundleAndPayload();
    const beforeDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: payload.holderAuthorization.policyId,
      policyVersion: payload.policyVersion,
      payload,
      credentialBundles: [bundle],
    });

    const snapshot = await buildStateSnapshot(harness.urls.analyzer, harness.rwaIdentity.identityId);
    const message = await buildCrossChainStateMessage(harness.urls.analyzer, harness.rwaIdentity.identityId, 10);
    const afterDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: payload.holderAuthorization.policyId,
      policyVersion: payload.policyVersion,
      payload,
      credentialBundles: [bundle],
    });

    expect(assertCrossChainHookGuardrails(snapshot.guardrails).writesState).toBe(false);
    expect(message.guardrails.policyFactSource).toBe(false);
    expect(beforeDecision.decision).toBe(afterDecision.decision);
  }, 900_000);

  it("keeps recovery hooks passive-only even when slots and intents are present", () => {
    const root = {
      ...deriveRootIdentity(harness.rootIdentity.controllerAddress, 31337),
      guardianSetRef: "guardians:test",
      recoveryPolicySlotId: "slot-test",
    };

    registerRecoveryPolicySlot({
      policySlotId: "slot-test",
      rootIdentityId: root.identityId,
      enabled: true,
      minGuardianApprovals: 2,
      cooldownSeconds: 3600,
      scope: "root_only",
      allowedRecoveryActions: ["unlock"],
      createdAt: new Date("2026-03-18T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-03-18T00:00:00.000Z").toISOString(),
    });
    registerRecoveryGuardians(root.identityId, [
      {
        guardianId: "guardian-1",
        guardianType: "address",
        guardianRef: "0x00000000000000000000000000000000000000a1",
        role: "primary",
        weight: 1,
        addedAt: new Date("2026-03-18T00:00:00.000Z").toISOString(),
        status: "active",
      },
    ]);
    createRecoveryIntent(
      {
        intentId: "intent-1",
        rootIdentityId: root.identityId,
        action: "unlock",
        initiatedBy: "guardian-1",
        createdAt: new Date("2026-03-18T01:00:00.000Z").toISOString(),
      },
      { governanceEmergencyFreeze: true },
    );

    const snapshot = getRecoveryHooksSnapshot(root);

    expect(assertRecoveryHooksRemainPassive().executesRecoveryAction).toBe(false);
    expect(assertRecoveryHooksRemainPassive().participatesInAccessPolicy).toBe(false);
    expect(snapshot.policySlot?.allowedRecoveryActions).toEqual(["unlock"]);
    expect(snapshot.intents[0]?.blockedReason).toMatch(/emergency freeze/i);
  });

  it("keeps proof privacy metadata backward compatible with current verification semantics", () => {
    const descriptor = getProofDescriptorSafe("credential_bound_proof");
    const fallbackDescriptor = getProofDescriptorSafe({} as any);

    expect(assertProofPrivacyGuardrails(proofPrivacyGuardrails).changesVerifySemantics).toBe(false);
    expect(descriptor.privacyMode).toBe("credential_bound");
    expect(fallbackDescriptor.privacyMode).toBe("holder_binding");
  });
});
