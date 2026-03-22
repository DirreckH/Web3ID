import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import { createSameRootProof, createSubIdentityLinkProof, deriveRootIdentity, listDefaultSubIdentities, SubIdentityType } from "../../../packages/identity/src/index.js";
import { buildSameRootAuthorizationMessage } from "../../../packages/risk/src/index.js";
import { IdentityState, createExplanationBlock } from "../../../packages/state/src/index.js";
import { analyzerConfig } from "./config.js";
import {
  applyManualRelease,
  createBindingChallengeRecord,
  createSubjectAggregate,
  exportIdentityAudit,
  getRiskContext,
  getSubjectAggregate,
  listSubjectAggregateControllers,
  listSubjectAggregateRoots,
  recomputeIdentity,
  registerIdentityTree,
  shutdownAnalyzerWatchers,
  submitBinding,
} from "./service.js";
import { loadStore, saveStore } from "./store.js";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const SECOND_PRIVATE_KEY = "0x5de4111afa1a4b94908f83103e0a14158d1c3f28f1c0a4e22ea39bdeef3c4f5d" as const;
const account = privateKeyToAccount(PRIVATE_KEY);
const extensionAccount = privateKeyToAccount(SECOND_PRIVATE_KEY);
const rootIdentity = deriveRootIdentity(account.address, 31337);
const subIdentities = listDefaultSubIdentities(rootIdentity);
const rwaIdentity = subIdentities.find((item) => item.type === SubIdentityType.RWA_INVEST)!;
const paymentsIdentity = subIdentities.find((item) => item.type === SubIdentityType.PAYMENTS)!;

