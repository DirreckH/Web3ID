import { IdentityState } from "@web3id/state";
import type { EnterpriseAction, Scenario, SocialAction } from "./types";

export function stateLabel(state: number | undefined | null) {
  if (state === undefined || state === null) {
    return "INIT";
  }

  return IdentityState[state] ?? "INIT";
}

export function scenarioLabel(scenario: Scenario) {
  if (scenario === "rwa") {
    return "RWA Access";
  }
  if (scenario === "enterprise") {
    return "Enterprise / Audit";
  }
  return "Social Governance";
}

export function scenarioDescription(
  scenario: Scenario,
  enterpriseAction: EnterpriseAction,
  socialAction: SocialAction,
) {
  if (scenario === "rwa") {
    return "Compliance-first access path with linked credentials and holder-bound proof.";
  }

  if (scenario === "enterprise") {
    return enterpriseAction === "payment"
      ? "Enterprise treasury payment path with compliance credentials, proof, and policy review."
      : "Enterprise audit export path where policy decisions remain action-level audit snapshots.";
  }

  if (socialAction === "airdrop") {
    return "Default-behavior eligibility path for social airdrop checks.";
  }
  if (socialAction === "post") {
    return "Default-behavior community posting path with warnings separated from state facts.";
  }
  return "Default-behavior governance voting path with AI as suggestion only.";
}

export function scenarioPolicyPath(scenario: Scenario) {
  return scenario === "social" ? "Default path" : "Compliance path";
}

export function compactHex(value: string | null | undefined, lead = 10, tail = 6) {
  if (!value) {
    return "N/A";
  }
  if (value.length <= lead + tail + 3) {
    return value;
  }
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

export function formatIso(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function listText(values: Array<string | number | null | undefined>) {
  const filtered = values.filter((value) => value !== null && value !== undefined && `${value}`.length > 0);
  return filtered.length ? filtered.join(", ") : "None";
}

export function formatJson(value: unknown) {
  return JSON.stringify(
    value,
    (_key, nestedValue) => (typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue),
    2,
  );
}

export function boolLabel(value: boolean | undefined) {
  if (value === undefined) {
    return "N/A";
  }
  return value ? "Yes" : "No";
}

export function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
