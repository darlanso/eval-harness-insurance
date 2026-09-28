import { describe, expect, it } from 'vitest';
import { err, ok } from '#shared/result.js';
import type { EvaluationCase } from './evaluation-case.js';
import { DEFAULT_EVALUATION_POLICY, evaluateCase } from './evaluate-case.js';

const makeCase = (isHighRisk: boolean, claimAmount = 1098.36): EvaluationCase => ({
  id: 'C1',
  facts: { claimAmount },
  expected: { isHighRisk, claimAmount },
});

describe('evaluateCase', () => {
  it('passes when every rule is satisfied', () => {
    const r = evaluateCase(makeCase(false), ok({ claimStatus: 'APPROVED', fraudRiskScore: 55 }));
    expect(r).toMatchObject({ caseId: 'C1', passed: true, reasons: [], realSeverity: 55, detail: null });
  });

  it('reports every applicable reason', () => {
    const r = evaluateCase(makeCase(true), ok({ claimStatus: 'APPROVED', fraudRiskScore: 95 }));
    expect(r.passed).toBe(false);
    expect(r.reasons).toEqual(['CRITICAL_FALSE_NEGATIVE', 'SCORE_DEVIATION']);
  });

  it('fails only on score deviation when status is safe', () => {
    const r = evaluateCase(makeCase(true), ok({ claimStatus: 'MANUAL_REVIEW', fraudRiskScore: 39 }));
    expect(r.reasons).toEqual(['SCORE_DEVIATION']);
  });

  it.each(['CONTRACT_VIOLATION', 'RUNTIME_ERROR'] as const)('turns %s into a failed case', (kind) => {
    const r = evaluateCase(makeCase(false), err({ kind, detail: 'boom' }));
    expect(r).toMatchObject({ passed: false, reasons: [kind], assessment: null, detail: 'boom' });
  });

  it('applies a custom policy', () => {
    const r = evaluateCase(makeCase(false, 500), ok({ claimStatus: 'DENIED', fraudRiskScore: 50 }), {
      ...DEFAULT_EVALUATION_POLICY,
      severityCap: 1000,
      scoreTolerance: 0,
    });
    expect(r).toMatchObject({ passed: true, realSeverity: 50 });
  });
});
