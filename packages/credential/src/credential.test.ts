import { describe, expect, it } from "vitest";
import { CREDENTIAL_TYPES, computeClaimsHash, computeCredentialHash, computePolicyHintsHash, computeSubjectBinding, createCredentialBundle, verifyCredentialBundle } from "./index.js";

describe("credential helpers", () => {
  it("computes stable hashes for claims and policy hints", () => {
    expect(computeClaimsHash({ b: 2, a: 1 })).toBe(computeClaimsHash({ a: 1, b: 2 }));
    expect(
      computePolicyHintsHash([
        "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`,
        "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`,
      ]),
    ).toBe(
      computePolicyHintsHash([
        "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`,
        "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`,
      ]),
    );
  });

  it("creates verifiable credential bundles", () => {
    const subjectBinding = computeSubjectBinding("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const bundle = createCredentialBundle({
      credentialId: "cred-1",
      issuerDid: "did:ethr:0x0000000000000000000000000000000000000010",
      issuerAddress: "0x0000000000000000000000000000000000000010",
      holder: "did:pkh:eip155:31337:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      holderIdentityId: "0x0000000000000000000000000000000000000000000000000000000000000100" as `0x${string}`,
      credentialType: CREDENTIAL_TYPES.KYC_AML,
      credentialTypeLabel: "KycAmlCredential",
      subjectBinding,
      claimSet: { amlPassed: true },
      expiry: Math.floor(Date.now() / 1000) + 3600,
      revocationId: "0x0000000000000000000000000000000000000000000000000000000000000200" as `0x${string}`,
      policyHints: ["0x0000000000000000000000000000000000000000000000000000000000000300" as `0x${string}`],
      signature: "0x1234" as `0x${string}`,
    });

    expect(verifyCredentialBundle(bundle).valid).toBe(true);
    expect(bundle.attestation.credentialHash).toBe(
      computeCredentialHash({
        credentialType: bundle.attestation.credentialType as `0x${string}`,
        revocationId: bundle.attestation.revocationId as `0x${string}`,
        subjectBinding,
        issuer: bundle.attestation.issuer as `0x${string}`,
        expiration: bundle.attestation.expiration,
        claimsHash: computeClaimsHash(bundle.credential.claimSet),
        policyHintsHash: computePolicyHintsHash(bundle.attestation.policyHints as `0x${string}`[]),
      }),
    );
  });
});
