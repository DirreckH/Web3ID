import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execa } from "execa";
import type { GeneratedProof, HolderBindingContext } from "./types.js";

const snarkjsBinary = resolve(
  import.meta.dirname,
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "snarkjs.CMD" : "snarkjs",
);

export async function generateProofNode(
  witness: Record<string, any>,
  context: Required<Pick<HolderBindingContext, "wasmPath" | "zkeyPath">>,
): Promise<GeneratedProof> {
  const workingDir = await mkdtemp(resolve(tmpdir(), "web3id-proof-"));
  const inputPath = resolve(workingDir, "input.json");
  const proofPath = resolve(workingDir, "proof.json");
  const publicPath = resolve(workingDir, "public.json");

  try {
    await writeFile(
      inputPath,
      JSON.stringify(witness, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2),
      "utf8",
    );
    await execa(
      snarkjsBinary,
      ["groth16", "fullprove", inputPath, context.wasmPath, context.zkeyPath, proofPath, publicPath],
      { stdio: "inherit" },
    );

    const proof = JSON.parse(await readFile(proofPath, "utf8"));
    const publicSignals = JSON.parse(await readFile(publicPath, "utf8")) as string[];

    return {
      proof,
      publicSignals: publicSignals.map((value) => BigInt(value)),
      solidityProof: toSolidityProof(proof),
    };
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
}

function toSolidityProof(proof: any): GeneratedProof["solidityProof"] {
  return [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]),
    BigInt(proof.pi_b[0][0]),
    BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_b[1][0]),
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ];
}
