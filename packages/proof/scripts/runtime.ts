import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import { generateHolderBoundProof } from "../src/index.js";
import { buildSubjectCircuitInput } from "../src/witness.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const root = resolve(scriptDir, "..");
export const workspaceRoot = resolve(root, "..", "..");
export const artifactsDir = resolve(root, "artifacts");
export const buildDir = resolve(root, "artifacts-build");
export const frontendCircuitDir = resolve(workspaceRoot, "apps", "frontend", "public", "circuits");
export const contractsGeneratedDir = resolve(workspaceRoot, "contracts", "src", "generated");
export const manifestPath = resolve(artifactsDir, "runtime-manifest.json");
export const sourceDirs = [
  resolve(root, "circuits"),
  resolve(root, "vendor", "circomlib", "circuits"),
  resolve(root, "vendor", "keccak256-circom", "circuits"),
];

export const bundledCircomBinary = resolve(root, "tools", process.platform === "win32" ? "circom.exe" : "circom");
export const circomBinary = existsSync(bundledCircomBinary)
  ? bundledCircomBinary
  : resolve(root, "node_modules", ".bin", process.platform === "win32" ? "circom2.CMD" : "circom2");
export const snarkjsBinary = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "snarkjs.CMD" : "snarkjs");

export const runtimePaths = {
  ptau0: resolve(artifactsDir, "powersOfTau28_0000_20.ptau"),
  ptauFinal: resolve(artifactsDir, "powersOfTau28_final_20.ptau"),
  zkey0: resolve(artifactsDir, "web3id-compliance_0000.zkey"),
  zkeyFinal: resolve(artifactsDir, "web3id-compliance_final.zkey"),
  verificationKey: resolve(artifactsDir, "verification_key.json"),
  smokeFixture: resolve(artifactsDir, "holder-bound-smoke.json"),
  packagedWasmDir: resolve(artifactsDir, "web3id_compliance_js"),
  packagedWasm: resolve(artifactsDir, "web3id_compliance_js", "web3id_compliance.wasm"),
  frontendWasm: resolve(frontendCircuitDir, "web3id-compliance.wasm"),
  frontendZkey: resolve(frontendCircuitDir, "web3id-compliance_final.zkey"),
  frontendVk: resolve(frontendCircuitDir, "verification_key.json"),
  verifierSol: resolve(contractsGeneratedDir, "Groth16Verifier.sol"),
  tempVerifier: resolve(contractsGeneratedDir, "Groth16Verifier.tmp.sol"),
  compileR1cs: resolve(buildDir, "web3id_compliance.r1cs"),
  compileSym: resolve(buildDir, "web3id_compliance.sym"),
  compileWasmDir: resolve(buildDir, "web3id_compliance_js"),
  compileWasm: resolve(buildDir, "web3id_compliance_js", "web3id_compliance.wasm"),
  legacyRootR1cs: resolve(root, "web3id_compliance.r1cs"),
  legacyRootSym: resolve(root, "web3id_compliance.sym"),
  legacyRootWasmDir: resolve(root, "web3id_compliance_js"),
  legacyRootWasm: resolve(root, "web3id_compliance_js", "web3id_compliance.wasm"),
  circuitR1cs: resolve(root, "circuits", "web3id_compliance.r1cs"),
  circuitSym: resolve(root, "circuits", "web3id_compliance.sym"),
  circuitWasmDir: resolve(root, "circuits", "web3id_compliance_js"),
  circuitWasm: resolve(root, "circuits", "web3id_compliance_js", "web3id_compliance.wasm"),
};

export type CacheManifest = {
  circuitFingerprint: string;
};

export type SmokeProofArtifacts = {
  proof: unknown;
  proofPoints: bigint[];
  publicSignals: string[];
  verificationKey: Record<string, unknown>;
  subjectAddress: `0x${string}`;
};

type SmokeProofFixture = {
  subjectAddress: `0x${string}`;
  proofPoints: string[];
  publicSignals: string[];
};

