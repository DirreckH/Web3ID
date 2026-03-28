import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { policyIds } from "../../packages/sdk/src/index.js";
import { DEMO_TARGETS, type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness, waitFor } from "./helpers.js";

describe.sequential("phase4 versioning replay acceptance", () => {
  let harness: ServiceHarness | undefined;

  beforeAll(async () => {
    harness = await createSystemHarness(14955);
  }, 900_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("replays and diffs state changes with version envelopes and explanation-first output", async () => {
    const from = new Date().toISOString();
    const start = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.highRisk);
    const end = await harness.currentBlockNumber();
    await harness.backfillExact(harness.rwaIdentity.identityId, start + 1n, end);

    await waitFor(async () => {
      const context = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rwaIdentity.identityId}/risk-context`);
      return context.summary?.reasonCodes?.length ? context : null;
    }, 120_000, 2_000);

    const { bundle, payload } = await harness.issueRwaBundleAndPayload();
    await harness.postJson<any>(`${harness.urls.policy}/policies/access/evaluate`, {
      identityId: harness.rwaIdentity.identityId,
      policyId: policyIds.RWA_BUY_V2,
      policyVersion: 1,
      payload,
      credentialBundles: [bundle],
    });

    const to = new Date().toISOString();
    const replay = await harness.postJson<any>(`${harness.urls.analyzer}/replay`, {
      identityId: harness.rwaIdentity.identityId,
      asOf: to,
    });
    const diff = await harness.postJson<any>(`${harness.urls.analyzer}/diff`, {
      identityId: harness.rwaIdentity.identityId,
      from,
      to,
    });

    expect(replay.versionEnvelope.schemaVersion).toBeTruthy();
    expect(replay.explanation.length).toBeGreaterThan(0);
    expect(diff.versionEnvelope.schemaVersion).toBeTruthy();
    expect(diff.changes.length).toBeGreaterThan(0);
    expect(diff.summary).toMatch(/Detected/);
  }, 900_000);
});
