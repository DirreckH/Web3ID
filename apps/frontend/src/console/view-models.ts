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
  systemMap: string[];
  scenarioCards: Array<{
    id: "rwa" | "enterprise" | "social";
    label: string;
    description: string;
    policyPath: string;
    recommendedDemo: string;
    active: boolean;
  }>;
  scenarioSummary: string;
  jsonSections: JsonSection[];
};

export type IdentityDetailViewModel = {
  metrics: MetricItem[];
  credentialMetrics: MetricItem[];
  aggregateMetrics: MetricItem[];
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
  const subjectAggregate = selection.riskContext?.subjectAggregate ?? null;

  return {
    overview: {
      badges: [
        `System Entry: ${selection.platformEntry.label}`,
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
        "break-glass is queue_unblock / temporary_release / consequence_rollback only; raw state rewrite is forbidden.",
      ],
      systemMap: [
        "Identity: RootIdentity anchors the tree; SubIdentity isolates scenario scope.",
        "State: RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord.",
        "Policy: policy reads effective state, credentials, proof, and consequence, then writes an audit snapshot only.",
        "Audit: AuditExportBundle and explanationChain keep the why-path visible end to end, including approvals and cross-domain hints.",
        "Operator: bindings, watch scans, governed recovery, positive uplift, and list overrides remain explicit actions after the system map.",
      ],
      scenarioCards: selected.scenarioOptions,
      scenarioSummary: selected.scenarioMeta.detail,
      jsonSections: [
        jsonSection(
          "System Architecture Summary",
          {
            identity: {
              rootIdentityId: selection.rootIdentity?.identityId ?? null,
              selectedSubIdentityId: selection.selectedSubIdentity?.identityId ?? null,
            },
            state: selected.summary
              ? {
                  storedState: selected.summary.storedState,
                  effectiveState: selected.summary.effectiveState,
                  why: selected.summary.explanation,
                }
              : null,
            policy: {
              accessDecision: selection.accessDecision?.decision ?? null,
              warningDecision: selection.warningDecision?.decision ?? null,
            },
            audit: selection.auditBundle
              ? {
                  generatedAt: selection.auditBundle.generatedAt,
                  explanationChainEntries: selection.auditBundle.explanationChain?.length ?? 0,
                  consistency: selection.auditBundle.consistency ?? null,
                }
              : null,
          },
          "Run the analyzer and policy flows to populate the system map.",
        ),
      ],
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
      aggregateMetrics: [
        { label: "Subject aggregate", value: subjectAggregate?.subjectAggregateId ?? "Not linked" },
        { label: "Aggregate status", value: subjectAggregate?.status ?? "N/A" },
        { label: "Linked roots", value: `${subjectAggregate?.linkedRootIds?.length ?? 0}` },
        { label: "Linked controllers", value: `${subjectAggregate?.controllerSummary?.length ?? 0}` },
        { label: "Binding graph version", value: `${subjectAggregate?.bindingGraphVersion ?? 0}` },
        { label: "Aggregate bindings", value: `${subjectAggregate?.linkedBindings?.length ?? 0}` },
      ],
      notes: [
        "Root identity stays unique and immutable.",
        "Sub identity scope is fixed after normalization and drives scenario isolation.",
        "Capability-first does not mean a permanent mode label; policy and credentials still matter.",
        subjectAggregate
          ? "Subject aggregate is a read-model and governance layer only; it does not replace the root/sub state hosts."
          : "Subject aggregate remains optional and is created only through explicit controller binding.",
      ],
      jsonSections: [
        jsonSection("Root Identity", selection.rootIdentity, "Connect and sign to derive the root identity tree."),
        jsonSection("Selected Sub Identity", selection.selectedSubIdentity, "Choose a scenario identity to inspect its permissions."),
        jsonSection("Issued Credential Bundles", selection.bundles, "Issue a scenario credential to populate linked credential evidence."),
        jsonSection("Subject Aggregate", subjectAggregate, "No subject aggregate has been linked to this root identity yet."),
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
        `Why: ${recoveryProgress?.explanation?.explanationSummary ?? "Recovery explanation will appear after analyzer computation."}`,
        `Active restrictions: ${listText(recoveryProgress?.activeRestrictions ?? [])}`,
        `Active unlocks: ${listText(recoveryProgress?.activeUnlocks ?? [])}`,
        `Recovery helpers: ${listText(recoveryProgress?.helpfulPositiveSignals ?? [])}`,
        positiveSummary?.demoDefaults
          ? "Positive signal thresholds are demo defaults and remain configurable."
          : "Positive thresholds loaded from runtime config.",
      ],
      propagationNotes: [
        `Why: ${propagation?.explanation?.explanationSummary ?? "No propagation explanation yet."}`,
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
        jsonSection(
          "Why: State Summary",
          selected.summary?.explanation,
          "State explanation appears after the analyzer produces a summary.",
        ),
        jsonSection(
          "Why: Recovery",
          selected.summary?.recoveryProgress?.explanation,
          "Recovery explanation appears when positive-signal or manual-release data is available.",
        ),
        jsonSection(
          "Why: Propagation",
          selected.summary?.propagation?.explanation,
          "Propagation explanation appears when overlays or root floors are evaluated.",
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
        "Phase4 recovery remains governance-first: evidence, approval, decision, execution, and outcome are all audit-linked.",
        "Recovery and break-glass can release consequence pressure or unblock queues, but they cannot raw-rewrite stored state.",
        "Positive uplift stays in scope here too: capability restore, trust boost, and eligibility unlocks remain explanation-first.",
      ],
      jsonSections: [
        jsonSection("Recovery Hooks Snapshot", selection.recoveryHooks, "Recovery hooks are not configured for the selected root identity."),
        jsonSection("Recovery Cases", selection.riskContext?.recoveryCases, "Recovery cases appear after a governed case is opened."),
        jsonSection("Approval Tickets", selection.riskContext?.approvalTickets, "Approval tickets appear when governed actions require operator review."),
        jsonSection("Cross-chain Inbox", selection.riskContext?.crossChainInbox, "Cross-chain hints appear here after attested inbox ingestion."),
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
        "Audit export is a structured JSON bundle: signals, assessments, decisions, consequences, propagation, recovery, AI, policy snapshots, approvals, cross-chain inbox, anchors, and raw audit records.",
        "List history explains watchlist / restricted_list / blacklist_or_frozen_list transitions without becoming a new state source.",
        `Explanation chain completeness: ${selection.auditBundle?.consistency?.complete ? "complete" : "check missing segments before Phase4 freeze."}`,
      ],
      jsonSections: [
        jsonSection("Structured Audit Export", selection.auditBundle, "Run an audit export to inspect the full evidence bundle."),
        jsonSection("Risk List History", selected.listHistory, "Refresh list history to inspect list additions, removals, expiry, and manual overrides."),
        jsonSection("Explanation Chain", selection.auditBundle?.explanationChain, "Run a structured audit export to inspect the explanation chain."),
        jsonSection("Export Consistency", selection.auditBundle?.consistency, "Consistency checks appear after a structured audit export."),
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
        "Proof disclosure profiles and verified cross-chain hints now enter the explanation chain without becoming direct state writers.",
        `Latest access why: ${selection.accessDecision?.explanation?.explanationSummary ?? "Run an access evaluation to populate the decision explanation."}`,
      ],
      jsonSections: [
        jsonSection("Access Payload", selection.payload, "Build an access payload to evaluate credential, proof, and policy checks."),
        jsonSection("Access Decision", selection.accessDecision, "Evaluate the active policy to inspect access reasons and warnings."),
        jsonSection("Warning Decision", selection.warningDecision, "Warning policy results appear here after analyzer refresh."),
        jsonSection("Policy Snapshot History", selected.policyHistory, "Policy decisions accumulate here as action-level audit snapshots."),
        jsonSection("Why: Access Decision", selection.accessDecision?.explanation, "Access explanation appears after the policy API evaluates the current action."),
        jsonSection("Why: Warning Decision", selection.warningDecision?.explanation, "Warning explanation appears after the warning policy runs."),
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
        body: `${item.explanation?.explanationSummary ?? "Human review is required."} | evidence: ${listText(item.evidenceRefs ?? [])}`,
      })),
      jsonSections: [
        jsonSection("AI Suggestions", selected.aiSuggestions, "Analyzer AI suggestions appear here when reviewable signals are created."),
        jsonSection("Review Queue", selected.reviewQueue, "AI review items remain off-chain until a human confirms or dismisses them."),
        jsonSection(
          "Why: AI Suggestions",
          selected.aiSuggestions.map((item: any) => ({ id: item.id, explanation: item.explanation })),
          "AI explanations appear when suggestions are generated.",
        ),
        jsonSection(
          "Why: Review Queue",
          selected.reviewQueue.map((item: any) => ({ reviewItemId: item.reviewItemId, explanation: item.explanation })),
          "Review explanations appear when AI suggestions enter the queue.",
        ),
      ],
    },
    operator: {
      metrics: [
        { label: "High-risk identities", value: `${operatorDashboard?.counts.highRiskIdentities ?? 0}` },
        { label: "Frozen identities", value: `${operatorDashboard?.counts.frozenIdentities ?? 0}` },
        { label: "Pending AI reviews", value: `${operatorDashboard?.counts.pendingAiReviews ?? 0}` },
        { label: "Active watchers", value: `${operatorDashboard?.counts.activeWatchers ?? 0}` },
        { label: "Pending recovery", value: `${operatorDashboard?.counts.pendingRecoveryCases ?? 0}` },
        { label: "Pending approvals", value: `${operatorDashboard?.counts.pendingApprovalTickets ?? 0}` },
        { label: "Active uplifts", value: `${operatorDashboard?.counts.activePositiveUplifts ?? 0}` },
        { label: "Bindings", value: `${selection.riskContext?.bindings.length ?? 0}` },
        { label: "Runtime status", value: selection.status },
      ],
      notes: [
        "Operator controls are intentionally separated from the scenario summary to keep the console narrative summary-first.",
        "Bindings, watch scans, governed recovery, manual release, positive uplift review, and list overrides live here as explicit operator actions.",
        "Recent operator events combine state-computation audit records, approval flow, and policy snapshot history.",
      ],
      recentEvents: [
        ...(operatorDashboard?.recentHighRiskOrFrozen ?? []).map((item: any) => ({
          title: item.action,
          meta: formatIso(item.timestamp),
          body: `${compactHex(item.identityId)} / ${listText(item.evidenceRefs ?? [])}`,
        })),
        ...(operatorDashboard?.recentApprovalTickets ?? []).map((item: any) => ({
          title: `${item.action} / ${item.status}`,
          meta: formatIso(item.updatedAt),
          body: `${compactHex(item.identityId ?? item.rootIdentityId)} / approvals ${item.approvedBy?.length ?? 0}/${item.requiredApprovals}`,
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
        jsonSection("Positive Uplift Notes", operatorDashboard?.positiveUpliftNotes, "Positive uplift notes appear when trust boost or unlock effects are active."),
        jsonSection(
          "Watch Status",
          selection.watchStatus ?? selection.riskContext?.summary?.watchStatus,
          "Watcher status appears here after start, refresh, or stop.",
        ),
      ],
    },
  };
}
