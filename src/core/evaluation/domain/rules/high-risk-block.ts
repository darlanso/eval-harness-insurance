import type { AiAssessment } from '../ai-assessment.js';
import type { EvaluationExpectation } from '../evaluation-case.js';
import type { FailureReason } from '../failure-reason.js';

/** Regra 1: aprovar um caso de alto risco é Falso Negativo Crítico. */
export const checkHighRiskBlock = (
  expected: EvaluationExpectation,
  assessment: AiAssessment,
): FailureReason | null =>
  expected.isHighRisk && assessment.claimStatus === 'APPROVED' ? 'CRITICAL_FALSE_NEGATIVE' : null;
