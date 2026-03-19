import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ServiceHarness } from "../integration/service-harness.js";
import { createSystemHarness } from "./helpers.js";

describe.sequential("phase4 governance control acceptance", () => {
  let harness: ServiceHarness | undefined;

  beforeAll(async () => {
    harness = await createSystemHarness(15055);
  }, 900_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("enforces governed approvals and rejects unsupported break-glass actions", async () => {
    const invalidBreakGlass = await harness.postRaw(`${harness.urls.analyzer}/recovery/cases`, {
      rootIdentityId: harness.rootIdentity.identityId,
      targetSubIdentityId: harness.socialIdentity.identityId,
      action: "access_path_unlock",
      requestedBy: "phase4.operator",
      scope: "access_path",
      breakGlassAction: "raw_state_rewrite",
    });
    expect(invalidBreakGlass.status).toBe(400);

    const recoveryCase = await harness.postJson<any>(`${harness.urls.analyzer}/recovery/cases`, {
      rootIdentityId: harness.rootIdentity.identityId,
      targetSubIdentityId: harness.socialIdentity.identityId,
      action: "access_path_unlock",
      requestedBy: "phase4.operator",
      scope: "access_path",
      breakGlassAction: "queue_unblock",
    });
    const blockedExecution = await harness.postRaw(`${harness.urls.analyzer}/recovery/cases/${recoveryCase.caseId}/execute`, {
      actor: "phase4.operator",
      action: "access_path_unlock",
      breakGlassAction: "queue_unblock",
    });
    expect(blockedExecution.status).toBe(400);

    const approvalTicket = await harness.postJson<any>(`${harness.urls.analyzer}/approvals`, {
      action: "positive_uplift",
      rootIdentityId: harness.rootIdentity.identityId,
      identityId: harness.socialIdentity.identityId,
      requiredRoles: ["operator", "governance_reviewer"],
      requiredApprovals: 2,
      reasonCode: "TRUST_BOOST_REVIEW",
      explanation: "Positive uplift request for trust boost and unlock eligibility.",
    });
    expect(approvalTicket.status).toBe("pending");

    await harness.postJson<any>(`${harness.urls.analyzer}/approvals/${approvalTicket.ticketId}/decision`, {
      actor: "operator-1",
      decision: "approve",
    });
    const approved = await harness.postJson<any>(`${harness.urls.analyzer}/approvals/${approvalTicket.ticketId}/decision`, {
      actor: "governance-1",
      decision: "approve",
    });
    expect(approved.status).toBe("approved");

    const dashboard = await harness.getJson<any>(`${harness.urls.analyzer}/operator/dashboard`);
    expect(dashboard.recentApprovalTickets.some((item: any) => item.ticketId === approvalTicket.ticketId && item.status === "approved")).toBe(true);
  }, 900_000);
});
