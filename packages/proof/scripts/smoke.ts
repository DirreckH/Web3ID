import { generateSmokeProof, verifySmokeProof } from "./runtime.js";

async function main() {
  console.log("[proof:smoke] prepare");
  const smoke = await generateSmokeProof();
  console.log("[proof:smoke] generated");
  await verifySmokeProof(smoke);
  console.log("[proof:smoke] verified");
  console.log(`Proof smoke passed for ${smoke.subjectAddress}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
