import type { ConsoleSelection, ScenarioOption } from "./types";
import { scenarioDescription } from "./formatters";

export const SCENARIO_OPTIONS: ScenarioOption[] = [
  {
    id: "rwa",
    label: "RWA Access",
    description: "Identity + credential + proof happy path for regulated access.",
    policyPath: "Compliance path",
    recommendedDemo: "stage1 or platform",
  },
  {
    id: "enterprise",
    label: "Enterprise / Audit",
    description: "Treasury payment and audit export under enterprise policy controls.",
    policyPath: "Compliance path",
    recommendedDemo: "stage2 or platform",
  },
  {
    id: "social",
    label: "Social Governance",
    description: "Default-only governance, airdrop, and community actions with explicit AI boundaries.",
    policyPath: "Default path",
    recommendedDemo: "stage2, stage3, or platform",
  },
];

export function selectPlatformConsoleData(selection: ConsoleSelection) {
  const summary = selection.riskContext?.summary ?? null;
  const identityContext = selection.identityContext;
  const reviewQueue = selection.riskContext?.reviewQueue ?? [];
  const aiSuggestions = selection.riskContext?.aiSuggestions ?? [];
  const listHistory = selection.listHistory.length
    ? selection.listHistory
    : (selection.riskContext?.listHistory ?? []);
  const policyHistory = selection.policyHistory.length
    ? selection.policyHistory
    : (selection.riskContext?.policyDecisions ?? []);
  const auditTrail = selection.auditBundle?.auditRecords ?? selection.riskContext?.audit ?? [];
  const activeConsequences = identityContext?.activeConsequences ?? identityContext?.consequences ?? [];
  const scenarioMeta =
    SCENARIO_OPTIONS.find((option) => option.id === selection.scenario) ?? SCENARIO_OPTIONS[0];

  return {
    scenarioOptions: SCENARIO_OPTIONS.map((option) => ({
      ...option,
      active: option.id === selection.scenario,
    })),
    scenarioMeta: {
      ...scenarioMeta,
      detail: scenarioDescription(selection.scenario, selection.enterpriseAction, selection.socialAction),
    },
    summary,
    identityContext,
    reviewQueue,
    aiSuggestions,
    listHistory,
    policyHistory,
    auditTrail,
    activeConsequences,
    selectedIdentityId: selection.selectedSubIdentity?.identityId ?? selection.rootIdentity?.identityId ?? null,
    rootIdentityId: selection.rootIdentity?.identityId ?? null,
  };
}
