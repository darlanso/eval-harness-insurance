export type HighRiskLimits = {
  readonly minOpenComplaints: number;
  readonly maxClaimPremiumRatio: number;
};

export const DEFAULT_HIGH_RISK_LIMITS: HighRiskLimits = {
  minOpenComplaints: 3,
  maxClaimPremiumRatio: 10,
};

export const deriveHighRisk = (
  openComplaints: number,
  claimAmount: number,
  monthlyPremium: number,
  limits: HighRiskLimits = DEFAULT_HIGH_RISK_LIMITS,
): boolean =>
  openComplaints >= limits.minOpenComplaints || claimAmount / monthlyPremium > limits.maxClaimPremiumRatio;
