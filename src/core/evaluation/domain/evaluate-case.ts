import type { Result } from '#shared/result.js';
import type { AiAssessment } from './ai-assessment.js';
import type { EvaluationCase } from './evaluation-case.js';
import type { AssessorFailure, FailureReason } from './failure-reason.js';
import { checkHighRiskBlock } from './rules/high-risk-block.js';
import { DEFAULT_SEVERITY_CAP, realSeverity } from './rules/real-severity.js';
import { checkScoreDeviation, DEFAULT_SCORE_TOLERANCE } from './rules/score-deviation.js';

export type EvaluationPolicy = {
  readonly severityCap: number;
  readonly scoreTolerance: number;
};

export const DEFAULT_EVALUATION_POLICY: EvaluationPolicy = {
  severityCap: DEFAULT_SEVERITY_CAP,
  scoreTolerance: DEFAULT_SCORE_TOLERANCE,
};

export type CaseResult = {
  readonly caseId: string;
  readonly passed: boolean;
  readonly reasons: readonly FailureReason[];
  readonly realSeverity: number;
  readonly assessment: AiAssessment | null;
  readonly detail: string | null;
};

/** Aplica todas as regras a um caso e reúne todos os motivos de falha. */
export const evaluateCase = (
  evaluationCase: EvaluationCase,
  outcome: Result<AiAssessment, AssessorFailure>,
  policy: EvaluationPolicy = DEFAULT_EVALUATION_POLICY,
): CaseResult => {
  const severity = realSeverity(evaluationCase.expected.claimAmount, policy.severityCap);

  if (!outcome.ok) {
    return {
      caseId: evaluationCase.id,
      passed: false,
      reasons: [outcome.error.kind],
      realSeverity: severity,
      assessment: null,
      detail: outcome.error.detail,
    };
  }

  const reasons = [
    checkHighRiskBlock(evaluationCase.expected, outcome.value),
    checkScoreDeviation(severity, outcome.value.fraudRiskScore, policy.scoreTolerance),
  ].filter((reason): reason is FailureReason => reason !== null);

  return {
    caseId: evaluationCase.id,
    passed: reasons.length === 0,
    reasons,
    realSeverity: severity,
    assessment: outcome.value,
    detail: null,
  };
};
