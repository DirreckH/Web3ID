import { issueCompatibilityCredential } from "./service.js";

export async function issueCredentialBundle(input: {
  subjectDid: string;
  subjectAddress: `0x${string}`;
  claimOverrides?: {
    amlPassed?: boolean;
    nonUSResident?: boolean;
    accreditedInvestor?: boolean;
    expirationDate?: number;
  };
}) {
  const record = await issueCompatibilityCredential(input);
  return record.bundle;
}