describe("analyzer service", () => {
  beforeEach(async () => {
    shutdownAnalyzerWatchers();
    await rm(analyzerConfig.dataFile, { force: true });
  });

  afterEach(async () => {
    shutdownAnalyzerWatchers();
    await rm(analyzerConfig.dataFile, { force: true });
  });

  it("records signed bindings, recomputes mixer risk, and applies manual release floors", async () => {
    await registerIdentityTree({ rootIdentity, subIdentities });

    const challenge = await createBindingChallengeRecord({
      bindingType: "root_controller",
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
    });
    const signature = await account.signMessage({ message: challenge.challengeMessage });
    await submitBinding({
      challengeId: challenge.challengeId,
      candidateSignature: signature,
    });

    const subChallenge = await createBindingChallengeRecord({
      bindingType: "sub_identity_link",
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: rwaIdentity.identityId,
    });
    const subSignature = await account.signMessage({ message: subChallenge.challengeMessage });
    const binding = await submitBinding({
      challengeId: subChallenge.challengeId,
      candidateSignature: subSignature,
      linkProof: createSubIdentityLinkProof(rootIdentity, rwaIdentity),
    });

    const store = await loadStore();
    store.events["mixer-event"] = {
      eventId: "mixer-event",
      chainId: 31337,
      txHash: "0x0000000000000000000000000000000000000000000000000000000000000123",
      txIndex: 0,
      blockNumber: 1n,
      blockTimestamp: new Date("2026-03-16T00:00:00Z").toISOString(),
      address: account.address,
      direction: "outgoing",
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: rwaIdentity.identityId,
      bindingId: binding.bindingId,
      kind: "mixer_interaction",
      label: "Mixer interaction",
      protocolTags: ["mixer"],
      counterparty: "0x1000000000000000000000000000000000000001",
      value: 0n,
      rawRef: "chain:31337:tx:0x123",
      evidenceRefs: ["tx:0x123", "binding:root-controller"],
    };
    await saveStore(store);

    const recomputed = await recomputeIdentity({ identityId: rwaIdentity.identityId });
    expect(recomputed.summary?.storedState).toBe(IdentityState.HIGH_RISK);
    expect(recomputed.summary?.effectiveState).toBe(IdentityState.HIGH_RISK);
    expect(recomputed.summary?.reasonCodes).toContain("MIXER_INTERACTION");
    expect(recomputed.bindings).toHaveLength(1);
    expect(recomputed.anchors.some((entry: { status: string }) => entry.status === "PENDING")).toBe(true);

    const released = await applyManualRelease({
      identityId: rwaIdentity.identityId,
      actor: "risk-ops",
      reasonCode: "MANUAL_RELEASE_REVIEWED",
      evidenceRefs: ["manual:review:1"],
    });
    expect(released.summary?.storedState).toBe(IdentityState.RESTRICTED);
    expect(released.summary?.warnings.some((warning: string) => warning.includes("Manual release observation floor"))).toBe(true);

    const audit = await exportIdentityAudit(rwaIdentity.identityId);
    expect(audit.records.some((record: { action: string }) => record.action === "BINDING_CREATED")).toBe(true);
    expect(audit.records.some((record: { action: string }) => record.action === "MANUAL_RELEASE_APPLIED")).toBe(true);
  });

  it("supports same-root extension bindings and expires stale review items on recompute", async () => {
    await registerIdentityTree({ rootIdentity, subIdentities });

    const rootChallenge = await createBindingChallengeRecord({
      bindingType: "root_controller",
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
    });
    await submitBinding({
      challengeId: rootChallenge.challengeId,
      candidateSignature: await account.signMessage({ message: rootChallenge.challengeMessage }),
    });

    const sameRootChallenge = await createBindingChallengeRecord({
      bindingType: "same_root_extension",
      controllerRef: deriveRootIdentity(extensionAccount.address, 31337).primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
    });
    const extensionBinding = await submitBinding({
      challengeId: sameRootChallenge.challengeId,
      candidateSignature: await extensionAccount.signMessage({ message: sameRootChallenge.challengeMessage }),
      sameRootProof: createSameRootProof(rootIdentity, [rwaIdentity, paymentsIdentity]),
      authorizerAddress: account.address,
      authorizerSignature: await account.signMessage({
        message: buildSameRootAuthorizationMessage({
          challengeHash: sameRootChallenge.challengeHash,
          candidateAddress: extensionAccount.address,
          rootIdentityId: rootIdentity.identityId,
          authorizerAddress: account.address,
        }),
      }),
    });

    if (!extensionBinding.address) {
      throw new Error("Expected same-root extension binding to preserve its EVM address.");
    }
    expect(extensionBinding.address.toLowerCase()).toBe(extensionAccount.address.toLowerCase());
    expect(extensionBinding.evidenceRefs.some((ref) => ref.startsWith("same-root-proof:"))).toBe(true);
    expect(extensionBinding.evidenceRefs.some((ref) => ref.startsWith("authorizer:"))).toBe(true);

    const store = await loadStore();
    store.aiSuggestions["stale-suggestion"] = {
      id: "stale-suggestion",
      identityId: rwaIdentity.identityId,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: rwaIdentity.identityId,
      kind: "risk_hint",
      severity: "high",
      summary: "Stale review item",
      evidenceRefs: ["tx:0x999"],
      recommendedAction: "review",
      modelInfo: { provider: "deterministic", model: "fallback-template", promptVersion: "test" },
      createdAt: new Date("2026-03-01T00:00:00Z").toISOString(),
    } as any;
    store.reviewQueue["stale-review"] = {
      reviewItemId: "stale-review",
      identityId: rwaIdentity.identityId,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: rwaIdentity.identityId,
      sourceSuggestionId: "stale-suggestion",
      status: "PENDING_REVIEW",
      createdAt: new Date("2026-03-01T00:00:00Z").toISOString(),
      expiresAt: new Date("2026-03-02T00:00:00Z").toISOString(),
      evidenceRefs: ["tx:0x999"],
      explanation: createExplanationBlock({
        reasonCode: "PENDING_REVIEW",
        explanationSummary: "Pending human review is required before any state write.",
        evidenceRefs: ["tx:0x999"],
        actorType: "ai",
        actorId: "stale-suggestion",
        aiContribution: true,
      }),
    };
    await saveStore(store);

    const recomputed = await recomputeIdentity({ identityId: rwaIdentity.identityId });
    expect(recomputed.reviewQueue.find((item: { reviewItemId: string }) => item.reviewItemId === "stale-review")?.status).toBe("EXPIRED");
    expect(recomputed.aiSuggestions.find((item: { id: string }) => item.id === "stale-suggestion")?.audit.recommendedAction).toBe("review");

    const audit = await exportIdentityAudit(rwaIdentity.identityId);
    expect(audit.records.some((record: { action: string }) => record.action === "AI_REVIEW_ITEM_EXPIRED")).toBe(true);
  });

  it("creates subject aggregates and links roots only through explicit aggregate bindings", async () => {
    await registerIdentityTree({ rootIdentity, subIdentities });

    const aggregate = await createSubjectAggregate({
      actor: "risk-ops",
      evidenceRefs: ["manual:aggregate:create"],
    });

    const primaryRootChallenge = await createBindingChallengeRecord({
      bindingType: "subject_aggregate_link",
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
      subjectAggregateId: aggregate.subjectAggregateId,
    });
    await submitBinding({
      challengeId: primaryRootChallenge.challengeId,
      candidateSignature: await account.signMessage({ message: primaryRootChallenge.challengeMessage }),
    });

    const secondaryRoot = deriveRootIdentity(extensionAccount.address, 31337);
    const secondaryRootChallenge = await createBindingChallengeRecord({
      bindingType: "subject_aggregate_link",
      controllerRef: secondaryRoot.primaryControllerRef,
      subjectAggregateId: aggregate.subjectAggregateId,
    });
    await submitBinding({
      challengeId: secondaryRootChallenge.challengeId,
      candidateSignature: await extensionAccount.signMessage({ message: secondaryRootChallenge.challengeMessage }),
    });

    const linkedAggregate = await getSubjectAggregate(aggregate.subjectAggregateId);
    expect(linkedAggregate.linkedRootIds).toContain(rootIdentity.identityId);
    expect(linkedAggregate.linkedRootIds).toContain(secondaryRoot.identityId);

    const controllers = await listSubjectAggregateControllers(aggregate.subjectAggregateId);
    expect(controllers.some((item) => item.controllerRef.normalizedAddress.toLowerCase() === account.address.toLowerCase())).toBe(true);
    expect(controllers.some((item) => item.controllerRef.normalizedAddress.toLowerCase() === extensionAccount.address.toLowerCase())).toBe(true);

    const roots = await listSubjectAggregateRoots(aggregate.subjectAggregateId);
    expect(roots).toHaveLength(2);

    const linkedRootContext = await getRiskContext(secondaryRoot.identityId);
    expect(linkedRootContext.rootIdentity.subjectAggregateId).toBe(aggregate.subjectAggregateId);
    expect(linkedRootContext.subjectAggregate?.subjectAggregateId).toBe(aggregate.subjectAggregateId);
  });
});
