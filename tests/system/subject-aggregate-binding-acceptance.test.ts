import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";
import { createSubjectAggregateRecord, linkRootToAggregate, primaryAggregateAccount, secondaryAggregateAccount } from "./aggregate-helpers.js";

describe.sequential("subject aggregate binding acceptance", () => {
  let harness: ServiceHarness | undefined;

  beforeAll(async () => {
    harness = await createSystemHarness(14655);
  }, 900_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("does not merge roots silently and keeps duplicate aggregate links idempotent", async () => {
    const initialRootContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rootIdentity.identityId}/risk-context`);
    expect(initialRootContext.subjectAggregate).toBeNull();

    const aggregate = await createSubjectAggregateRecord(harness, {
      actor: "risk-ops",
      evidenceRefs: ["system:aggregate:create"],
    });
    const beforeLinkRoots = await harness.getJson<any>(`${harness.urls.analyzer}/subject-aggregates/${aggregate.subjectAggregateId}/roots`);
    expect(beforeLinkRoots.items).toHaveLength(0);

    const firstLink = await linkRootToAggregate(harness, {
      account: primaryAggregateAccount,
      rootIdentityId: harness.rootIdentity.identityId,
      subjectAggregateId: aggregate.subjectAggregateId,
    });
    const duplicateLink = await linkRootToAggregate(harness, {
      account: primaryAggregateAccount,
      rootIdentityId: harness.rootIdentity.identityId,
      subjectAggregateId: aggregate.subjectAggregateId,
    });
    const secondLink = await linkRootToAggregate(harness, {
      account: secondaryAggregateAccount,
      subjectAggregateId: aggregate.subjectAggregateId,
    });

    expect(duplicateLink.binding.bindingId).toBe(firstLink.binding.bindingId);
    expect(secondLink.binding.subjectAggregateId).toBe(aggregate.subjectAggregateId);

    const aggregateView = await harness.getJson<any>(`${harness.urls.analyzer}/subject-aggregates/${aggregate.subjectAggregateId}`);
    expect(aggregateView.linkedRootIds).toContain(harness.rootIdentity.identityId);
    expect(aggregateView.linkedRootIds).toContain(secondLink.rootIdentity.identityId);
    expect(aggregateView.linkedBindings).toHaveLength(2);

    const rootContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rootIdentity.identityId}/risk-context`);
    expect(rootContext.rootIdentity.subjectAggregateId).toBe(aggregate.subjectAggregateId);

    const secondRootContext = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${secondLink.rootIdentity.identityId}/risk-context`);
    expect(secondRootContext.rootIdentity.subjectAggregateId).toBe(aggregate.subjectAggregateId);
    expect(secondRootContext.subjectAggregate.subjectAggregateId).toBe(aggregate.subjectAggregateId);
  }, 900_000);
});
