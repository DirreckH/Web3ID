import type { CredentialBundle } from "@web3id/credential";
import type { RootIdentity, SubIdentity } from "@web3id/identity";
import type { AccessPayload, PolicyPreflightResult } from "@web3id/sdk";
import {
  exportAnalyzerAudit,
  getAnalyzerListHistory,
  getAnalyzerOperatorDashboard,
  getAnalyzerPolicyDecisionHistory,
  getRecoveryHooksSnapshot,
  getAnalyzerRiskContext,
  getIdentityContext,
} from "@web3id/sdk";

export type Scenario = "rwa" | "enterprise" | "social";
export type EnterpriseAction = "payment" | "audit";
export type SocialAction = "vote" | "airdrop" | "post";
export type PlatformEntryKey = "stage1" | "stage2" | "stage3" | "platform";
export type AuditTargetScope = "selected_sub" | "root";
export type ListHistoryNameFilter = "" | "watchlist" | "restricted_list" | "blacklist_or_frozen_list";
export type ListHistoryActionFilter = "" | "auto_added" | "manually_added" | "removed" | "expired";
export type PolicyKindFilter = "" | "access" | "warning";

export type PlatformEntryMeta = {
  label: string;
  summary: string;
  acceptance: string;
};

export type IdentityContextResponse = Awaited<ReturnType<typeof getIdentityContext>>;
export type RiskContextResponse = Awaited<ReturnType<typeof getAnalyzerRiskContext>>;
export type AuditExportBundleResponse = Awaited<ReturnType<typeof exportAnalyzerAudit>>;
export type ListHistoryResponse = Awaited<ReturnType<typeof getAnalyzerListHistory>>;
export type OperatorDashboardResponse = Awaited<ReturnType<typeof getAnalyzerOperatorDashboard>>;
export type PolicyHistoryResponse = Awaited<ReturnType<typeof getAnalyzerPolicyDecisionHistory>>;
export type RecoveryHooksResponse = ReturnType<typeof getRecoveryHooksSnapshot>;

export type IdentityCapabilitiesLike = {
  supportsHolderBinding?: boolean;
  supportsIssuerValidation?: boolean;
  hasLinkedCredentials?: boolean;
  supportedProofKinds?: string[];
  preferredMode?: string;
} | null;

export type PolicySupportLike = {
  supported: boolean;
  reason?: string | null;
} | null;

export type ActivePolicyLike = {
  targetAction: string;
  allowedModes: string[];
  proofTemplate: string;
  policyVersion: number;
};

export type ConsoleSelection = {
  scenario: Scenario;
  enterpriseAction: EnterpriseAction;
  socialAction: SocialAction;
  platformEntry: PlatformEntryMeta;
  rootIdentity: RootIdentity | null;
  selectedSubIdentity: SubIdentity | null;
  subIdentities: SubIdentity[];
  capabilities: IdentityCapabilitiesLike;
  policySupport: PolicySupportLike;
  effectiveMode: string | null;
  activePolicy: ActivePolicyLike;
  identityContext: IdentityContextResponse | null;
  riskContext: RiskContextResponse | null;
  accessDecision: any;
  warningDecision: any;
  watchStatus: any;
  policyPreflight: PolicyPreflightResult | null;
  verifierPreflight: string;
  bundles: CredentialBundle[];
  payload: AccessPayload | null;
  status: string;
  mintedBalance: string;
  operatorDashboard: OperatorDashboardResponse | null;
  recoveryHooks: RecoveryHooksResponse;
  auditBundle: AuditExportBundleResponse | null;
  listHistory: ListHistoryResponse;
  policyHistory: PolicyHistoryResponse;
};

export type ScenarioOption = {
  id: Scenario;
  label: string;
  description: string;
  policyPath: string;
  recommendedDemo: string;
};
