export type FailureReason = 'CRITICAL_FALSE_NEGATIVE' | 'SCORE_DEVIATION' | 'CONTRACT_VIOLATION' | 'RUNTIME_ERROR';

export const FAILURE_REASONS: readonly FailureReason[] = [
  'CRITICAL_FALSE_NEGATIVE',
  'SCORE_DEVIATION',
  'CONTRACT_VIOLATION',
  'RUNTIME_ERROR',
];

export type AssessorFailure = {
  readonly kind: 'CONTRACT_VIOLATION' | 'RUNTIME_ERROR';
  readonly detail: string;
};
