import { describe, expect, it } from 'vitest';
import type { CaseResult } from './evaluate-case.js';
import { HarnessRun } from './harness-run.js';

const result = (passed: boolean, reasons: CaseResult['reasons'] = passed ? [] : ['SCORE_DEVIATION']): CaseResult => ({
  caseId: 'X',
  passed,
  reasons,
  realSeverity: 0,
  assessment: null,
  detail: null,
});

describe('HarnessRun', () => {
  it('computes accuracy over evaluated cases', () => {
    const run = new HarnessRun();
    for (let i = 0; i < 9; i++) run.record(result(true));
    run.record(result(false, ['CONTRACT_VIOLATION']));
    expect(run.evaluated).toBe(10);
    expect(run.passedCount).toBe(9);
    expect(run.accuracy()).toBe(0.9);
    expect(run.passed(1)).toBe(false);
    expect(run.passed(0.9)).toBe(true);
  });

  it('fails an empty batch regardless of threshold', () => {
    const run = new HarnessRun();
    expect(run.accuracy()).toBe(0);
    expect(run.passed(0)).toBe(false);
  });

  it('ignores dataset row errors for accuracy and outcome', () => {
    const run = new HarnessRun();
    run.record(result(true));
    run.recordDatasetError({ line: 7, reason: 'bad' });
    expect(run.datasetErrors).toEqual([{ line: 7, reason: 'bad' }]);
    expect(run.accuracy()).toBe(1);
    expect(run.passed(1)).toBe(true);
  });

  it('counts failures by reason, including multi-reason cases', () => {
    const run = new HarnessRun();
    run.record(result(false, ['CRITICAL_FALSE_NEGATIVE', 'SCORE_DEVIATION']));
    run.record(result(false, ['RUNTIME_ERROR']));
    run.record(result(true));
    expect(run.failuresByReason()).toEqual({
      CRITICAL_FALSE_NEGATIVE: 1,
      SCORE_DEVIATION: 1,
      CONTRACT_VIOLATION: 0,
      RUNTIME_ERROR: 1,
    });
    expect(run.results).toHaveLength(3);
  });
});
