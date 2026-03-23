export type RegulatoryStatus = "NORMAL" | "OBSERVED" | "RESTRICTED" | "HIGH_RISK" | "FROZEN";

export type RiskSignalSource = "onchain" | "sanctions" | "governance" | "advisor";

export type RiskSignalSeverity = "low" | "medium" | "high";

export type RegulatoryConsequenceType = "restriction" | "freeze" | "review" | "trustAdjustment" | "restore";

export interface RiskSignal {
  id: string;
  source: RiskSignalSource;
  title: string;
  detail: string;
  severity: RiskSignalSeverity;
  timestamp: string;
}

export interface RegulatoryEvent {
  id: string;
  from: RegulatoryStatus;
  to: RegulatoryStatus;
  reason: string;
  timestamp: string;
  actor: string;
}

export interface RegulatoryConsequence {
  id: string;
  type: RegulatoryConsequenceType;
  title: string;
  detail: string;
  active: boolean;
}

export interface IdentityLaneState {
  id: string;
  name: string;
  description: string;
  status: RegulatoryStatus;
  summary: string;
  trustScore: number;
  riskSignals: RiskSignal[];
  evaluation: string;
  stateTransitions: RegulatoryEvent[];
  consequences: RegulatoryConsequence[];
  recovery: string;
}

const REGULATORY_STATUS_PRIORITY: Record<RegulatoryStatus, number> = {
  NORMAL: 0,
  OBSERVED: 1,
  RESTRICTED: 2,
  HIGH_RISK: 3,
  FROZEN: 4,
};

export function getHighestRegulatoryStatus(statuses: RegulatoryStatus[]) {
  return statuses.reduce<RegulatoryStatus>((highest, current) => {
    if (REGULATORY_STATUS_PRIORITY[current] > REGULATORY_STATUS_PRIORITY[highest]) {
      return current;
    }

    return highest;
  }, "NORMAL");
}
