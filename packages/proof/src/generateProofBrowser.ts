import * as snarkjs from "snarkjs";
import type { GeneratedProof, HolderBindingContext } from "./types.js";

export async function generateProofBrowser(
  witness: Record<string, any>,
  context: Required<Pick<HolderBindingContext, "wasmPath" | "zkeyPath">>,
): Promise<GeneratedProof> {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, context.wasmPath, context.zkeyPath);

  return {
    proof,
    publicSignals: publicSignals.map((value: string) => BigInt(value)) as GeneratedProof["publicSignals"],
    solidityProof: [
      BigInt(proof.pi_a[0]),
      BigInt(proof.pi_a[1]),
      BigInt(proof.pi_b[0][1]),
      BigInt(proof.pi_b[0][0]),
      BigInt(proof.pi_b[1][1]),
      BigInt(proof.pi_b[1][0]),
      BigInt(proof.pi_c[0]),
      BigInt(proof.pi_c[1]),
    ],
  };
}
