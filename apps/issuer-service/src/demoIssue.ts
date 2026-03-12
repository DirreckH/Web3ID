import { POLICY_IDS } from "@web3id/policy";
import { deriveRootIdentity } from "@web3id/identity";
import { issueCredential } from "./service.js";

async function main() {
  const holder = process.argv[2];
  const subjectAddress = process.argv[3];
  const kind = (process.argv[4] ?? "kycAml") as "kycAml" | "accreditedInvestor" | "entity";

  if (!holder || !subjectAddress) {
    throw new Error("Usage: pnpm demo:issue <holderDid> <subjectAddress> [kycAml|accreditedInvestor|entity]");
  }

  const rootIdentity = deriveRootIdentity(subjectAddress as `0x${string}`);
  const record = await issueCredential({
    holder,
    holderIdentityId: rootIdentity.identityId,
    subjectAddress: subjectAddress as `0x${string}`,
    credentialType:
      kind === "entity"
        ? "0x8d8e1688fe0b4dd8633ab27082153c8a6400e6df8acb6a618ed9e2354299f0c3"
        : kind === "accreditedInvestor"
          ? "0x75c72683458f77a84a2f8c65f0b437e6f4f8f8fbba9b766777551d4d0aa89e53"
          : "0x2d8d9ea59f90d99277dc8f13fdd2869b2babbe95d0d5a793bcee66475d27be27",
    credentialTypeLabel:
      kind === "entity" ? "EntityCredential" : kind === "accreditedInvestor" ? "AccreditedInvestorCredential" : "KycAmlCredential",
    claimSet:
      kind === "entity"
        ? { entityName: "Acme Treasury", jurisdiction: "SG", auditReady: true }
        : { amlPassed: true, nonUSResident: true, accreditedInvestor: kind === "accreditedInvestor" },
    policyHints: kind === "entity" ? [POLICY_IDS.ENTITY_PAYMENT_V1, POLICY_IDS.ENTITY_AUDIT_V1] : [POLICY_IDS.RWA_BUY_V2],
  });

  console.log(JSON.stringify(record.bundle, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
