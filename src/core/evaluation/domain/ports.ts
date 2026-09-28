import type { Result } from '#shared/result.js';
import type { AiAssessment } from './ai-assessment.js';
import type { CaseSourceError, ClaimFacts, EvaluationCase } from './evaluation-case.js';
import type { AssessorFailure } from './failure-reason.js';

/** Port: origem dos casos a avaliar. Pode lançar erro fatal quando a carga é inviável. */
export interface CaseSource {
  cases(): AsyncIterable<Result<EvaluationCase, CaseSourceError>>;
}

/** Port: agente de IA sob teste, independente de provedor. Nunca deve lançar. */
export interface ClaimAssessor {
  assess(facts: ClaimFacts, signal: AbortSignal): Promise<Result<AiAssessment, AssessorFailure>>;
}