type GenerateSmokeProofOptions = {
  forceGenerate?: boolean;
  persistFixture?: boolean;
};

export function copyIfDifferent(source: string, destination: string, recursive = false) {
  if (resolve(source) === resolve(destination)) {
    return;
  }
  cpSync(source, destination, { recursive, force: true });
}

export function collectCircomFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCircomFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".circom")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function computeCircuitFingerprint() {
  const hash = createHash("sha256");
  const files = sourceDirs.flatMap((directory) => collectCircomFiles(directory)).sort();
  for (const file of files) {
    hash.update(file.replace(root, ""));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

export function readCacheManifest(): CacheManifest | null {
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<CacheManifest>;
    if (typeof parsed.circuitFingerprint !== "string" || parsed.circuitFingerprint.length === 0) {
      return null;
    }
    return { circuitFingerprint: parsed.circuitFingerprint };
  } catch {
    return null;
  }
}

export function writeCacheManifest(circuitFingerprint: string) {
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        circuitFingerprint,
      } satisfies CacheManifest,
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

export function ensureRuntimeDirectories() {
  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });
  mkdirSync(runtimePaths.compileWasmDir, { recursive: true });
  mkdirSync(frontendCircuitDir, { recursive: true });
  mkdirSync(contractsGeneratedDir, { recursive: true });
}

export function cleanupTransientBuildOutputs() {
  rmSync(buildDir, { recursive: true, force: true });
  rmSync(runtimePaths.legacyRootR1cs, { force: true });
  rmSync(runtimePaths.legacyRootSym, { force: true });
  rmSync(runtimePaths.legacyRootWasmDir, { recursive: true, force: true });
  rmSync(runtimePaths.circuitR1cs, { force: true });
  rmSync(runtimePaths.circuitSym, { force: true });
  rmSync(runtimePaths.circuitWasmDir, { recursive: true, force: true });
}

export function cleanRuntimeArtifacts() {
  cleanupTransientBuildOutputs();
  rmSync(runtimePaths.zkey0, { force: true });
  rmSync(runtimePaths.zkeyFinal, { force: true });
  rmSync(runtimePaths.verificationKey, { force: true });
  rmSync(runtimePaths.packagedWasmDir, { recursive: true, force: true });
  rmSync(runtimePaths.frontendWasm, { force: true });
  rmSync(runtimePaths.frontendZkey, { force: true });
  rmSync(runtimePaths.frontendVk, { force: true });
  rmSync(runtimePaths.verifierSol, { force: true });
  rmSync(manifestPath, { force: true });
}

export function listPreflightIssues() {
  const issues: string[] = [];

  if (!existsSync(circomBinary)) {
    issues.push(`circom binary not found at ${circomBinary}`);
  }
  if (!existsSync(snarkjsBinary)) {
    issues.push(`snarkjs binary not found at ${snarkjsBinary}`);
  }
  if (!existsSync(resolve(root, "circuits", "web3id_compliance.circom"))) {
    issues.push("missing circuits/web3id_compliance.circom");
  }
  if (existsSync(manifestPath) && readCacheManifest() === null) {
    issues.push(`invalid runtime manifest at ${manifestPath}`);
  }

  const transientPollution = [
    runtimePaths.legacyRootR1cs,
    runtimePaths.legacyRootSym,
    runtimePaths.legacyRootWasmDir,
    runtimePaths.circuitR1cs,
    runtimePaths.circuitSym,
    runtimePaths.circuitWasmDir,
  ].filter((path) => existsSync(path));
  if (transientPollution.length > 0) {
    issues.push(`transient proof outputs still exist: ${transientPollution.join(", ")}`);
  }

  return issues;
}

export function hasPackagedRuntimeArtifacts() {
  return [runtimePaths.zkeyFinal, runtimePaths.verificationKey, runtimePaths.packagedWasm].every((path) => existsSync(path));
}

