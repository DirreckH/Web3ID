import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBindingChallenge } from "../../packages/risk/src/index.js";
import {
  createAptosFixture,
  createControllerChallengeFixture,
  createCosmosFixture,
  createSuiFixture,
  createTonFixture,
  createTronFixture,
} from "../../packages/identity/src/controller-test-helpers.js";
import { deriveRootIdentity, verifyControllerChallenge } from "../../packages/identity/src/index.js";
import {
  createAggregateRecord,
  linkControllerRootToAggregate,
  registerAndBindControllerRoot,
  resetMainstreamAnalyzerState,
} from "./mainstream-helpers.js";

describe("mainstream chains aggregate acceptance", () => {
  beforeEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  afterEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  it("keeps aggregate membership explicit and duplicate links idempotent across new families", async () => {
    const tron = createTronFixture("0x1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f");
    const aptos = createAptosFixture("0x0303030303030303030303030303030303030303030303030303030303030303");

    const tronRoot = await registerAndBindControllerRoot({
      controllerRef: tron.controllerRef,
      candidateProofFactory: (challengeMessage) => tron.signChallenge(challengeMessage),
    });
    const aggregate = await createAggregateRecord();

    expect(tronRoot.riskContext.subjectAggregate).toBeNull();

    const firstLink = await linkControllerRootToAggregate({
      subjectAggregateId: aggregate.subjectAggregateId,
      controllerRef: tron.controllerRef,
      rootIdentityId: tronRoot.rootIdentity.identityId,
      candidateProofFactory: (challengeMessage) => tron.signChallenge(challengeMessage),
    });
    const duplicateLink = await linkControllerRootToAggregate({
      subjectAggregateId: aggregate.subjectAggregateId,
      controllerRef: tron.controllerRef,
      rootIdentityId: tronRoot.rootIdentity.identityId,
      candidateProofFactory: (challengeMessage) => tron.signChallenge(challengeMessage),
    });
    const aptosLink = await linkControllerRootToAggregate({
      subjectAggregateId: aggregate.subjectAggregateId,
      controllerRef: aptos.controllerRef,
      candidateProofFactory: (challengeMessage) => aptos.signMessage(challengeMessage),
    });

    expect(duplicateLink.binding.bindingId).toBe(firstLink.binding.bindingId);
    expect(aptosLink.aggregate.linkedRootIds).toContain(tronRoot.rootIdentity.identityId);
    expect(aptosLink.aggregate.linkedRootIds.length).toBe(2);
  });

  it("rejects replay, expired, tampered, and wrong-network proofs while keeping EVM compatibility stable", async () => {
    const evmAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
    const legacyRoot = deriveRootIdentity(evmAddress, 1);
    const registryRoot = deriveRootIdentity({
      chainFamily: "evm",
      networkId: 1,
      address: evmAddress,
    });
    expect(registryRoot.rootId).toBe(legacyRoot.rootId);

    const tron = createTronFixture("0x1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f");
    const replayChallenge = createBindingChallenge({
      bindingType: "root_controller",
      controllerRef: tron.controllerRef,
      createdAt: "2030-03-22T00:00:00.000Z",
    });
    await expect(
      verifyControllerChallenge({
        challenge: replayChallenge,
        candidateProof: tron.signChallenge(replayChallenge.challengeMessage),
        consumedReplayKeys: new Set([replayChallenge.replayKey]),
      }),
    ).rejects.toThrow(/replay/i);

    const ton = createTonFixture("0x0101010101010101010101010101010101010101010101010101010101010101");
    const expiredChallenge = createControllerChallengeFixture({
      controllerRef: ton.controllerRef,
      issuedAt: "2020-03-09T16:00:00.000Z",
      expiresAt: "2020-03-09T18:00:00.000Z",
    });
    await expect(
      verifyControllerChallenge({
        challenge: expiredChallenge,
        candidateProof: ton.signChallenge(expiredChallenge.challengeMessage, 1_583_774_400),
      }),
    ).rejects.toThrow(/expired/i);

    const cosmos = createCosmosFixture("0x0202020202020202020202020202020202020202020202020202020202020202");
    const wrongNetworkChallenge = createControllerChallengeFixture({ controllerRef: cosmos.controllerRef });
    const wrongNetworkProof = cosmos.signDirect(wrongNetworkChallenge.challengeMessage);
    wrongNetworkProof.proofPayload.chainId = "cosmoshub-4";
    await expect(
      verifyControllerChallenge({
        challenge: wrongNetworkChallenge,
        candidateProof: wrongNetworkProof,
      }),
    ).rejects.toThrow(/chainId/i);

    const sui = createSuiFixture("0x0404040404040404040404040404040404040404040404040404040404040404");
    const tamperChallenge = createControllerChallengeFixture({ controllerRef: sui.controllerRef });
    const tamperedProof = sui.signEd25519(tamperChallenge.challengeMessage);
    tamperedProof.proofPayload.messageBytes = "0xdeadbeef";
    await expect(
      verifyControllerChallenge({
        challenge: tamperChallenge,
        candidateProof: tamperedProof,
      }),
    ).rejects.toThrow(/canonical challenge message/i);
  });
});
