import { addressToBytes, computeSubjectBinding, parseCredentialBundle, verifyCredentialBundle, type CredentialBundle } from "@web3id/credential";
import { getAddress, type Address } from "viem";

export type CircuitInput = {
  statementSignal: bigint;
  subjectBytes: bigint[];
};

export async function buildCircuitInput(bundle: CredentialBundle, subjectAddress: Address): Promise<{
  bundle: CredentialBundle;
  circuitInput: CircuitInput;
  publicSignals: [bigint];
}> {
  const parsedBundle = parseCredentialBundle(bundle);
  const verified = verifyCredentialBundle(parsedBundle);
  if (!verified.valid) {
    throw new Error("credential bundle hash mismatch");
  }

  const subject = getAddress(subjectAddress);
  const expectedSubjectBinding = computeSubjectBinding(subject);

  if (expectedSubjectBinding.toLowerCase() !== parsedBundle.attestation.subjectBinding.toLowerCase()) {
    throw new Error("subject binding mismatch");
  }

  return {
    bundle: parsedBundle,
    ...buildSubjectCircuitInput(subject),
  };
}

export function buildSubjectCircuitInput(subjectAddress: Address): {
  circuitInput: CircuitInput;
  publicSignals: [bigint];
} {
  const subject = getAddress(subjectAddress);
  const subjectBinding = computeSubjectBinding(subject);

  return {
    publicSignals: [BigInt(subjectBinding)],
    circuitInput: {
      statementSignal: BigInt(subjectBinding),
      subjectBytes: addressToBytes(subject),
    },
  };
}
