export type { RootIdentity, SubjectAggregate, SubIdentity, RecoveryIntent, RecoveryPolicySlot } from "@web3id/identity";
export type { CredentialAttestation, CredentialBundle } from "@web3id/credential";
export type { ProofDescriptor } from "@web3id/proof";
export type {
  ConsequenceRecord,
  CrossChainStateMessage,
  ExplanationBlock,
  RiskAssessment,
  RiskSignal,
  StateSnapshot,
  StateTransitionDecision,
} from "@web3id/state";
export type { AiSuggestion, AuditExportBundle, PolicyDecisionRecord } from "@web3id/risk";

export type SystemModelStability = "stable" | "extensible" | "reserved";
export type SystemModelLayer = "identity" | "credential" | "proof" | "state" | "risk" | "system";

export type SystemModelBinding = {
  doc: string;
  code: string[];
  tests: string[];
  callPoints: string[];
  guards?: string[];
};

export type SystemModelObjectDescriptor = {
  name: string;
  layer: SystemModelLayer;
  sourcePackage: string;
  stability: SystemModelStability;
  summary: string;
  binding: SystemModelBinding;
};

export type SystemRelationshipDescriptor = {
  from: string;
  to: string;
  summary: string;
};

export const systemModelManifest = {
  layers: ["identity", "credential", "proof", "state", "risk", "system"] as const,
  objects: [
    {
      name: "RootIdentity",
      layer: "identity",
      sourcePackage: "@web3id/identity",
      stability: "stable",
      summary: "Immutable root controller anchor for the identity tree.",
      binding: {
        doc: "docs/SYSTEM_MODEL.md",
        code: ["packages/identity/src/index.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/sdk/src/system-model.test.ts", "tests/system/core-acceptance.test.ts"],
        callPoints: ["apps/frontend/src/console/view-models.ts", "apps/analyzer-service/src/service.ts"],
      },
    },
    {
      name: "SubIdentity",
      layer: "identity",
      sourcePackage: "@web3id/identity",
      stability: "stable",
      summary: "Scenario-scoped identity leaf that isolates permissions and state overlays.",
      binding: {
        doc: "docs/SYSTEM_MODEL.md",
        code: ["packages/identity/src/index.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/sdk/src/system-model.test.ts", "tests/system/scenario-acceptance.test.ts"],
        callPoints: ["apps/frontend/src/console/view-models.ts", "apps/analyzer-service/src/service.ts"],
      },
    },
    {
      name: "SubjectAggregate",
      layer: "identity",
      sourcePackage: "@web3id/identity",
      stability: "extensible",
      summary: "Subject merge layer that binds multiple root identities through audited controller proofs without becoming a formal state host.",
      binding: {
        doc: "docs/MULTICHAIN_SUBJECT_AGGREGATE.md",
        code: ["packages/identity/src/types.ts", "apps/analyzer-service/src/service.ts", "packages/sdk/src/system-model.ts"],
        tests: ["apps/analyzer-service/src/service.test.ts", "tests/system/subject-aggregate-binding-acceptance.test.ts"],
        callPoints: ["apps/frontend/src/console/view-models.ts", "apps/policy-api/src/service.ts"],
        guards: ["aggregate-not-state-host", "no-silent-merge", "no-cross-chain-auto-bind"],
      },
    },
    {
      name: "RecoveryPolicySlot",
      layer: "identity",
      sourcePackage: "@web3id/identity",
      stability: "reserved",
      summary: "Passive-only recovery metadata slot; reserved for future activation.",
      binding: {
        doc: "docs/RESERVED_EXTENSIONS_GUARDRAILS.md",
        code: ["packages/identity/src/recovery.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/identity/src/recovery.test.ts", "tests/system/reserved-safety-acceptance.test.ts"],
        callPoints: ["packages/sdk/src/index.ts", "apps/frontend/src/console/view-models.ts"],
        guards: ["recoveryHookGuardrails", "assertRecoveryHooksRemainPassive"],
      },
    },
    {
      name: "RecoveryIntent",
      layer: "identity",
      sourcePackage: "@web3id/identity",
      stability: "reserved",
      summary: "Recorded recovery intent that cannot unlock, rebind, or rotate control in the current phase.",
      binding: {
        doc: "docs/RESERVED_EXTENSIONS_GUARDRAILS.md",
        code: ["packages/identity/src/recovery.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/identity/src/recovery.test.ts", "tests/system/reserved-safety-acceptance.test.ts"],
        callPoints: ["packages/sdk/src/index.ts", "apps/frontend/src/console/view-models.ts"],
        guards: ["recoveryHookGuardrails", "assertRecoveryHooksRemainPassive"],
      },
    },
    {
      name: "CredentialBundle",
      layer: "credential",
      sourcePackage: "@web3id/credential",
      stability: "stable",
      summary: "Credential plus attestation bundle consumed by compliance access flows.",
      binding: {
        doc: "docs/SYSTEM_MODEL.md",
        code: ["packages/credential/src/index.ts", "packages/sdk/src/system-model.ts"],
        tests: ["tests/system/scenario-acceptance.test.ts"],
        callPoints: ["apps/policy-api/src/service.ts", "apps/frontend/src/console/view-models.ts"],
      },
    },
    {
      name: "ProofDescriptor",
      layer: "proof",
      sourcePackage: "@web3id/proof",
      stability: "extensible",
      summary: "Proof metadata abstraction that remains read-only for privacy modes.",
      binding: {
        doc: "docs/RESERVED_EXTENSIONS_GUARDRAILS.md",
        code: ["packages/proof/src/interfaces.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/proof/src/privacy.test.ts", "tests/system/reserved-safety-acceptance.test.ts"],
        callPoints: ["packages/sdk/src/index.ts", "apps/frontend/src/console/view-models.ts"],
        guards: ["proofPrivacyGuardrails", "assertProofPrivacyGuardrails", "getProofDescriptorSafe"],
      },
    },
    {
      name: "RiskSignal",
      layer: "state",
      sourcePackage: "@web3id/state",
      stability: "stable",
      summary: "Base fact input for state replay and scoring.",
      binding: {
        doc: "docs/EXPLANATION_AND_AUDIT_CHAIN.md",
        code: ["packages/state/src/signal.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/state/src/state.test.ts", "tests/system/core-acceptance.test.ts"],
        callPoints: ["apps/analyzer-service/src/service.ts"],
      },
    },
    {
      name: "RiskAssessment",
      layer: "state",
      sourcePackage: "@web3id/state",
      stability: "stable",
      summary: "Assessment node that binds signals to a scored state explanation.",
      binding: {
        doc: "docs/EXPLANATION_AND_AUDIT_CHAIN.md",
        code: ["packages/state/src/assessment.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/state/src/state.test.ts", "tests/system/core-acceptance.test.ts"],
        callPoints: ["apps/analyzer-service/src/service.ts"],
      },
    },
    {
      name: "StateTransitionDecision",
      layer: "state",
      sourcePackage: "@web3id/state",
      stability: "stable",
      summary: "Transition record that moves from assessment to stored state.",
      binding: {
        doc: "docs/EXPLANATION_AND_AUDIT_CHAIN.md",
        code: ["packages/state/src/decision.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/state/src/state.test.ts", "tests/system/core-acceptance.test.ts"],
        callPoints: ["apps/analyzer-service/src/service.ts"],
      },
    },
    {
      name: "ConsequenceRecord",
      layer: "state",
      sourcePackage: "@web3id/state",
      stability: "stable",
      summary: "Post-decision control effect that constrains actions without rewriting facts.",
      binding: {
        doc: "docs/EXPLANATION_AND_AUDIT_CHAIN.md",
        code: ["packages/state/src/consequence.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/state/src/state.test.ts", "tests/system/boundary-acceptance.test.ts"],
        callPoints: ["apps/policy-api/src/service.ts", "apps/frontend/src/console/view-models.ts"],
      },
    },
    {
      name: "ExplanationBlock",
      layer: "state",
      sourcePackage: "@web3id/state",
      stability: "stable",
      summary: "System-level explanation schema shared by summary, policy, review, and audit exports.",
      binding: {
        doc: "docs/EXPLANATION_AND_AUDIT_CHAIN.md",
        code: ["packages/state/src/explanation.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/sdk/src/system-model.test.ts", "tests/system/core-acceptance.test.ts"],
        callPoints: ["apps/analyzer-service/src/service.ts", "apps/frontend/src/console/view-models.ts", "apps/policy-api/src/service.ts"],
      },
    },
    {
      name: "StateSnapshot",
      layer: "state",
      sourcePackage: "@web3id/state",
      stability: "reserved",
      summary: "Read-only structured snapshot for cross-chain state transport.",
      binding: {
        doc: "docs/RESERVED_EXTENSIONS_GUARDRAILS.md",
        code: ["packages/state/src/cross-chain.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/state/src/cross-chain.test.ts", "tests/system/reserved-safety-acceptance.test.ts"],
        callPoints: ["packages/sdk/src/index.ts"],
        guards: ["crossChainHookGuardrails", "assertCrossChainHookGuardrails"],
      },
    },
    {
      name: "CrossChainStateMessage",
      layer: "state",
      sourcePackage: "@web3id/state",
      stability: "reserved",
      summary: "Target-chain message wrapper around a read-only state snapshot commitment.",
      binding: {
        doc: "docs/RESERVED_EXTENSIONS_GUARDRAILS.md",
        code: ["packages/state/src/cross-chain.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/state/src/cross-chain.test.ts", "tests/system/reserved-safety-acceptance.test.ts"],
        callPoints: ["packages/sdk/src/index.ts"],
        guards: ["crossChainHookGuardrails", "assertCrossChainHookGuardrails"],
      },
    },
    {
      name: "PolicyDecisionRecord",
      layer: "risk",
      sourcePackage: "@web3id/risk",
      stability: "stable",
      summary: "Action-level policy snapshot used for audit, not a state fact source.",
      binding: {
        doc: "docs/EXPLANATION_AND_AUDIT_CHAIN.md",
        code: ["packages/risk/src/types.ts", "apps/analyzer-service/src/service.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/risk/src/risk.test.ts", "tests/system/boundary-acceptance.test.ts"],
        callPoints: ["apps/policy-api/src/service.ts", "apps/frontend/src/console/view-models.ts"],
      },
    },
    {
      name: "AuditExportBundle",
      layer: "risk",
      sourcePackage: "@web3id/risk",
      stability: "stable",
      summary: "Chain-normalized audit export for signals, decisions, consequences, policy, and review artifacts.",
      binding: {
        doc: "docs/EXPLANATION_AND_AUDIT_CHAIN.md",
        code: ["packages/risk/src/audit-normalizer.ts", "apps/analyzer-service/src/service.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/sdk/src/system-model.test.ts", "tests/system/core-acceptance.test.ts"],
        callPoints: ["apps/analyzer-service/src/service.ts", "apps/frontend/src/console/view-models.ts"],
      },
    },
    {
      name: "AiSuggestion",
      layer: "risk",
      sourcePackage: "@web3id/risk",
      stability: "stable",
      summary: "Advisory-only off-chain suggestion that requires human review before any state write.",
      binding: {
        doc: "docs/EXPLANATION_AND_AUDIT_CHAIN.md",
        code: ["packages/risk/src/ai-assistant.ts", "packages/sdk/src/system-model.ts"],
        tests: ["packages/risk/src/risk.test.ts", "tests/system/boundary-acceptance.test.ts"],
        callPoints: ["apps/analyzer-service/src/service.ts", "apps/frontend/src/console/view-models.ts"],
      },
    },
  ] satisfies SystemModelObjectDescriptor[],
  relationships: [
    {
      from: "RootIdentity",
      to: "SubIdentity",
      summary: "Root identity anchors the tree; sub identities isolate scenario-scoped permissions and state overlays.",
    },
    {
      from: "SubjectAggregate",
      to: "RootIdentity",
      summary: "Subject aggregates bind multiple roots through explicit proof and audit, while root/sub remain the only formal state hosts.",
    },
    {
      from: "RiskSignal",
      to: "RiskAssessment",
      summary: "Signals replay into assessments before any state transition is committed.",
    },
    {
      from: "RiskAssessment",
      to: "StateTransitionDecision",
      summary: "Assessments create state transition decisions with explanation and evidence continuity.",
    },
    {
      from: "StateTransitionDecision",
      to: "ConsequenceRecord",
      summary: "Decisions can emit consequences that constrain actions without rewriting state facts.",
    },
    {
      from: "ConsequenceRecord",
      to: "PolicyDecisionRecord",
      summary: "Policy decisions may read consequences, but policy snapshots never become state fact sources.",
    },
    {
      from: "StateSnapshot",
      to: "CrossChainStateMessage",
      summary: "Reserved cross-chain output remains read-only and cannot mutate local policy or state.",
    },
    {
      from: "RecoveryPolicySlot",
      to: "RecoveryIntent",
      summary: "Reserved recovery intents are metadata-only and remain passive until a future activation phase.",
    },
  ] satisfies SystemRelationshipDescriptor[],
  acceptance: {
    smokeCommand: "pnpm test:system:smoke",
    fullCommand: "pnpm test:system",
  },
} as const;

export function getSystemModelObject(name: string) {
  return systemModelManifest.objects.find((item) => item.name === name) ?? null;
}
