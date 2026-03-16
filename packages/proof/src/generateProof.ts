import { buildCircuitInput, buildSubjectCircuitInput } from "./witness.js";
import type { GenerateHolderBindingProofResult, GenerateHolderBoundProofResult, HolderBindingContext } from "./types.js";
import type { CredentialBundle } from "@web3id/credential";

const DEFAULT_WASM = "/circuits/web3id-compliance.wasm";
const DEFAULT_ZKEY = "/circuits/web3id-compliance_final.zkey";

export async function generateHolderBindingProof(
  bundle: CredentialBundle,
  context: HolderBindingContext,
): Promise<GenerateHolderBindingProofResult> {
  const prepared = await buildCircuitInput(bundle, context.subjectAddress);
  const wasmPath = context.wasmPath ?? `${context.artifactsBasePath ?? ""}${DEFAULT_WASM}`;
  const zkeyPath = context.zkeyPath ?? `${context.artifactsBasePath ?? ""}${DEFAULT_ZKEY}`;
  const generated =
    context.mode === "browser"
      ? await generateBrowserProof(prepared.circuitInput, { wasmPath, zkeyPath })
      : await generateNodeProof(prepared.circuitInput, { wasmPath, zkeyPath });

  if (generated.publicSignals.length !== 1) {
    throw new Error(`expected exactly 1 holder-binding public signal, received ${generated.publicSignals.length}`);
  }

  if (generated.publicSignals[0] !== prepared.publicSignals[0]) {
    throw new Error(
      `holder-binding mismatch: expected ${prepared.publicSignals[0]} but received ${generated.publicSignals[0]}`,
    );
  }

  return {
    bundle: prepared.bundle,
    proof: generated.proof,
    proofPoints: generated.solidityProof,
    publicSignals: prepared.publicSignals,
    solidityProof: generated.solidityProof,
  };
}

export const generateComplianceProof = generateHolderBindingProof;
export async function generateHolderBoundProof(
  subjectAddress: HolderBindingContext["subjectAddress"],
  context: HolderBindingContext,
): Promise<GenerateHolderBoundProofResult> {
  const prepared = buildSubjectCircuitInput(subjectAddress);
  const wasmPath = context.wasmPath ?? `${context.artifactsBasePath ?? ""}${DEFAULT_WASM}`;
  const zkeyPath = context.zkeyPath ?? `${context.artifactsBasePath ?? ""}${DEFAULT_ZKEY}`;
  const generated =
    context.mode === "browser"
      ? await generateBrowserProof(prepared.circuitInput, { wasmPath, zkeyPath })
      : await generateNodeProof(prepared.circuitInput, { wasmPath, zkeyPath });

  if (generated.publicSignals.length !== 1) {
    throw new Error(`expected exactly 1 holder-binding public signal, received ${generated.publicSignals.length}`);
  }

  if (generated.publicSignals[0] !== prepared.publicSignals[0]) {
    throw new Error(
      `holder-binding mismatch: expected ${prepared.publicSignals[0]} but received ${generated.publicSignals[0]}`,
    );
  }

  return {
    proof: generated.proof,
    proofPoints: generated.solidityProof,
    publicSignals: prepared.publicSignals,
    solidityProof: generated.solidityProof,
  };
}

async function generateBrowserProof(
  witness: Record<string, any>,
  context: Required<Pick<HolderBindingContext, "wasmPath" | "zkeyPath">>,
) {
  const { generateProofBrowser } = await import("./generateProofBrowser.js");
  return generateProofBrowser(witness, context);
}

async function generateNodeProof(
  witness: Record<string, any>,
  context: Required<Pick<HolderBindingContext, "wasmPath" | "zkeyPath">>,
) {
  const loadNodeHelper = Function('return import("./generateProofNode.js")');
  const { generateProofNode } = (await loadNodeHelper()) as typeof import("./generateProofNode.js");
  return generateProofNode(witness, context);
}
