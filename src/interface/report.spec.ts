import { describe, expect, it } from 'vitest';
import type { CaseResult } from '../core/evaluation/domain/evaluate-case.js';
import { HarnessRun } from '../core/evaluation/domain/harness-run.js';
import { formatReport } from './report.js';

const result = (caseId: string, overrides: Partial<CaseResult> = {}): CaseResult => ({
  caseId,
  passed: true,
  reasons: [],
  realSeverity: 55,
  assessment: { claimStatus: 'DENIED', fraudRiskScore: 55 },
  detail: null,
  ...overrides,
});

describe('formatReport', () => {
  it('renders totals, failures by reason, failed cases and dataset errors', () => {
    const run = new HarnessRun();
    run.record(result('A'));
    run.record(result('B', { passed: false, reasons: ['SCORE_DEVIATION'], assessment: { claimStatus: 'DENIED', fraudRiskScore: 20 } }));
    run.record(result('C', { passed: false, reasons: ['SCORE_DEVIATION'], assessment: { claimStatus: 'DENIED', fraudRiskScore: 90 } }));
    run.record(result('D', { passed: false, reasons: ['CONTRACT_VIOLATION'], assessment: null, detail: 'response is not valid JSON' }));
    run.recordDatasetError({ line: 7, reason: 'monthly premium must be > 0' });

    expect(formatReport(run, 1)).toBe(
      [
        '== Eval Harness Report ==',
        'Evaluated:      4',
        'Passed:         1',
        'Failed:         3',
        '  CRITICAL_FALSE_NEGATIVE 0',
        '  SCORE_DEVIATION         2',
        '  CONTRACT_VIOLATION      1',
        '  RUNTIME_ERROR           0',
        'Dataset errors: 1',
        'Accuracy:       25.00% (threshold 100.00%)',
        'Result:         FAIL',
        '',
        '-- Failed cases --',
        'B: SCORE_DEVIATION severity=55 status=DENIED score=20',
        'C: SCORE_DEVIATION severity=55 status=DENIED score=90',
        'D: CONTRACT_VIOLATION severity=55 detail="response is not valid JSON"',
        '',
        '-- Dataset errors --',
        'line 7: monthly premium must be > 0',
      ].join('\n'),
    );
  });

  it('reports a passing run without failure sections', () => {
    const run = new HarnessRun();
    run.record(result('A'));
    const text = formatReport(run, 0.9);
    expect(text).toContain('Result:         PASS');
    expect(text).not.toContain('-- Failed cases --');
  });

  it('flags an empty run', () => {
    expect(formatReport(new HarnessRun(), 1)).toContain('Result:         FAIL (no cases evaluated)');
  });
});
