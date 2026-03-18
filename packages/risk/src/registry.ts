import { getAddress, isAddressEqual, type Address } from "viem";
import riskRulesConfig from "../config/risk-rules.json";
import riskSignalsConfig from "../config/risk-signals.json";
import policyRulesConfig from "../config/policy-rules.json";
import type { BehaviorKind } from "./types.js";

export type RegistryAddressEntry = {
  address: Address;
  label: string;
  ruleFamily: string;
  protocolType?: string;
};

export type RiskRuleDefinition = {
  riskDelta: number;
  reputationDelta: number;
  confidenceDelta: number;
  targetState: "INIT" | "NORMAL" | "OBSERVED" | "RESTRICTED" | "HIGH_RISK" | "FROZEN";
  ruleFamily: string;
  propagationMode: "local_only" | "scope_class" | "root_sensitive";
  rootSensitive: boolean;
  hardRule: boolean;
  sticky: boolean;
};

export type RegistrySnapshot = {
  version: number;
  mixerProtocols: RegistryAddressEntry[];
  sanctionedAddresses: RegistryAddressEntry[];
  highRiskCounterparties: RegistryAddressEntry[];
  trustedDefiProtocols: RegistryAddressEntry[];
  governanceContracts: RegistryAddressEntry[];
  trustedIssuers: string[];
  riskSignalSources: Array<{ id: string; label: string; type: string }>;
};

export type RuleSnapshot = {
  version: number;
  thresholds: {
    observed: number;
    restricted: number;
    highRisk: number;
    frozen: number;
  };
  negativeDecay: { startDays: number; everyDays: number; percent: number };
  positiveDecay: { windowDays: number; everyDays: number; percent: number };
  rules: Record<string, RiskRuleDefinition>;
};

export type PolicyRuleSnapshot = typeof policyRulesConfig;

function normalizeEntry(entry: { address: string; label: string; ruleFamily: string; protocolType?: string }): RegistryAddressEntry {
  return {
    address: getAddress(entry.address),
    label: entry.label,
    ruleFamily: entry.ruleFamily,
    protocolType: entry.protocolType,
  };
}

const registrySnapshot: RegistrySnapshot = {
  version: riskSignalsConfig.version,
  mixerProtocols: riskSignalsConfig.mixerProtocols.map(normalizeEntry),
  sanctionedAddresses: riskSignalsConfig.sanctionedAddresses.map(normalizeEntry),
  highRiskCounterparties: riskSignalsConfig.highRiskCounterparties.map(normalizeEntry),
  trustedDefiProtocols: riskSignalsConfig.trustedDefiProtocols.map(normalizeEntry),
  governanceContracts: riskSignalsConfig.governanceContracts.map(normalizeEntry),
  trustedIssuers: [...riskSignalsConfig.trustedIssuers],
  riskSignalSources: [...riskSignalsConfig.riskSignalSources],
};

const ruleSnapshot = riskRulesConfig as unknown as RuleSnapshot;
const policySnapshot = policyRulesConfig as unknown as PolicyRuleSnapshot;

export function getRegistrySnapshot() {
  return registrySnapshot;
}

export function getRuleSnapshot() {
  return ruleSnapshot;
}

export function getPolicyRuleSnapshot() {
  return policySnapshot;
}

export function getRegistryVersion() {
  return registrySnapshot.version;
}

export function getRuleVersion() {
  return ruleSnapshot.version;
}

export function listKnownDemoAddresses() {
  return {
    mixer: registrySnapshot.mixerProtocols.map((entry) => entry.address),
    sanctioned: registrySnapshot.sanctionedAddresses.map((entry) => entry.address),
    highRisk: registrySnapshot.highRiskCounterparties.map((entry) => entry.address),
    trustedDefi: registrySnapshot.trustedDefiProtocols.map((entry) => entry.address),
    governance: registrySnapshot.governanceContracts.map((entry) => entry.address),
  };
}

export function getRuleDefinition(kind: BehaviorKind | string) {
  const direct = ruleSnapshot.rules[kind];
  if (direct) {
    return direct;
  }
  return ruleSnapshot.rules.contract_call;
}

export function lookupRegistryAddress(address?: Address | null) {
  if (!address) {
    return null;
  }

  const normalized = getAddress(address);
  const catalogs = [
    { name: "mixerProtocols", items: registrySnapshot.mixerProtocols, behaviorKind: "mixer_interaction" as const },
    { name: "sanctionedAddresses", items: registrySnapshot.sanctionedAddresses, behaviorKind: "sanctioned_interaction" as const },
    { name: "highRiskCounterparties", items: registrySnapshot.highRiskCounterparties, behaviorKind: "high_risk_counterparty" as const },
    { name: "trustedDefiProtocols", items: registrySnapshot.trustedDefiProtocols, behaviorKind: "trusted_defi_interaction" as const },
    { name: "governanceContracts", items: registrySnapshot.governanceContracts, behaviorKind: "governance_vote" as const },
  ];

  for (const catalog of catalogs) {
    const match = catalog.items.find((entry) => isAddressEqual(entry.address, normalized));
    if (match) {
      return {
        catalog: catalog.name,
        behaviorKind: catalog.behaviorKind,
        entry: match,
      };
    }
  }

  return null;
}

export function getBehaviorKindLabel(kind: BehaviorKind) {
  switch (kind) {
    case "native_transfer":
      return "Native transfer";
    case "erc20_transfer":
      return "ERC20 transfer";
    case "nft_transfer":
      return "NFT transfer";
    case "contract_call":
      return "Contract call";
    case "dex_interaction":
      return "DEX interaction";
    case "lending_interaction":
      return "Lending interaction";
    case "governance_vote":
      return "Governance vote";
    case "governance_delegate":
      return "Governance delegation";
    case "bridge_interaction":
      return "Bridge interaction";
    case "mixer_interaction":
      return "Mixer interaction";
    case "sanctioned_interaction":
      return "Sanctioned interaction";
    case "high_risk_counterparty":
      return "High-risk counterparty";
    case "trusted_defi_interaction":
      return "Trusted DeFi interaction";
    case "unknown_contract_repetition":
      return "Repeated unknown contract activity";
  }
}
