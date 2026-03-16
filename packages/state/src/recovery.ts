export type RecoveryRule = {
  ruleId: string;
  appliesTo: string[];
  requiredCooldown: number;
  requiredManualReview: boolean;
  requiredPositiveSignals: string[];
  requiredNoFurtherRiskDays: number;
};

export const DEFAULT_RECOVERY_RULES: Record<string, RecoveryRule> = {
  warning_recovery: {
    ruleId: "warning_recovery",
    appliesTo: ["warn"],
    requiredCooldown: 1,
    requiredManualReview: false,
    requiredPositiveSignals: ["long_term_good_standing"],
    requiredNoFurtherRiskDays: 1,
  },
  restricted_recovery: {
    ruleId: "restricted_recovery",
    appliesTo: ["limit", "review_required"],
    requiredCooldown: 7,
    requiredManualReview: true,
    requiredPositiveSignals: ["trusted_protocol_usage", "repeated_governance_participation"],
    requiredNoFurtherRiskDays: 7,
  },
  freeze_recovery: {
    ruleId: "freeze_recovery",
    appliesTo: ["freeze"],
    requiredCooldown: 30,
    requiredManualReview: true,
    requiredPositiveSignals: ["long_term_good_standing"],
    requiredNoFurtherRiskDays: 30,
  },
};
