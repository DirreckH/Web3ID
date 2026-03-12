import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateComplianceProof } from "../src/generateProof.js";

async function main() {
  const file = process.argv[2];
  const subjectAddress = process.argv[3];

  if (!file || !subjectAddress) {
    throw new Error("Usage: pnpm demo:proof <bundle.json> <subjectAddress>");
  }

  const bundle = JSON.parse(await readFile(resolve(process.cwd(), file), "utf8"));
  const result = await generateComplianceProof(bundle, {
    mode: "node",
    subjectAddress: subjectAddress as `0x${string}`,
    wasmPath: resolve(process.cwd(), "artifacts", "web3id_compliance_js", "web3id_compliance.wasm"),
    zkeyPath: resolve(process.cwd(), "artifacts", "web3id-compliance_final.zkey"),
  });

  console.log(JSON.stringify(result, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
