import type { ConsoleSelection } from "./types";
import {
  boolLabel,
  compactHex,
  countLabel,
  formatIso,
  formatJson,
  listText,
  scenarioLabel,
  scenarioPolicyPath,
  stateLabel,
} from "./formatters";
import { selectPlatformConsoleData } from "./selectors";

export type MetricItem = {
  label: string;
  value: string;
};

export type JsonSection = {
  label: string;
  value: string | null;
  empty: string;
};

export type TimelineItem = {
  title: string;
  meta: string;
  body: string;
};

export type PlatformOverviewViewModel = {
  badges: string[];
  metrics: MetricItem[];
  guardrails: string[];
  scenarioCards: Array<{
    id: "rwa" | "enterprise" | "social";
    label: string;
    description: string;
    policyPath: string;
    recommendedDemo: string;
    active: boolean;
  }>;
  scenarioSummary: string;
};

export type IdentityDetailViewModel = {
  metrics: MetricItem[];
  credentialMetrics: MetricItem[];
  notes: string[];
  jsonSections: JsonSection[];
};

export type StateConsequenceViewModel = {
  stateMetrics: MetricItem[];
  consequenceMetrics: MetricItem[];
  recoveryNotes: string[];
  propagationNotes: string[];
  jsonSections: JsonSection[];
};

export type RecoveryHooksViewModel = {
  metrics: MetricItem[];
  notes: string[];
  jsonSections: JsonSection[];
};

export type AuditEvidenceViewModel = {
  exportMetrics: MetricItem[];
  historyMetrics: MetricItem[];
  notes: string[];
  jsonSections: JsonSection[];
};

export type PolicyDecisionViewModel = {
  policyMetrics: MetricItem[];
  decisionMetrics: MetricItem[];
  notes: string[];
  jsonSections: JsonSection[];
};

export type AiReviewViewModel = {
  reviewMetrics: MetricItem[];
  boundaryNotes: string[];
  reviewItems: TimelineItem[];
  jsonSections: JsonSection[];
};

export type OperatorDashboardViewModel = {
  metrics: MetricItem[];
  notes: string[];
  recentEvents: TimelineItem[];
  jsonSections: JsonSection[];
};

export type PlatformConsoleViewModels = {
  overview: PlatformOverviewViewModel;
  identity: IdentityDetailViewModel;
  stateConsequence: StateConsequenceViewModel;
  recoveryHooks: RecoveryHooksViewModel;
  auditEvidence: AuditEvidenceViewModel;
  policy: PolicyDecisionViewModel;
  aiReview: AiReviewViewModel;
  operator: OperatorDashboardViewModel;
};

function jsonSection(label: string, value: unknown, empty: string): JsonSection {
  if (value === null || value === undefined) {
    return { label, value: null, empty };
  }

  if (Array.isArray(value) && value.length === 0) {
    return { label, value: null, empty };
  }

  return {
    label,
    value: formatJson(value),
    empty,
  };
}

