import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { recoveryHookGuardrails } from "../../identity/src/index.js";
import { proofPrivacyGuardrails } from "../../proof/src/index.js";
import { crossChainHookGuardrails } from "../../state/src/index.js";
import { systemModelManifest } from "./system-model.js";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");

function readDoc(name: string) {
  return readFileSync(resolve(ROOT, "docs", name), "utf8");
}

describe("system model documentation consistency", () => {
  it("keeps SYSTEM_MODEL aligned with the machine-readable manifest", () => {
    const doc = readDoc("SYSTEM_MODEL.md");

    for (const object of systemModelManifest.objects) {
      expect(doc).toContain(object.name);
      expect(doc).toContain(object.stability);
    }
  });

  it("uses package-level risk exports instead of a relative sdk-to-risk source hop", () => {
    const source = readFileSync(resolve(import.meta.dirname, "system-model.ts"), "utf8");

    expect(source).toContain('from "@web3id/risk"');
    expect(source).not.toContain("../../risk/src/index.js");
  });

  it("keeps explanation docs aligned with the shared explanation schema and call points", () => {
    const doc = readDoc("EXPLANATION_AND_AUDIT_CHAIN.md");

    for (const field of [
      "reasonCode",
      "explanationSummary",
      "evidenceRefs",
      "sourceAssessmentId",
      "sourceDecisionId",
      "sourcePolicyVersion",
      "sourceRegistryVersion",
      "actorType",
      "actorId",
      "aiContribution",
      "manualOverride",
    ]) {
      expect(doc).toContain(field);
    }

    expect(doc).toContain("apps/analyzer-service/src/service.ts");
    expect(doc).toContain("apps/policy-api/src/service.ts");
    expect(doc).toContain("apps/frontend/src/console/view-models.ts");
  });

  it("keeps reserved guardrail docs aligned with guard constants", () => {
    const doc = readDoc("RESERVED_EXTENSIONS_GUARDRAILS.md");

    expect(doc).toContain("crossChainHookGuardrails");
    expect(doc).toContain("recoveryHookGuardrails");
    expect(doc).toContain("proofPrivacyGuardrails");
    expect(doc).toContain(crossChainHookGuardrails.defaultMode);
    expect(doc).toContain(recoveryHookGuardrails.lifecycle);
    expect(doc).toContain(proofPrivacyGuardrails.safety);
    expect(doc).toContain("StateSnapshot");
    expect(doc).toContain("RecoveryPolicySlot");
    expect(doc).toContain("issuer_hidden_reserved");
  });

  it("keeps system acceptance and freeze docs aligned with real repo gates", () => {
    const acceptanceDoc = readDoc("SYSTEM_ACCEPTANCE.md");
    const freezeDoc = readDoc("PHASE4_FREEZE_CHECKLIST.md");
    const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");
    const prTemplatePath = resolve(ROOT, ".github", "PULL_REQUEST_TEMPLATE.md");

    expect(acceptanceDoc).toContain("pnpm test:system");
    expect(acceptanceDoc).toContain("pnpm test:system:smoke");
    expect(freezeDoc).toContain("pnpm test:system");
    expect(readme).toContain("pnpm test:system");
    expect(existsSync(prTemplatePath)).toBe(true);
    expect(readFileSync(prTemplatePath, "utf8")).toContain("hook_only");
  });

  it("documents the system-first narrative and frontend entry shift", () => {
    const whyDoc = readDoc("WHY_SYSTEM_NOT_JUST_PLATFORM.md");
    const consoleDoc = readDoc("PLATFORM_CONSOLE.md");

    expect(whyDoc).toContain("System Entry");
    expect(whyDoc).toContain("System Map");
    expect(consoleDoc).toContain("System Entry");
    expect(consoleDoc).toContain("Why: Access Decision");
  });
});
