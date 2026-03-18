import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execa } from "execa";
import { resolve } from "node:path";
import {
  buildDir,
  circomBinary,
  cleanupTransientBuildOutputs,
  computeCircuitFingerprint,
  contractsGeneratedDir,
  copyIfDifferent,
  copyRuntimeArtifacts,
  ensureRuntimeDirectories,
  generateSmokeProof,
  hasPackagedRuntimeArtifacts,
  listPreflightIssues,
  readCacheManifest,
  root,
  runtimePaths,
  snarkjsBinary,
  verifySmokeProof,
  writeCacheManifest,
} from "./runtime.js";

const forceRebuild = process.argv.includes("--force");
const skipClean = process.argv.includes("--skip-clean");

function quoteWindowsArg(value: string) {
  if (!/[\s"]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function resolveInvocation(binary: string, args: string[]) {
  if (process.platform !== "win32" || !binary.toLowerCase().endsWith(".cmd")) {
    return { command: binary, args };
  }

  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [binary, ...args].map(quoteWindowsArg).join(" ")],
  };
}

async function runCommand(binary: string, args: string[]) {
  const invocation = resolveInvocation(binary, args);
  await execa(invocation.command, invocation.args, {
    stdio: "inherit",
    cwd: root,
  });
}

function assertCompiledArtifactsExist() {
  const missing = [
    runtimePaths.compileR1cs,
    runtimePaths.compileSym,
    runtimePaths.compileWasm,
    runtimePaths.compileWasmDir,
  ].filter((path) => !existsSync(path));

  if (missing.length > 0) {
    throw new Error(
      [
        "circom compile did not produce the expected runtime artifacts.",
        `Missing: ${missing.join(", ")}`,
        `Compiler: ${circomBinary}`,
        process.platform === "win32" && circomBinary.toLowerCase().endsWith(".cmd")
          ? "Install or provide a native circom binary at packages/proof/tools/circom.exe for full rebuild support on Windows."
          : "Check the circom installation and output directory configuration.",
      ].join("\n"),
    );
  }
}

function logStage(stage: string, message: string) {
  console.log(`[proof:setup] ${stage} - ${message}`);
}

async function exportVerifier(zkeyPath: string, verifierSol: string) {
  rmSync(runtimePaths.tempVerifier, { force: true });
  await runCommand(snarkjsBinary, ["zkey", "export", "solidityverifier", zkeyPath, runtimePaths.tempVerifier]);

  if (existsSync(verifierSol)) {
    const current = readFileSync(verifierSol);
    const next = readFileSync(runtimePaths.tempVerifier);
    if (Buffer.compare(current, next) === 0) {
      rmSync(runtimePaths.tempVerifier, { force: true });
      return;
    }
  }

  cpSync(runtimePaths.tempVerifier, verifierSol, { force: true });
  rmSync(runtimePaths.tempVerifier, { force: true });
}

async function run() {
  ensureRuntimeDirectories();

  if (!skipClean) {
    logStage("clean", "removing transient root build outputs");
    cleanupTransientBuildOutputs();
    mkdirSync(buildDir, { recursive: true });
  }

  logStage("preflight", "checking binaries and source inputs");
  const preflightIssues = listPreflightIssues();
  if (preflightIssues.length > 0) {
    throw new Error(preflightIssues.join("\n"));
  }

  const circuitFingerprint = computeCircuitFingerprint();
  const cacheManifest = readCacheManifest();
  const canReuseRuntime =
    !forceRebuild &&
    hasPackagedRuntimeArtifacts() &&
    (cacheManifest?.circuitFingerprint === circuitFingerprint || cacheManifest === null);

  if (canReuseRuntime) {
    logStage("compile", "reusing packaged runtime artifacts");
    if (!existsSync(runtimePaths.verifierSol)) {
      await exportVerifier(runtimePaths.zkeyFinal, runtimePaths.verifierSol);
    }
    copyRuntimeArtifacts(runtimePaths.packagedWasm, runtimePaths.packagedWasmDir, runtimePaths.zkeyFinal, runtimePaths.verificationKey);
    writeCacheManifest(circuitFingerprint);
  } else {
    logStage("compile", "building circuit outputs from source");
    await runCommand(circomBinary, [
      "circuits/web3id_compliance.circom",
      "--r1cs",
      "--wasm",
      "--sym",
      "--prime",
      "bn128",
      "-l",
      ".",
      "-o",
      buildDir,
    ]);
    assertCompiledArtifactsExist();

    logStage("trusted-setup", "ensuring ptau, zkey, and verification key");
    if (!existsSync(runtimePaths.ptau0)) {
      await runCommand(snarkjsBinary, ["powersoftau", "new", "bn128", "20", runtimePaths.ptau0, "-v"]);
    }
    if (!existsSync(runtimePaths.ptauFinal)) {
      await runCommand(snarkjsBinary, ["powersoftau", "prepare", "phase2", runtimePaths.ptau0, runtimePaths.ptauFinal]);
    }

    rmSync(runtimePaths.zkey0, { force: true });
    rmSync(runtimePaths.zkeyFinal, { force: true });
    rmSync(runtimePaths.verificationKey, { force: true });

    await runCommand(snarkjsBinary, ["groth16", "setup", runtimePaths.compileR1cs, runtimePaths.ptauFinal, runtimePaths.zkey0]);
    await runCommand(snarkjsBinary, ["zkey", "contribute", runtimePaths.zkey0, runtimePaths.zkeyFinal, "--name=web3id", "-e=web3id"]);
    await runCommand(snarkjsBinary, ["zkey", "export", "verificationkey", runtimePaths.zkeyFinal, runtimePaths.verificationKey]);

    logStage("artifact-sync", "copying runtime artifacts to package, frontend, and contracts");
    await exportVerifier(runtimePaths.zkeyFinal, runtimePaths.verifierSol);
    copyRuntimeArtifacts(runtimePaths.compileWasm, runtimePaths.compileWasmDir, runtimePaths.zkeyFinal, runtimePaths.verificationKey);
    writeCacheManifest(circuitFingerprint);
  }

  logStage("proof-smoke", "generating minimal node proof");
  const smoke = await generateSmokeProof(undefined, {
    forceGenerate: true,
    persistFixture: true,
  });

  logStage("verify", "verifying minimal proof against verification key");
  await verifySmokeProof(smoke);

  logStage("done", `runtime ready for ${smoke.subjectAddress}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
