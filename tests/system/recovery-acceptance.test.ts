import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IdentityState } from "../../packages/state/src/index.js";
import { DEMO_TARGETS, type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness, waitFor } from "./helpers.js";

describe.sequential("phase4 recovery acceptance", () => {
  let harness: ServiceHarness;

  beforeAll(async () => {
    harness = await createSystemHarness(14655);
  }, 900_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("runs a governed recovery closed loop without raw state rewrite", async () => {
    const start = await harness.currentBlockNumber();
    await harness.sendTransaction(DEMO_TARGETS.highRisk);
    const end = await harness.currentBlockNumber();
    await harness.backfillExact(harness.rwaIdentity.identityId, start + 1n, end);

    await waitFor(async () => {
      const context = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rwaIdentity.identityId}/risk-context`);
      return (context.summary?.effectiveState ?? IdentityState.NORMAL) > IdentityState.NORMAL ? context : null;
    }, 120_000, 2_000);

    const recoveryCase = await harness.postJson<any>(`${harness.urls.analyzer}/recovery/cases`, {
      rootIdentityId: harness.rootIdentity.identityId,
      targetSubIdentityId: harness.rwaIdentity.identityId,
      action: "capability_restore",
      requestedBy: "phase4.recovery.operator",
      scope: "capability",
      breakGlassAction: "temporary_release",
      idempotencyKey: "phase4-recovery-case",
    });

    expect(recoveryCase.versionEnvelope.schemaVersion).toBeTruthy();
    expect(recoveryCase.approvalTickets).toHaveLength(2);
    expect(recoveryCase.breakGlassAction).toBe("temporary_release");

    const withEvidence = await harness.postJson<any>(`${harness.urls.analyzer}/recovery/cases/${recoveryCase.caseId}/evidence`, {
      actor: "phase4.guardian",
      actorRole: "guardian",
      kind: "guardian_attestation",
      summary: "Guardian attested that the recovery path is legitimate.",
      evidenceRefs: ["guardian://phase4/recovery-case"],
    });
    expect(withEvidence.evidence).toHaveLength(1);

    const approvalTickets = await harness.getJson<any>(`${harness.urls.analyzer}/approvals?identityId=${harness.rwaIdentity.identityId}`);
    const approvalTicket = approvalTickets.items.find((item: any) => item.action === "recovery_execution");
    expect(approvalTicket).toBeTruthy();

    const firstApproval = await harness.postJson<any>(`${harness.urls.analyzer}/approvals/${approvalTicket.ticketId}/decision`, {
      actor: "operator-1",
      decision: "approve",
    });
    expect(firstApproval.status).toBe("pending");

    const secondApproval = await harness.postJson<any>(`${harness.urls.analyzer}/approvals/${approvalTicket.ticketId}/decision`, {
      actor: "governance-1",
      decision: "approve",
    });
    expect(secondApproval.status).toBe("approved");

    const approvedDecision = await harness.postJson<any>(`${harness.urls.analyzer}/recovery/cases/${recoveryCase.caseId}/decision`, {
      actor: "phase4.governance",
      actorRole: "governance_reviewer",
      outcome: "approved",
      reasonCode: "RECOVERY_APPROVED",
      explanation: "Governed recovery decision approved after evidence and dual approval.",
      evidenceRefs: ["audit://phase4/recovery-approval"],
    });
    expect(approvedDecision.decisions.at(-1)?.versionEnvelope.schemaVersion).toBeTruthy();

    const executed = await harness.postJson<any>(`${harness.urls.analyzer}/recovery/cases/${recoveryCase.caseId}/execute`, {
      actor: "phase4.recovery.operator",
      action: "capability_restore",
      breakGlassAction: "temporary_release",
      idempotencyKey: "phase4-recovery-execute",
    });

    expect(executed.status).toBe("executed");
    expect(executed.outcomes.at(-1)?.notes.join(" ")).not.toMatch(/raw state rewrite/i);

    const recoveredContext = await waitFor(async () => {
      const context = await harness.getJson<any>(`${harness.urls.analyzer}/identities/${harness.rwaIdentity.identityId}/risk-context`);
      return context.summary?.manualReleaseWindow ? context : null;
    }, 120_000, 2_000);

    expect(recoveredContext.recoveryCases.some((item: any) => item.caseId === recoveryCase.caseId && item.status === "executed")).toBe(true);
    expect(recoveredContext.summary.activeManualOverrides.releaseFloorActive).toBe(true);

    const auditBundle = await harness.postJson<any>(`${harness.urls.analyzer}/audit/export`, {
      identityId: harness.rwaIdentity.identityId,
    });
    expect(auditBundle.approvalTickets.some((item: any) => item.ticketId === approvalTicket.ticketId)).toBe(true);
    expect(auditBundle.versionEnvelope.auditBundleVersion).toBeTruthy();
  }, 900_000);
});
