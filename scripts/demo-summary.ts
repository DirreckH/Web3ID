type DemoEntry = "stage1" | "stage2" | "stage3" | "platform";

type DemoSummaryInput = {
  entry: DemoEntry;
  holder: string;
  proofStatus: string;
  urls: Array<{ label: string; value: string }>;
  docs: string[];
  services: string[];
  seededData: string[];
};

const ENTRY_META: Record<DemoEntry, {
  title: string;
  scenarios: string[];
  commonFailures: string[];
  recommendedFlow: string[];
}> = {
  stage1: {
    title: "Stage1 Minimal Baseline",
    scenarios: ["RWA Access"],
    commonFailures: [
      "proof runtime artifacts are missing",
      "anvil or contracts are not ready",
      "issuer-service is not responding",
    ],
    recommendedFlow: [
      "Connect wallet",
      "Sign identity challenge",
      "Issue scenario credential",
      "Build access payload",
      "Submit buyRwa",
    ],
  },
  stage2: {
    title: "Stage2 Reinforced Baseline",
    scenarios: ["RWA Access", "Social Governance"],
    commonFailures: [
      "proof runtime not initialized",
      "frontend missing contract environment variables",
      "issuer-service has no registered identity tree",
    ],
    recommendedFlow: [
      "Walk RWA Access first",
      "Switch to Social Governance for default-path comparison",
      "Compare policy/mode differences in the same console",
    ],
  },
  stage3: {
    title: "Stage3 Full Stack",
    scenarios: ["RWA Access", "Enterprise / Audit", "Social Governance"],
    commonFailures: [
      "analyzer-service is not registered with the identity tree",
      "policy-api is unavailable",
      "review queue and watchers were not refreshed after scans",
    ],
    recommendedFlow: [
      "Register and bind identities",
      "Run watch/backfill",
      "Inspect stored/effective state and policy decisions",
      "Use operator controls for review and manual release",
    ],
  },
  platform: {
    title: "Platform Recommended Entry",
    scenarios: ["RWA Access", "Enterprise / Audit", "Social Governance"],
    commonFailures: [
      "proof runtime is missing",
      "analyzer or policy services are not healthy",
      "operator state was not refreshed after review/manual actions",
    ],
    recommendedFlow: [
      "Start with Platform Overview",
      "Walk one compliance path and one default path",
      "Finish in Audit & Evidence and Operator Dashboard",
    ],
  },
};

export function printDemoSummary(input: DemoSummaryInput) {
  const meta = ENTRY_META[input.entry];

  console.log("");
  console.log(`Web3ID ${input.entry} demo running`);
  console.log(`Entry: ${meta.title}`);
  console.log(`Scenarios: ${meta.scenarios.join(", ")}`);
  console.log(`Holder: ${input.holder}`);
  console.log(`Proof: ${input.proofStatus}`);
  console.log("");
  console.log("Services:");
  for (const service of input.services) {
    console.log(`- ${service}`);
  }
  console.log("");
  console.log("URLs:");
  for (const item of input.urls) {
    console.log(`- ${item.label}: ${item.value}`);
  }
  console.log("");
  console.log("Seeded data:");
  for (const item of input.seededData) {
    console.log(`- ${item}`);
  }
  console.log("");
  console.log("Recommended flow:");
  for (const step of meta.recommendedFlow) {
    console.log(`- ${step}`);
  }
  console.log("");
  console.log("Common failures:");
  for (const item of meta.commonFailures) {
    console.log(`- ${item}`);
  }
  console.log("");
  console.log("Docs:");
  for (const doc of input.docs) {
    console.log(`- ${doc}`);
  }
  console.log("");
}
