import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { deriveRootIdentity, listDefaultSubIdentities } from "@web3id/identity";
import { issuerConfig } from "./config.js";
import {
  applyIdentitySignal,
  getCredentialStatus,
  getStoredIdentityContext,
  issueCompatibilityCredential,
  registerIdentityTree,
  reissueCredential,
  revokeCredential,
  verifyIssuedCredential,
} from "./service.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("issuer service", () => {
  it("issues, verifies, revokes, and reissues credentials", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "web3id-issuer-"));
    issuerConfig.dataFile = resolve(tempDir, "issuer-store.json");

    const issued = await issueCompatibilityCredential({
      subjectDid: "did:pkh:eip155:31337:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      subjectAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    });

    const verified = await verifyIssuedCredential(issued.bundle);
    expect(verified.valid).toBe(true);
    expect(verified.trustedIssuer).toBe(true);

    const revoked = await revokeCredential({ credentialId: issued.bundle.credential.credentialId, reason: "TEST" });
    expect(revoked.revoked).toBe(true);

    const reissued = await reissueCredential({ credentialId: issued.bundle.credential.credentialId });
    expect(reissued.bundle.credential.previousCredentialId).toBe(issued.bundle.credential.credentialId);

    const status = await getCredentialStatus(issued.bundle.credential.credentialId);
    expect(status.revoked).toBe(true);
  });

  it("registers identity trees and applies deterministic demo signals", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "web3id-issuer-"));
    issuerConfig.dataFile = resolve(tempDir, "issuer-store.json");

    const root = deriveRootIdentity("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const subIdentities = listDefaultSubIdentities(root);
    await registerIdentityTree({ rootIdentity: root, subIdentities });

    const social = subIdentities.find((item) => item.scope === "social");
    expect(social).toBeDefined();

    const initialContext = await getStoredIdentityContext(social!.identityId);
    expect(initialContext.currentState).toBe(1);

    await applyIdentitySignal({ identityId: social!.identityId, signalKey: "negative_risk_flag" });
    const updatedContext = await getStoredIdentityContext(social!.identityId);
    expect(updatedContext.currentState).toBe(3);
    expect(updatedContext.activeConsequences[0].consequenceType).toBe("limit");
  });
});
