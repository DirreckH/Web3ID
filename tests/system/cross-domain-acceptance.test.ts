import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { policyIds } from "../../packages/sdk/src/index.js";
import { type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";

describe.sequential("phase4 cross-domain acceptance", () => {
  let harness: ServiceHarness | undefined;

  beforeAll(async () => {
    harness = await createSystemHarness(14755);
  }, 900_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("ingests attested cross-chain messages as hints without directly rewriting local state", async () => {
    const beforeContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rwaIdentity.identityId}/risk-context`);

    const generated = await harness.postJson<any>(`${harness.urls.analyzer}/cross-chain/messages/create`, {
      identityId: harness.rwaIdentity.identityId,
      targetChainId: 10,
      targetDomain: "chain:10",
      consumerPolicyHint: "eligibility_signal",
      idempotencyKey: "phase4-crosschain-create",
    });

    expect(generated.message.versionEnvelope.schemaVersion).toBeTruthy();
    expect(generated.message.trustProfile).toBe("attested_sync");

    const ingested = await harness.postJson<any>(`${harness.urls.analyzer}/cross-chain/inbox/ingest`, {
      message: generated.message,
      idempotencyKey: "phase4-crosschain-ingest",
    });
    expect(ingested.verification.verified).toBe(true);
    expect(ingested.verification.reasonCode).toBe("OK");

    const consumed = await harness.postJson<any>(`${harness.urls.analyzer}/cross-chain/inbox/${ingested.inboxId}/consume`, {
      actor: "phase4.operator",
      effect: "eligibility_noted",
      idempotencyKey: "phase4-crosschain-consume",
    });
    expect(consumed.consumed).toBe(true);
    expect(consumed.consumptionTrace.effect).toBe("eligibility_noted");

    const tampered = structuredClone(generated.message);
    tampered.targetDomain = "chain:999";
    const tamperedInbox = await harness.postJson<any>(`${harness.urls.analyzer}/cross-chain/inbox/ingest`, {
      message: tampered,
    });
    expect(tamperedInbox.verification.verified).toBe(false);
    expect(tamperedInbox.verification.reasonCode).toBe("TAMPERED");

    const afterContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rwaIdentity.identityId}/risk-context`);
    expect(afterContext.summary.storedState).toBe(beforeContext.summary.storedState);
    expect(afterContext.summary.effectiveState).toBe(beforeContext.summary.effectiveState);
    expect(afterContext.crossChainInbox.some((item: any) => item.consumed && item.verification.verified)).toBe(true);

    const accessDecision = await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: policyIds.RWA_BUY_V2,
      policyVersion: 1,
    });
    expect(accessDecision.decision).toBe("deny");
    expect(accessDecision.crossChainHints.eligibilitySignals).toBeGreaterThanOrEqual(1);
  }, 900_000);
});
