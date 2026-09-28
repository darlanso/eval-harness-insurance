import { describe, expect, it } from 'vitest';
import type { ClaimStatus } from '../ai-assessment.js';
import { checkHighRiskBlock } from './high-risk-block.js';
import { realSeverity } from './real-severity.js';
import { checkScoreDeviation } from './score-deviation.js';

describe('realSeverity', () => {
  it.each([
    { claim: 1098.36, cap: 2000, expected: 55 },
    { claim: 380.9, cap: 2000, expected: 19 },
    { claim: 3905.87, cap: 2000, expected: 100 },
    { claim: 2000, cap: 2000, expected: 100 },
    { claim: 0.13, cap: 2000, expected: 0 },
    { claim: 500, cap: 1000, expected: 50 },
  ])('$claim / cap $cap -> $expected', ({ claim, cap, expected }) => {
    expect(realSeverity(claim, cap)).toBe(expected);
  });

  it('uses 2000 as the default cap', () => {
    expect(realSeverity(1000)).toBe(50);
  });
});

describe('checkHighRiskBlock', () => {
  it.each<{ isHighRisk: boolean; claimStatus: ClaimStatus; expected: string | null }>([
    { isHighRisk: true, claimStatus: 'APPROVED', expected: 'CRITICAL_FALSE_NEGATIVE' },
    { isHighRisk: true, claimStatus: 'MANUAL_REVIEW', expected: null },
    { isHighRisk: true, claimStatus: 'DENIED', expected: null },
    { isHighRisk: false, claimStatus: 'APPROVED', expected: null },
    { isHighRisk: false, claimStatus: 'DENIED', expected: null },
  ])('highRisk=$isHighRisk status=$claimStatus -> $expected', ({ isHighRisk, claimStatus, expected }) => {
    expect(checkHighRiskBlock({ isHighRisk, claimAmount: 1 }, { claimStatus, fraudRiskScore: 50 })).toBe(expected);
  });
});

describe('checkScoreDeviation', () => {
  it.each([
    { severity: 55, score: 40, expected: null, why: 'deviation equals tolerance' },
    { severity: 55, score: 70, expected: null, why: 'deviation equals tolerance (above)' },
    { severity: 55, score: 39, expected: 'SCORE_DEVIATION', why: 'deviation 16' },
    { severity: 55, score: 71, expected: 'SCORE_DEVIATION', why: 'deviation 16 (above)' },
    { severity: 55, score: 55, expected: null, why: 'exact match' },
  ])('$why', ({ severity, score, expected }) => {
    expect(checkScoreDeviation(severity, score)).toBe(expected);
  });

  it('honours a custom tolerance', () => {
    expect(checkScoreDeviation(55, 50, 4)).toBe('SCORE_DEVIATION');
    expect(checkScoreDeviation(55, 51, 4)).toBeNull();
  });
});
