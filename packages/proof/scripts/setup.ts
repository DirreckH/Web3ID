import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";

const root = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(root, "..", "..");
const artifactsDir = resolve(root, "artifacts");
const buildDir = resolve(root, "artifacts-build");
const frontendCircuitDir = resolve(workspaceRoot, "apps", "frontend", "public", "circuits");
const contractsGeneratedDir = resolve(workspaceRoot, "contracts", "src", "generated");
const bundledCircomBinary = resolve(root, "tools", process.platform === "win32" ? "circom.exe" : "circom");
const circomBinary = existsSync(bundledCircomBinary)
  ? bundledCircomBinary
  : resolve(root, "node_modules", ".bin", process.platform === "win32" ? "circom2.CMD" : "circom2");
const snarkjsBinary = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "snarkjs.CMD" : "snarkjs");
const cachedZkey = resolve(artifactsDir, "web3id-compliance_final.zkey");
const cachedVk = resolve(artifactsDir, "verification_key.json");
const cachedWasmDir = resolve(artifactsDir, "web3id_compliance_js");
const cachedWasm = resolve(cachedWasmDir, "web3id_compliance.wasm");
const manifestPath = resolve(artifactsDir, "runtime-manifest.json");
const sourceDirs = [
  resolve(root, "circuits"),
  resolve(root, "vendor", "circomlib", "circuits"),
  resolve(root, "vendor", "keccak256-circom", "circuits"),
];
const forceRebuild = process.argv.includes("--force");

type CacheManifest = {
  circuitFingerprint: string;
};

function copyIfDifferent(source: string, destination: string, recursive = false) {
  if (resolve(source) === resolve(destination)) {
    return;
  }

  cpSync(source, destination, { recursive, force: true });
}

