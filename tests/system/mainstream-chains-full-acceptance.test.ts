import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportStructuredAudit } from "../../apps/analyzer-service/src/service.js";
import { createAptosFixture, createCosmosFixture, createSuiFixture, createTonFixture } from "../../packages/identity/src/controller-test-helpers.js";
import { registerAndBindControllerRoot, resetMainstreamAnalyzerState } from "./mainstream-helpers.js";

describe("mainstream chains full acceptance", () => {
  beforeEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  afterEach(async () => {
    await resetMainstreamAnalyzerState();
  });

  it("covers optional offline proof variants beyond the smoke baseline", async () => {
    const cosmos = createCosmosFixture("0x0202020202020202020202020202020202020202020202020202020202020202");
    const aptos = createAptosFixture("0x0303030303030303030303030303030303030303030303030303030303030303");
    const sui = createSuiFixture("0x0404040404040404040404040404040404040404040404040404040404040404");

    const cosmosLegacy = await registerAndBindControllerRoot({
      controllerRef: { ...cosmos.controllerRef, proofType: "cosmos_adr036_legacy_amino" },
      candidateProofFactory: (challengeMessage) => cosmos.signLegacy(challengeMessage),
    });
    const aptosSiwa = await registerAndBindControllerRoot({
      controllerRef: { ...aptos.controllerRef, proofType: "aptos_siwa" },
      candidateProofFactory: (challengeMessage) => aptos.signSiwa(challengeMessage),
    });

    const suiSecp256k1Seed = sui.signSecp256k1("fixture");
    const suiSecp256k1 = await registerAndBindControllerRoot({
      controllerRef: {
        ...sui.controllerRef,
        proofType: "sui_personal_message_secp256k1",
        signatureScheme: "secp256k1",
        address: suiSecp256k1Seed.proofPayload.address,
        publicKeyHint: suiSecp256k1Seed.publicKey,
      },
      candidateProofFactory: (challengeMessage) => sui.signSecp256k1(challengeMessage),
    });

    const suiSecp256r1Seed = sui.signSecp256r1("fixture");
    const suiSecp256r1 = await registerAndBindControllerRoot({
      controllerRef: {
        ...sui.controllerRef,
        proofType: "sui_personal_message_secp256r1",
        signatureScheme: "secp256r1",
        address: suiSecp256r1Seed.proofPayload.address,
        publicKeyHint: suiSecp256r1Seed.publicKey,
      },
      candidateProofFactory: (challengeMessage) => sui.signSecp256r1(challengeMessage),
    });

    expect(cosmosLegacy.binding.proofEnvelopeSummary?.proofType).toBe("cosmos_adr036_legacy_amino");
    expect(aptosSiwa.binding.proofEnvelopeSummary?.proofType).toBe("aptos_siwa");
    expect(suiSecp256k1.binding.proofEnvelopeSummary?.signatureScheme).toBe("secp256k1");
    expect(suiSecp256r1.binding.proofEnvelopeSummary?.signatureScheme).toBe("secp256r1");
    expect(cosmosLegacy.binding.usedFallbackResolver).toBe(false);
    expect(aptosSiwa.binding.usedFallbackResolver).toBe(false);
    expect(suiSecp256k1.binding.usedFallbackResolver).toBe(false);
    expect(suiSecp256r1.binding.usedFallbackResolver).toBe(false);
  });

  it("keeps structured audit export backward compatible while surfacing proof envelope summaries", async () => {
    const ton = createTonFixture("0x0101010101010101010101010101010101010101010101010101010101010101");
    const tonResult = await registerAndBindControllerRoot({
      controllerRef: ton.controllerRef,
      candidateProofFactory: (challengeMessage) => ton.signChallenge(challengeMessage),
    });

    const audit = await exportStructuredAudit({ identityId: tonResult.rootIdentity.identityId });
    const bindingRecord = audit.records.find((record) => record.action === "BINDING_CREATED");
    const metadata = bindingRecord?.metadata as Record<string, unknown> | undefined;
    const proofEnvelopeSummary = metadata?.proofEnvelopeSummary as Record<string, unknown> | undefined;

    expect(tonResult.binding.usedFallbackResolver).toBe(false);
    expect(Array.isArray(audit.records)).toBe(true);
    expect(Array.isArray(audit.auditRecords)).toBe(true);
    expect(audit.records.length).toBe(audit.auditRecords.length);
    expect(audit.generatedAt).toBeTruthy();
    expect(audit.versionEnvelope).toBeTruthy();
    expect(proofEnvelopeSummary?.proofType).toBe("ton_proof_v2");
    expect(metadata?.proofEnvelopeVersion).toBe("1");
    expect(metadata?.networkId).toBe("mainnet");
    expect(typeof metadata?.challengeDigest).toBe("string");
  });
});
