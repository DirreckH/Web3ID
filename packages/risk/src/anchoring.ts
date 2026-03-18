import { IdentityState } from "../../state/src/index.js";
import { SubIdentityType } from "../../identity/src/index.js";
import { keccak256, padHex, stringToHex, type Hex } from "viem";
import type { AnchorQueueEntry, IdentityRecordKind } from "./types.js";

export function computeEvidenceBundleHash(evidenceRefs: string[]) {
  return keccak256(stringToHex([...new Set(evidenceRefs)].sort().join("|")));
}

export function computeStateHash(input: {
  identityId: Hex;
  storedState: IdentityState;
  effectiveState: IdentityState;
  reasonCode: string;
  policyVersion: number;
  registryVersion: number;
  decisionId?: string;
  anchorSeq: number;
}) {
  return keccak256(
    stringToHex([
      input.identityId,
      String(input.storedState),
      String(input.effectiveState),
      input.reasonCode,
      String(input.policyVersion),
      String(input.registryVersion),
      input.decisionId ?? "",
      String(input.anchorSeq),
    ].join(":")),
  );
}

export function shouldAnchorState(input: {
  kind: IdentityRecordKind;
  subType?: SubIdentityType;
  previousAnchoredState?: IdentityState;
  storedState: IdentityState;
  effectiveState: IdentityState;
  isManualOrGovernance: boolean;
}): boolean {
  if (input.isManualOrGovernance) {
    return true;
  }
  if (input.effectiveState === IdentityState.OBSERVED) {
    return false;
  }
  if (input.kind === "root") {
    return input.effectiveState >= IdentityState.RESTRICTED;
  }
  const complianceRelevant = input.subType === SubIdentityType.RWA_INVEST || input.subType === SubIdentityType.PAYMENTS;
  if (complianceRelevant && input.effectiveState >= IdentityState.RESTRICTED) {
    return true;
  }
  if (
    input.previousAnchoredState !== undefined &&
    input.previousAnchoredState >= IdentityState.RESTRICTED &&
    input.effectiveState === IdentityState.NORMAL
  ) {
    return true;
  }
  return false;
}

export function createAnchorQueueEntry(input: {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  storedState: IdentityState;
  effectiveState: IdentityState;
  reasonCode: string;
  policyVersion: number;
  registryVersion: number;
  decisionId?: string;
  evidenceRefs: string[];
  anchorSeq: number;
  shouldMaterializeState: boolean;
}): AnchorQueueEntry {
  const evidenceBundleHash = computeEvidenceBundleHash(input.evidenceRefs);
  return {
    anchorId: keccak256(stringToHex([input.identityId, String(input.anchorSeq), input.reasonCode].join(":"))),
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    storedState: input.storedState,
    effectiveState: input.effectiveState,
    stateHash: computeStateHash(input),
    evidenceBundleHash,
    reasonCode: padHex(stringToHex(input.reasonCode.slice(0, 31) || "STATE"), { size: 32 }),
    policyVersion: input.policyVersion,
    registryVersion: input.registryVersion,
    anchorSeq: input.anchorSeq,
    queuedAt: new Date().toISOString(),
    status: "PENDING",
    shouldMaterializeState: input.shouldMaterializeState,
  };
}