export function copyRuntimeArtifacts(sourceWasm: string, sourceWasmDir: string, sourceZkey: string, sourceVk: string) {
  if (resolve(sourceWasmDir) !== resolve(runtimePaths.packagedWasmDir)) {
    rmSync(runtimePaths.packagedWasmDir, { recursive: true, force: true });
  } else {
    mkdirSync(runtimePaths.packagedWasmDir, { recursive: true });
  }

  copyIfDifferent(sourceWasmDir, runtimePaths.packagedWasmDir, true);
  copyIfDifferent(sourceWasm, runtimePaths.packagedWasm);
  copyIfDifferent(sourceWasm, runtimePaths.frontendWasm);
  copyIfDifferent(sourceZkey, runtimePaths.frontendZkey);
  copyIfDifferent(sourceVk, runtimePaths.frontendVk);
  copyIfDifferent(sourceZkey, runtimePaths.zkeyFinal);
  copyIfDifferent(sourceVk, runtimePaths.verificationKey);
}

function writeSmokeFixture(subjectAddress: `0x${string}`, proofPoints: bigint[], publicSignals: string[]) {
  writeFileSync(
    runtimePaths.smokeFixture,
    JSON.stringify(
      {
        subjectAddress,
        proofPoints: proofPoints.map((value) => value.toString()),
        publicSignals,
      } satisfies SmokeProofFixture,
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

export async function generateSmokeProof(
  subjectAddress: `0x${string}` = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  options: GenerateSmokeProofOptions = {},
) {
  if (!hasPackagedRuntimeArtifacts()) {
    throw new Error("Proof runtime artifacts are missing. Run `pnpm proof:setup` first.");
  }

  const verificationKey = JSON.parse(await readFile(runtimePaths.verificationKey, "utf8")) as Record<string, unknown>;
  const forceGenerate = options.forceGenerate === true || process.env.WEB3ID_FORCE_PROOF_GENERATE === "1";
  if (!forceGenerate && existsSync(runtimePaths.smokeFixture)) {
    const fixture = JSON.parse(await readFile(runtimePaths.smokeFixture, "utf8")) as SmokeProofFixture;
    if (fixture.subjectAddress.toLowerCase() === subjectAddress.toLowerCase()) {
      const expectedPublicSignal = buildSubjectCircuitInput(subjectAddress).publicSignals[0].toString();
      if (fixture.publicSignals[0] !== expectedPublicSignal) {
        throw new Error("Smoke proof fixture no longer matches the current holder-binding statement.");
      }

      return {
        proof: proofFromSolidityPoints(fixture.proofPoints),
        proofPoints: fixture.proofPoints.map((value) => BigInt(value)),
        publicSignals: fixture.publicSignals,
        verificationKey,
        subjectAddress,
      } satisfies SmokeProofArtifacts;
    }
  }

  const result = await generateHolderBoundProof(subjectAddress, {
    mode: "node",
    subjectAddress,
    wasmPath: runtimePaths.packagedWasm,
    zkeyPath: runtimePaths.zkeyFinal,
  });

  const publicSignals = result.publicSignals.map((value) => value.toString());
  if (options.persistFixture === true) {
    writeSmokeFixture(subjectAddress, [...result.proofPoints], publicSignals);
  }

  return {
    proof: result.proof,
    proofPoints: [...result.proofPoints],
    publicSignals,
    verificationKey,
    subjectAddress,
  } satisfies SmokeProofArtifacts;
}

export async function verifySmokeProof(input: SmokeProofArtifacts) {
  const verified = await snarkjs.groth16.verify(input.verificationKey, input.publicSignals, input.proof);
  if (!verified) {
    throw new Error("Smoke proof verification failed.");
  }
  return verified;
}

function proofFromSolidityPoints(points: string[]) {
  if (points.length !== 8) {
    throw new Error(`Expected 8 solidity proof points, received ${points.length}.`);
  }

  return {
    protocol: "groth16",
    curve: "bn128",
    pi_a: [points[0], points[1], "1"],
    pi_b: [
      [points[3], points[2]],
      [points[5], points[4]],
      ["1", "0"],
    ],
    pi_c: [points[6], points[7], "1"],
  };
}
