import { IdentityState } from "../../state/src/index.js";
import type { SubIdentity } from "../../identity/src/index.js";
import type { Hex } from "viem";

export type PropagationHistoryEvent = {
  identityId: Hex;
  state: IdentityState;
  occurredAt: string;
  ruleFamily: string;
};

export type PropagationSubject = Pick<SubIdentity, "identityId" | "rootIdentityId" | "scope" | "permissions"> & {
  storedState: IdentityState;
};

export type PropagationOverlay = {
  identityId: Hex;
  overlayState: IdentityState;
  reason: string;
};

export type PropagationEvaluation = {
  rootTargetState: IdentityState | null;
  siblingOverlays: PropagationOverlay[];
  reasonCodes: string[];
};

function distinctIdentityCount(events: PropagationHistoryEvent[]) {
  return new Set(events.map((event) => event.identityId)).size;
}

function withinDays(input: string, now: string, days: number) {
  return Date.parse(input) >= Date.parse(now) - days * 24 * 60 * 60 * 1000;
}

export function evaluateSubToRootPropagation(input: {
  subject: PropagationSubject;
  siblings: PropagationSubject[];
  nextState: IdentityState;
  ruleFamily: string;
  rootSensitive: boolean;
  directRootEvidence?: boolean;
  governanceFreeze?: boolean;
  recentHistory: PropagationHistoryEvent[];
  now?: string;
}): PropagationEvaluation {
  const now = input.now ?? new Date().toISOString();
  const sameScopeSiblings = input.siblings.filter(
    (item) => item.identityId !== input.subject.identityId && item.scope === input.subject.scope,
  );
  const siblingOverlays: PropagationOverlay[] = [];
  const reasonCodes: string[] = [];
  let rootTargetState: IdentityState | null = null;

  if (input.ruleFamily === "scope_class" && [IdentityState.OBSERVED, IdentityState.RESTRICTED, IdentityState.HIGH_RISK].includes(input.nextState)) {
    for (const sibling of sameScopeSiblings) {
      siblingOverlays.push({
        identityId: sibling.identityId,
        overlayState: IdentityState.OBSERVED,
        reason: "Same-scope sibling received an OBSERVED overlay due to scope-class propagation.",
      });
    }
  }

  const observedWindow = input.recentHistory.filter(
    (event) => event.ruleFamily === input.ruleFamily && event.state === IdentityState.OBSERVED && withinDays(event.occurredAt, now, 14),
  );
  const restrictedWindow = input.recentHistory.filter(
    (event) => event.state >= IdentityState.RESTRICTED && withinDays(event.occurredAt, now, 30),
  );
  const highRiskWindow = input.recentHistory.filter(
    (event) => event.state >= IdentityState.HIGH_RISK && withinDays(event.occurredAt, now, 30),
  );
  const frozenWindow = input.recentHistory.filter(
    (event) => event.state === IdentityState.FROZEN && withinDays(event.occurredAt, now, 30),
  );

  if (input.nextState === IdentityState.OBSERVED && distinctIdentityCount(observedWindow) >= 2) {
    rootTargetState = IdentityState.OBSERVED;
    reasonCodes.push("ROOT_OBSERVED_MULTI_SUB");
  }

  if (input.nextState === IdentityState.RESTRICTED && ((input.rootSensitive && input.subject.permissions.canEscalateToRoot) || distinctIdentityCount(restrictedWindow) >= 2)) {
    rootTargetState = IdentityState.RESTRICTED;
    reasonCodes.push("ROOT_RESTRICTED_ESCALATION");
  }

  if (input.nextState === IdentityState.HIGH_RISK && (input.directRootEvidence || (input.rootSensitive && input.subject.permissions.canEscalateToRoot) || distinctIdentityCount(highRiskWindow) >= 2)) {
    rootTargetState = IdentityState.RESTRICTED;
    reasonCodes.push("ROOT_HIGH_RISK_ESCALATION");
  }

  if (input.nextState === IdentityState.FROZEN) {
    if (input.governanceFreeze || distinctIdentityCount(frozenWindow) >= 2) {
      rootTargetState = IdentityState.FROZEN;
      reasonCodes.push("ROOT_FROZEN_ESCALATION");
    } else if (input.directRootEvidence || (input.rootSensitive && input.subject.permissions.canEscalateToRoot)) {
      rootTargetState = IdentityState.HIGH_RISK;
      reasonCodes.push("ROOT_HIGH_RISK_FROM_SUB_FROZEN");
    }
  }

  return {
    rootTargetState,
    siblingOverlays,
    reasonCodes,
  };
}

export function computeEffectiveSubState(input: {
  storedState: IdentityState;
  rootStoredState: IdentityState;
  inheritsRootRestrictions: boolean;
}): IdentityState {
  if (!input.inheritsRootRestrictions) {
    return input.storedState;
  }

  if (input.rootStoredState === IdentityState.FROZEN) {
    return IdentityState.FROZEN;
  }
  if (input.rootStoredState === IdentityState.HIGH_RISK) {
    return input.storedState >= IdentityState.HIGH_RISK ? input.storedState : IdentityState.HIGH_RISK;
  }
  if (input.rootStoredState === IdentityState.RESTRICTED) {
    return input.storedState >= IdentityState.RESTRICTED ? input.storedState : IdentityState.RESTRICTED;
  }
  return input.storedState;
}