export function buildPlatformConsoleViewModels(selection: ConsoleSelection): PlatformConsoleViewModels {
  const selected = selectPlatformConsoleData(selection);
  const positiveSummary = selected.summary?.positiveSummary;
  const recoveryProgress = selected.summary?.recoveryProgress;
  const propagation = selected.summary?.propagation;
  const operatorDashboard = selection.operatorDashboard;

  return {
    overview: {
      badges: [
        selection.platformEntry.label,
        `Scenario: ${scenarioLabel(selection.scenario)}`,
        `Path: ${scenarioPolicyPath(selection.scenario)}`,
        `Acceptance: ${selection.platformEntry.acceptance}`,
      ],
      metrics: [
        { label: "Selected identity", value: compactHex(selected.selectedIdentityId) },
        { label: "Preferred mode", value: selection.capabilities?.preferredMode ?? "N/A" },
        { label: "Effective mode", value: selection.effectiveMode ?? "Unsupported" },
        {
          label: "Policy support",
          value: selection.policySupport?.supported ? "Supported" : selection.policySupport?.reason ?? "Unknown",
        },
        { label: "Stored state", value: stateLabel(selected.summary?.storedState ?? selection.identityContext?.currentState) },
        { label: "Effective state", value: stateLabel(selected.summary?.effectiveState) },
      ],
      guardrails: [
        "stored state is local fact; effective state is overlay result.",
        "consequence can constrain access but cannot rewrite state facts.",
        "policy decision is an action-level audit snapshot, not a state source.",
        "AI suggestion is not final decision and cannot write frozen state directly.",
      ],
      scenarioCards: selected.scenarioOptions,
      scenarioSummary: selected.scenarioMeta.detail,
    },
    identity: {
      metrics: [
        { label: "Wallet root", value: compactHex(selection.rootIdentity?.identityId) },
        { label: "Sub identities", value: `${selection.subIdentities.length}` },
        { label: "Selected scope", value: selection.selectedSubIdentity?.scope ?? "N/A" },
        { label: "Selected type", value: selection.selectedSubIdentity?.type ?? "N/A" },
        { label: "Holder binding", value: boolLabel(selection.capabilities?.supportsHolderBinding) },
        { label: "Issuer validation", value: boolLabel(selection.capabilities?.supportsIssuerValidation) },
      ],
      credentialMetrics: [
        { label: "Linked credentials", value: countLabel(selection.bundles.length, "bundle") },
        { label: "Proof kinds", value: listText(selection.capabilities?.supportedProofKinds ?? []) },
        { label: "Payload ready", value: selection.payload ? "Yes" : "No" },
        { label: "Minted balance", value: selection.mintedBalance },
      ],
      notes: [
        "Root identity stays unique and immutable.",
        "Sub identity scope is fixed after normalization and drives scenario isolation.",
        "Capability-first does not mean a permanent mode label; policy and credentials still matter.",
      ],
      jsonSections: [
        jsonSection("Root Identity", selection.rootIdentity, "Connect and sign to derive the root identity tree."),
        jsonSection("Selected Sub Identity", selection.selectedSubIdentity, "Choose a scenario identity to inspect its permissions."),
        jsonSection("Issued Credential Bundles", selection.bundles, "Issue a scenario credential to populate linked credential evidence."),
      ],
    },
    stateConsequence: {
      stateMetrics: [
        { label: "Stored state", value: stateLabel(selected.summary?.storedState) },
        { label: "Effective state", value: stateLabel(selected.summary?.effectiveState) },
        { label: "Anchored state", value: stateLabel(selected.summary?.anchoredState) },
        { label: "Risk score", value: `${selected.summary?.riskScore ?? 0}` },
        { label: "Review queue", value: `${selected.summary?.reviewQueueCounts?.pending ?? selected.reviewQueue.length}` },
        {
          label: "Watchers",
          value: `${selection.watchStatus?.items?.length ?? selected.summary?.watchStatus?.items?.length ?? 0}`,
        },
      ],
      consequenceMetrics: [
        { label: "Active consequences", value: `${selected.activeConsequences.length}` },
        { label: "Restrictions", value: `${positiveSummary?.activeRestrictions.length ?? 0}` },
        { label: "Unlocks", value: `${positiveSummary?.activeUnlocks.length ?? 0}` },
        { label: "Helpful positive signals", value: `${recoveryProgress?.helpfulPositiveSignals.length ?? 0}` },
        { label: "Release floor active", value: recoveryProgress?.releaseFloorActive ? "Yes" : "No" },
        { label: "Floor until", value: formatIso(recoveryProgress?.floorUntil) },
      ],
      recoveryNotes: [
        `Active restrictions: ${listText(recoveryProgress?.activeRestrictions ?? [])}`,
        `Active unlocks: ${listText(recoveryProgress?.activeUnlocks ?? [])}`,
        `Recovery helpers: ${listText(recoveryProgress?.helpfulPositiveSignals ?? [])}`,
        positiveSummary?.demoDefaults
          ? "Positive signal thresholds are demo defaults and remain configurable."
          : "Positive thresholds loaded from runtime config.",
      ],
      propagationNotes: [
        `Propagation reasons: ${listText(propagation?.reasonCodes ?? [])}`,
        `Propagation warnings: ${listText(propagation?.warnings ?? [])}`,
        `Root floor overlay: ${stateLabel(propagation?.rootEffectiveFloorState)}`,
        `Sibling overlay: ${stateLabel(propagation?.siblingOverlayState)}`,
      ],
      jsonSections: [
        jsonSection(
          "Identity State Context",
          selection.identityContext,
          "Register the identity tree to inspect state, consequence, and recovery history.",
        ),
        jsonSection(
          "Risk Summary",
          selected.summary,
          "Run analyzer scans to populate stored/effective state and propagation overlays.",
        ),
      ],
    },
    recoveryHooks: {
      metrics: [
        { label: "Guardian set ref", value: selection.recoveryHooks.guardianSetRef ?? "Not configured" },
        { label: "Policy slot ref", value: selection.recoveryHooks.recoveryPolicySlotId ?? "Not configured" },
        { label: "Guardian count", value: `${selection.recoveryHooks.guardians.length}` },
        { label: "Recovery enabled", value: selection.recoveryHooks.recoveryPolicySlotId ? "Configured" : "Disabled" },
        {
          label: "Supported actions",
          value: listText(selection.recoveryHooks.policySlot?.allowedRecoveryActions ?? []),
        },
        {
          label: "Blocked by governance controls",
          value: selection.recoveryHooks.intents.some((intent) => Boolean(intent.blockedReason)) ? "Yes" : "No",
        },
        {
          label: "Recent intents",
          value: `${selection.recoveryHooks.intents.length}`,
        },
      ],
      notes: [
        "Recovery hooks are reserved metadata only. They do not execute unlock, rebind, or controller rotation in P2.",
        "Recovery hooks cannot override governance emergency freeze or GLOBAL_LOCKDOWN.",
        "An empty panel is expected until a local recovery slot and guardian set are configured.",
      ],
      jsonSections: [
        jsonSection("Recovery Hooks Snapshot", selection.recoveryHooks, "Recovery hooks are not configured for the selected root identity."),
      ],
    },
    auditEvidence: {
      exportMetrics: [
        { label: "Audit records", value: `${selected.auditTrail.length}` },
        { label: "Signals", value: `${selection.auditBundle?.signals.length ?? selection.riskContext?.signals.length ?? 0}` },
        {
          label: "Assessments",
          value: `${selection.auditBundle?.assessments.length ?? selection.identityContext?.assessments.length ?? 0}`,
        },
        { label: "Anchors", value: `${selection.auditBundle?.anchors.length ?? selection.riskContext?.anchors.length ?? 0}` },
      ],
      historyMetrics: [
        { label: "List history items", value: `${selected.listHistory.length}` },
        { label: "Policy snapshots", value: `${selected.policyHistory.length}` },
        { label: "Review items", value: `${selected.reviewQueue.length}` },
        { label: "Export generated", value: formatIso(selection.auditBundle?.generatedAt) },
      ],
      notes: [
        "Audit export is a structured JSON bundle: signals, assessments, decisions, consequences, propagation, recovery, AI, policy snapshots, anchors, and raw audit records.",
        "List history explains watchlist / restricted_list / blacklist_or_frozen_list transitions without becoming a new state source.",
      ],
      jsonSections: [
        jsonSection("Structured Audit Export", selection.auditBundle, "Run an audit export to inspect the full evidence bundle."),
        jsonSection("Risk List History", selected.listHistory, "Refresh list history to inspect list additions, removals, expiry, and manual overrides."),
      ],
    },
    policy: {
      policyMetrics: [
        { label: "Target action", value: selection.activePolicy.targetAction },
        { label: "Allowed modes", value: listText(selection.activePolicy.allowedModes) },
        { label: "Proof template", value: selection.activePolicy.proofTemplate },
        { label: "Policy version", value: `${selection.activePolicy.policyVersion}` },
      ],
      decisionMetrics: [
        { label: "Policy preflight", value: selection.policyPreflight?.reason ?? "Not checked" },
        { label: "Verifier preflight", value: selection.verifierPreflight },
        { label: "Access decision", value: selection.accessDecision?.decision ?? "Not evaluated" },
        { label: "Warning decision", value: selection.warningDecision?.decision ?? "Not evaluated" },
        { label: "Reason count", value: `${selection.accessDecision?.reasons?.length ?? 0}` },
        { label: "Snapshot history", value: `${selected.policyHistory.length}` },
      ],
      notes: [
        "Policy decisions are action-level snapshots for display, export, and traceability only.",
        "Policy can read state, consequence, credentials, proof, and mode path, but it cannot rewrite identity state.",
        "Compliance requirements cannot be bypassed by default path or positive consequence explanations.",
      ],
      jsonSections: [
        jsonSection("Access Payload", selection.payload, "Build an access payload to evaluate credential, proof, and policy checks."),
        jsonSection("Access Decision", selection.accessDecision, "Evaluate the active policy to inspect access reasons and warnings."),
        jsonSection("Warning Decision", selection.warningDecision, "Warning policy results appear here after analyzer refresh."),
        jsonSection("Policy Snapshot History", selected.policyHistory, "Policy decisions accumulate here as action-level audit snapshots."),
      ],
    },
    aiReview: {
      reviewMetrics: [
        { label: "Pending review", value: `${selected.summary?.reviewQueueCounts?.pending ?? 0}` },
        { label: "Confirmed review", value: `${selected.summary?.reviewQueueCounts?.confirmed ?? 0}` },
        { label: "Dismissed review", value: `${selected.summary?.reviewQueueCounts?.dismissed ?? 0}` },
        { label: "Expired review", value: `${selected.summary?.reviewQueueCounts?.expired ?? 0}` },
        { label: "AI suggestions", value: `${selected.aiSuggestions.length}` },
        {
          label: "Manual release floor",
          value: selection.riskContext?.summary?.manualReleaseWindow ? "Active history present" : "None",
        },
      ],
      boundaryNotes: [
        "AI suggestion is not final decision.",
        "AI can recommend watch, review, or warn_only; it cannot directly write state or freeze identities.",
        "Human confirm creates an explicit manual-review signal and audit trail.",
      ],
      reviewItems: selected.reviewQueue.map((item: any) => ({
        title: `${item.status} - ${compactHex(item.reviewItemId, 12, 6)}`,
        meta: `${formatIso(item.createdAt)} -> expires ${formatIso(item.expiresAt)}`,
        body: listText(item.evidenceRefs ?? []),
      })),
      jsonSections: [
        jsonSection("AI Suggestions", selected.aiSuggestions, "Analyzer AI suggestions appear here when reviewable signals are created."),
        jsonSection("Review Queue", selected.reviewQueue, "AI review items remain off-chain until a human confirms or dismisses them."),
      ],
    },
    operator: {
      metrics: [
        { label: "High-risk identities", value: `${operatorDashboard?.counts.highRiskIdentities ?? 0}` },
        { label: "Frozen identities", value: `${operatorDashboard?.counts.frozenIdentities ?? 0}` },
        { label: "Pending AI reviews", value: `${operatorDashboard?.counts.pendingAiReviews ?? 0}` },
        { label: "Active watchers", value: `${operatorDashboard?.counts.activeWatchers ?? 0}` },
        { label: "Bindings", value: `${selection.riskContext?.bindings.length ?? 0}` },
        { label: "Runtime status", value: selection.status },
      ],
      notes: [
        "Operator controls are intentionally separated from the scenario summary to keep the console narrative summary-first.",
        "Bindings, watch scans, manual release, and list overrides live here as explicit operator actions.",
        "Recent operator events combine state-computation audit records with policy snapshot history.",
      ],
      recentEvents: [
        ...(operatorDashboard?.recentHighRiskOrFrozen ?? []).map((item: any) => ({
          title: item.action,
          meta: formatIso(item.timestamp),
          body: `${compactHex(item.identityId)} / ${listText(item.evidenceRefs ?? [])}`,
        })),
        ...(operatorDashboard?.recentWarningPolicies ?? []).map((item: any) => ({
          title: `${item.kind.toUpperCase()} ${item.policyId}`,
          meta: formatIso(item.createdAt),
          body: `${item.decision} / ${listText(item.reasons ?? [])}`,
        })),
      ].slice(0, 10),
      jsonSections: [
        jsonSection("Operator Dashboard", operatorDashboard, "Refresh operator metrics after the analyzer and policy APIs are running."),
        jsonSection("Bindings", selection.riskContext?.bindings, "Bindings appear here after root, sub, or same-root authorization succeeds."),
        jsonSection(
          "Watch Status",
          selection.watchStatus ?? selection.riskContext?.summary?.watchStatus,
          "Watcher status appears here after start, refresh, or stop.",
        ),
      ],
    },
  };
}
