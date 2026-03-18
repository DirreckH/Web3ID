import { cleanRuntimeArtifacts, ensureRuntimeDirectories } from "./runtime.js";

function main() {
  ensureRuntimeDirectories();
  cleanRuntimeArtifacts();
  console.log("Web3ID proof runtime cleaned.");
}

try {
  main();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
