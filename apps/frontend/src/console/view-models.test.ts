import { describe, expect, it } from "vitest";
import type { ConsoleSelection } from "./types";
import { buildPlatformConsoleViewModels } from "./view-models";

function buildSelection(overrides: Partial<ConsoleSelection> = {}): ConsoleSelection {
  return {
    scenario: "enterprise",
    enterpriseAction: "audit",
    socialAction: "vote",
    platformEntry: {
      label: "Platform",
      summary: "summary",
      acceptance: "pnpm exec tsx scripts/verify-stage3-acceptance.ts platform",
    },
    rootIdentity: {
      rootId: "0x1",
      identityId: "0x2",
      controllerAddress: "0x0000000000000000000000000000000000000001",
      didLikeId: "did:web3id:root",
      chainId: 31337,
      createdAt: new Date().toISOString(),
      capabilities: {
        supportsHolderBinding: true,
        supportsIssuerValidation: true,
        hasLinkedCredentials: true,
        supportedProofKinds: ["holder_bound"],
        preferredMode: "COMPLIANCE_MODE",
      },
    } as any,
    selectedSubIdentity: {
      identityId: "0x3",
      scope: "enterprise/audit",
      type: "PAYMENTS",
    } as any,
    subIdentities: [{ identityId: "0x3", scope: "enterprise/audit", type: "PAYMENTS" } as any],
    capabilities: {
      supportsHolderBinding: true,
      supportsIssuerValidation: true,
      hasLinkedCredentials: true,
      supportedProofKinds: ["holder_bound"],
      preferredMode: "COMPLIANCE_MODE",
    },
    policySupport: { supported: true },
    effectiveMode: "COMPLIANCE_MODE",
    activePolicy: {
      targetAction: "audit_export",
      allowedModes: ["COMPLIANCE_MODE"],
      proofTemplate: "credential_bound_proof",
      policyVersion: 2,
    },
    identityContext: {
      currentState: 3,
      activeConsequences: [{ consequenceType: "limit_relaxation" }],
      consequences: [{ consequenceType: "limit_relaxation" }],
      assessments: [],
    } as any,
    riskContext: {
      summary: {
        storedState: 3,
        effectiveState: 4,
        anchoredState: 3,
        riskScore: 74,
        reviewQueueCounts: { pending: 1, confirmed: 1, dismissed: 0, expired: 1 },
        positiveSummary: {
          activePositiveSignals: [],
          activeUnlocks: [{ consequenceType: "access_unlock" }],
          activeRestrictions: [{ consequenceType: "tx_limit" }],
          demoDefaults: true,
        },
        recoveryProgress: {
          releaseFloorActive: true,
          floorUntil: "2026-03-30T00:00:00.000Z",
          cooldownRemainingDays: 12,
          activeRestrictions: ["tx_limit"],
          activeUnlocks: ["access_unlock"],
          helpfulPositiveSignals: ["trusted_protocol_usage"],
        },
        propagation: {
          reasonCodes: ["ROOT_ESCALATION"],
          warnings: ["root overlay applied"],
          rootEffectiveFloorState: 3,
        },
      },
      reviewQueue: [{ reviewItemId: "review-1", status: "PENDING_REVIEW", createdAt: "2026-03-18T00:00:00.000Z", evidenceRefs: ["tx:1"] }],
      aiSuggestions: [{ id: "ai-1" }],
      bindings: [{ bindingId: "binding-1" }],
      anchors: [{ anchorId: "anchor-1" }],
      signals: [{ signalId: "signal-1" }],
      audit: [{ auditId: "audit-1" }],
      listHistory: [{ itemId: "history-1" }],
      policyDecisions: [{ decisionId: "decision-1" }],
    } as any,
    accessDecision: { decision: "allow", reasons: ["credential_ok"] },
    warningDecision: { decision: "warn" },
    watchStatus: { items: [{ watchId: "watch-1" }] },
    policyPreflight: { reason: "preflight ok" } as any,
    verifierPreflight: "Allowed",
    bundles: [{} as any],
    payload: { identityId: "0x3" } as any,
    status: "Ready",
    mintedBalance: "1",
    operatorDashboard: {
      counts: {
        highRiskIdentities: 2,
        frozenIdentities: 1,
        pendingReviewItems: 1,
        pendingAiReviews: 1,
        activeWatchers: 2,
      },
      recentHighRiskOrFrozen: [{ action: "STATE_COMPUTED", timestamp: "2026-03-18T00:00:00.000Z", identityId: "0x3", evidenceRefs: ["tx:1"] }],
      recentWarningPolicies: [{ kind: "warning", policyId: "COUNTERPARTY_WARNING_V1", createdAt: "2026-03-18T00:00:00.000Z", decision: "warn", reasons: ["state_high"] }],
    } as any,
    auditBundle: {
      generatedAt: "2026-03-18T00:00:00.000Z",
      signals: [{}],
      assessments: [{}],
      anchors: [{}],
      auditRecords: [{}],
    } as any,
    listHistory: [{ itemId: "history-1" }] as any,
    policyHistory: [{ decisionId: "decision-1" }] as any,
    ...overrides,
  };
}

describe("buildPlatformConsoleViewModels", () => {
  it("keeps stored and effective state separate in the overview and state panels", () => {
    const models = buildPlatformConsoleViewModels(buildSelection());
    expect(models.overview.metrics.find((item) => item.label === "Stored state")?.value).toBe("RESTRICTED");
    expect(models.overview.metrics.find((item) => item.label === "Effective state")?.value).toBe("HIGH_RISK");
    expect(models.stateConsequence.stateMetrics.find((item) => item.label === "Stored state")?.value).toBe("RESTRICTED");
    expect(models.stateConsequence.stateMetrics.find((item) => item.label === "Effective state")?.value).toBe("HIGH_RISK");
  });

  it("renders policy notes that keep policy snapshots separate from state facts", () => {
    const models = buildPlatformConsoleViewModels(buildSelection());
    expect(models.policy.notes.some((note) => note.includes("action-level snapshots"))).toBe(true);
  });

  it("marks positive thresholds as configurable demo defaults", () => {
    const models = buildPlatformConsoleViewModels(buildSelection());
    expect(models.stateConsequence.recoveryNotes.some((note) => note.includes("demo defaults"))).toBe(true);
  });
});
