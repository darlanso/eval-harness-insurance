export const CLAIM_STATUSES = ['APPROVED', 'DENIED', 'MANUAL_REVIEW'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type AiAssessment = {
  readonly claimStatus: ClaimStatus;
  readonly fraudRiskScore: number;
};
