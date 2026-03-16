import { keccak256, stringToHex, type Hex } from "viem";
import { type EvidenceType, type TriggerType, type IdentityState } from "./state.js";

export type SignalSeverity = "positive" | "low" | "medium" | "high" | "critical";
export type SignalSourceType = "fixture" | "local_chain" | "manual" | "governance" | "ai";
export type SignalCategory = "positive" | "negative";

export type RiskSignal = {
  signalId: string;
  identityId: Hex;
  sourceType: SignalSourceType;
  sourceId: string;
  type: TriggerType;
  signalType: TriggerType;
  severity: SignalSeverity;
  category: SignalCategory;
  evidenceType: EvidenceType;
  evidenceRef: string;
  observedAt: string;
  ingestedAt: string;
  metadataHash: Hex;
  actor: string;
  timestamp: number;
  policyVersion: number;
  requestedState?: IdentityState;
  reason: string;
  reasonCode: string;
  explanation: string;
};

export type RiskSignalInput = Omit<RiskSignal, "signalId" | "signalType" | "metadataHash" | "ingestedAt" | "timestamp"> & {
  metadataSeed?: string;
  ingestedAt?: string;
  timestamp?: number;
};

export function createRiskSignal(input: RiskSignalInput): RiskSignal {
  const ingestedAt = input.ingestedAt ?? new Date().toISOString();
  const signalType = input.type;
  const metadataHash = keccak256(
    stringToHex(
      [
        input.identityId,
        input.sourceType,
        input.sourceId,
        signalType,
        input.reasonCode,
        input.metadataSeed ?? input.evidenceRef,
      ].join(":"),
    ),
  );

  return {
    ...input,
    signalId: metadataHash,
    signalType,
    metadataHash,
    ingestedAt,
    timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
  };
}
