import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";

describe.sequential("phase4 reliability acceptance", () => {
  let harness: ServiceHarness;

  beforeAll(async () => {
    harness = await createSystemHarness(15155);
  }, 900_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("keeps idempotent operations stable and exposes runtime outbox metrics", async () => {
    const beforeRecoveryCases = await harness.getJson<any>(`${harness.urls.analyzer}/recovery/cases?identityId=${harness.socialIdentity.identityId}`);

    const firstRecovery = await harness.postJson<any>(`${harness.urls.analyzer}/recovery/cases`, {
      rootIdentityId: harness.rootIdentity.identityId,
      targetSubIdentityId: harness.socialIdentity.identityId,
      action: "access_path_unlock",
      requestedBy: "phase4.reliability",
      scope: "access_path",
      idempotencyKey: "phase4-reliability-recovery",
    });
    const secondRecovery = await harness.postJson<any>(`${harness.urls.analyzer}/recovery/cases`, {
      rootIdentityId: harness.rootIdentity.identityId,
      targetSubIdentityId: harness.socialIdentity.identityId,
      action: "access_path_unlock",
      requestedBy: "phase4.reliability",
      scope: "access_path",
      idempotencyKey: "phase4-reliability-recovery",
    });
    expect(secondRecovery.caseId).toBe(firstRecovery.caseId);

    const generatedMessage = await harness.postJson<any>(`${harness.urls.analyzer}/cross-chain/messages/create`, {
      identityId: harness.socialIdentity.identityId,
      targetChainId: 8453,
      consumerPolicyHint: "warning_hint",
      idempotencyKey: "phase4-reliability-crosschain-create",
    });
    const repeatedMessage = await harness.postJson<any>(`${harness.urls.analyzer}/cross-chain/messages/create`, {
      identityId: harness.socialIdentity.identityId,
      targetChainId: 8453,
      consumerPolicyHint: "warning_hint",
      idempotencyKey: "phase4-reliability-crosschain-create",
    });
    expect(repeatedMessage.message.messageId).toBe(generatedMessage.message.messageId);

    const firstInbox = await harness.postJson<any>(`${harness.urls.analyzer}/cross-chain/inbox/ingest`, {
      message: generatedMessage.message,
      idempotencyKey: "phase4-reliability-crosschain-ingest",
    });
    const secondInbox = await harness.postJson<any>(`${harness.urls.analyzer}/cross-chain/inbox/ingest`, {
      message: generatedMessage.message,
      idempotencyKey: "phase4-reliability-crosschain-ingest",
    });
    expect(secondInbox.inboxId).toBe(firstInbox.inboxId);

    const afterRecoveryCases = await harness.getJson<any>(`${harness.urls.analyzer}/recovery/cases?identityId=${harness.socialIdentity.identityId}`);
    expect(afterRecoveryCases.items.length).toBe(beforeRecoveryCases.items.length + 1);

    const metrics = await harness.getJson<any>(`${harness.urls.analyzer}/metrics`);
    const outbox = await harness.getJson<any>(`${harness.urls.analyzer}/webhooks/outbox`);
    expect(metrics.pendingWebhookEvents).toBeGreaterThan(0);
    expect(outbox.items.length).toBeGreaterThan(0);
  }, 900_000);
});