function collectCircomFiles(directory: string): string[] {
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

function computeCircuitFingerprint() {
  const hash = createHash("sha256");
  const files = sourceDirs.flatMap((directory) => collectCircomFiles(directory)).sort();
  for (const file of files) {
    hash.update(file.replace(root, ""));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function readCacheManifest(): CacheManifest | null {
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

function writeCacheManifest(circuitFingerprint: string) {
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

async function exportVerifier(zkeyPath: string, verifierSol: string) {
  const tempVerifier = resolve(contractsGeneratedDir, "Groth16Verifier.tmp.sol");
  rmSync(tempVerifier, { force: true });
  await execa(snarkjsBinary, ["zkey", "export", "solidityverifier", zkeyPath, tempVerifier], {
    stdio: "inherit",
    cwd: root,
  });

  if (existsSync(verifierSol)) {
    const current = readFileSync(verifierSol);
    const next = readFileSync(tempVerifier);
    if (Buffer.compare(current, next) === 0) {
      rmSync(tempVerifier, { force: true });
      return;
    }
  }

  cpSync(tempVerifier, verifierSol, { force: true });
  rmSync(tempVerifier, { force: true });
}

function copyRuntimeArtifacts(sourceWasm: string, sourceWasmDir: string, sourceZkey: string, sourceVk: string) {
  const packagedWasmDir = resolve(artifactsDir, "web3id_compliance_js");
  const packagedWasm = resolve(packagedWasmDir, "web3id_compliance.wasm");
  const frontendWasm = resolve(frontendCircuitDir, "web3id-compliance.wasm");
  const frontendZkey = resolve(frontendCircuitDir, "web3id-compliance_final.zkey");
  const frontendVk = resolve(frontendCircuitDir, "verification_key.json");
  const packagedZkey = resolve(artifactsDir, "web3id-compliance_final.zkey");
  const packagedVk = resolve(artifactsDir, "verification_key.json");

  if (resolve(sourceWasmDir) !== resolve(packagedWasmDir)) {
    rmSync(packagedWasmDir, { recursive: true, force: true });
  } else {
    mkdirSync(packagedWasmDir, { recursive: true });
  }

  copyIfDifferent(sourceWasmDir, packagedWasmDir, true);
  copyIfDifferent(sourceWasm, packagedWasm);
  copyIfDifferent(sourceWasm, frontendWasm);
  copyIfDifferent(sourceZkey, frontendZkey);
  copyIfDifferent(sourceVk, frontendVk);
  copyIfDifferent(sourceZkey, packagedZkey);
  copyIfDifferent(sourceVk, packagedVk);
}

async function run() {
  mkdirSync(artifactsDir, { recursive: true });
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  mkdirSync(frontendCircuitDir, { recursive: true });
  mkdirSync(contractsGeneratedDir, { recursive: true });

  const verifierSol = resolve(contractsGeneratedDir, "Groth16Verifier.sol");
  const circuitFingerprint = computeCircuitFingerprint();
  const cacheManifest = readCacheManifest();
  const hasCachedRuntimeArtifacts = existsSync(cachedZkey) && existsSync(cachedVk) && existsSync(cachedWasm);

  // Reuse locally cached runtime artifacts when they already exist; otherwise build them on demand.
  if (
    !forceRebuild &&
    hasCachedRuntimeArtifacts &&
    (
      cacheManifest?.circuitFingerprint === circuitFingerprint ||
      cacheManifest === null
    )
  ) {
    if (!existsSync(verifierSol)) {
      await exportVerifier(cachedZkey, verifierSol);
    }
    copyRuntimeArtifacts(cachedWasm, cachedWasmDir, cachedZkey, cachedVk);
    writeCacheManifest(circuitFingerprint);
    return;
  }

  rmSync(resolve(root, "web3id_compliance.r1cs"), { force: true });
  rmSync(resolve(root, "web3id_compliance.sym"), { force: true });
  rmSync(resolve(root, "web3id_compliance_js"), { recursive: true, force: true });

  await execa(
    circomBinary,
    ["circuits/web3id_compliance.circom", "--r1cs", "--wasm", "--sym", "--prime", "bn128", "-l", "."],
    {
    stdio: "inherit",
    cwd: root,
    },
  );

  const ptau0 = resolve(artifactsDir, "powersOfTau28_0000_20.ptau");
  const ptauFinal = resolve(artifactsDir, "powersOfTau28_final_20.ptau");
  const zkey0 = resolve(artifactsDir, "web3id-compliance_0000.zkey");
  const zkeyFinal = resolve(artifactsDir, "web3id-compliance_final.zkey");
  const r1cs = resolve(root, "web3id_compliance.r1cs");
  const wasm = resolve(root, "web3id_compliance_js", "web3id_compliance.wasm");
  const verificationKey = resolve(artifactsDir, "verification_key.json");

  if (!existsSync(ptau0)) {
    await execa(snarkjsBinary, ["powersoftau", "new", "bn128", "20", ptau0, "-v"], { stdio: "inherit", cwd: root });
  }
  if (!existsSync(ptauFinal)) {
    await execa(snarkjsBinary, ["powersoftau", "prepare", "phase2", ptau0, ptauFinal], {
      stdio: "inherit",
      cwd: root,
    });
  }

  rmSync(zkey0, { force: true });
  rmSync(zkeyFinal, { force: true });
  rmSync(verificationKey, { force: true });

  await execa(snarkjsBinary, ["groth16", "setup", r1cs, ptauFinal, zkey0], { stdio: "inherit", cwd: root });
  await execa(snarkjsBinary, ["zkey", "contribute", zkey0, zkeyFinal, "--name=web3id", "-e=web3id"], {
    stdio: "inherit",
    cwd: root,
  });
  await execa(snarkjsBinary, ["zkey", "export", "verificationkey", zkeyFinal, verificationKey], {
    stdio: "inherit",
    cwd: root,
  });
  await exportVerifier(zkeyFinal, verifierSol);

  copyIfDifferent(r1cs, resolve(buildDir, "web3id_compliance.r1cs"));
  copyIfDifferent(resolve(root, "web3id_compliance.sym"), resolve(buildDir, "web3id_compliance.sym"));
  copyIfDifferent(resolve(root, "web3id_compliance_js"), resolve(buildDir, "web3id_compliance_js"), true);
  copyRuntimeArtifacts(wasm, resolve(root, "web3id_compliance_js"), zkeyFinal, verificationKey);
  writeCacheManifest(circuitFingerprint);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
