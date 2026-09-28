import type { FailureReason } from '../failure-reason.js';

export const DEFAULT_SCORE_TOLERANCE = 15;

/** Regra 2: o score da IA não pode se afastar da severidade real além da tolerância. */
export const checkScoreDeviation = (
  severity: number,
  fraudRiskScore: number,
  tolerance: number = DEFAULT_SCORE_TOLERANCE,
): FailureReason | null => (Math.abs(fraudRiskScore - severity) > tolerance ? 'SCORE_DEVIATION' : null);
