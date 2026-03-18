import type { CredentialBundle } from "@web3id/credential";
import type { Address } from "viem";
import type { ProofDescriptor } from "./interfaces.js";

export type ProofMode = "browser" | "node";

export type HolderBindingContext = {
  mode?: ProofMode;
  subjectAddress: Address;
  subjectBindingType?: "root" | "sub";
  artifactsBasePath?: string;
  wasmPath?: string;
  zkeyPath?: string;
};

export type HolderBindingInput = {
  proofPoints: [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];
  publicSignals: [bigint];
};

export type GeneratedProof = {
  proof: unknown;
  publicSignals: bigint[];
  solidityProof: HolderBindingInput["proofPoints"];
};

export type GenerateHolderBindingProofResult = GeneratedProof & HolderBindingInput & { bundle: CredentialBundle; descriptor: ProofDescriptor };
export type GenerateHolderBoundProofResult = GeneratedProof & HolderBindingInput & { descriptor: ProofDescriptor };
