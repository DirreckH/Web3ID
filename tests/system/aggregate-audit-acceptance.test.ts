import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";
import { createSubjectAggregateRecord, linkRootToAggregate, primaryAggregateAccount, secondaryAggregateAccount } from "./aggregate-helpers.js";

describe.sequential("aggregate audit acceptance", () => {
  let harness: ServiceHarness;

  beforeAll(async () => {
    harness = await createSystemHarness(14855);
  }, 900_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("records aggregate creation and aggregate links in audit without promoting aggregate into a state host", async () => {
    const aggregate = await createSubjectAggregateRecord(harness, {
      actor: "risk-ops",
      evidenceRefs: ["system:aggregate:audit"],
    });
    await linkRootToAggregate(harness, {
      account: primaryAggregateAccount,
      rootIdentityId: harness.rootIdentity.identityId,
      subjectAggregateId: aggregate.subjectAggregateId,
    });
    await linkRootToAggregate(harness, {
      account: secondaryAggregateAccount,
      subjectAggregateId: aggregate.subjectAggregateId,
    });

    const auditBundle = await harness.postJson<any>(`${harness.urls.analyzer}/audit/export`, {});
    const aggregateView = await harness.getJson<any>(`${harness.urls.analyzer}/subject-aggregates/${aggregate.subjectAggregateId}`);

    expect(auditBundle.records.some((record: any) => record.action === "SUBJECT_AGGREGATE_CREATED")).toBe(true);
    expect(
      auditBundle.records.some(
        (record: any) =>
          record.action === "BINDING_CREATED" &&
          record.metadata?.bindingType === "subject_aggregate_link" &&
          record.metadata?.subjectAggregateId === aggregate.subjectAggregateId &&
          record.metadata?.challengeFields?.domainTag === "web3id.controller.challenge.v1",
      ),
    ).toBe(true);

    expect("storedState" in aggregateView).toBe(false);
    expect("effectiveState" in aggregateView).toBe(false);
    expect("consequences" in aggregateView).toBe(false);
    expect(aggregateView.linkedBindings).toHaveLength(2);
    expect(aggregateView.linkedBindings.every((binding: any) => binding.challengeHash && binding.proofHash)).toBe(true);
  }, 900_000);
});
