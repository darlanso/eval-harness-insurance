import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '#shared/result.js';
import { sampleInput } from '../../../../test/support/sample-claim-input.js';
import { createGoldenCase } from './golden-case.js';
import { DEFAULT_HIGH_RISK_LIMITS } from './high-risk.js';

describe('createGoldenCase', () => {
  it('builds a case with derived expected outcome', () => {
    const r = createGoldenCase('QC35222', 2, sampleInput(), DEFAULT_HIGH_RISK_LIMITS);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.expected).toEqual({ isHighRisk: true, claimAmount: 380.9 });
    expect(r.value.input).not.toHaveProperty('isHighRisk');
    expect(r.value.input).not.toHaveProperty('id');
  });

  it.each([
    { id: '', input: sampleInput(), reason: 'customer id is empty' },
    { id: 'X', input: sampleInput({ claimAmount: 0 }), reason: 'claim amount must be > 0' },
    { id: 'X', input: sampleInput({ monthlyPremium: 0 }), reason: 'monthly premium must be > 0' },
    { id: 'X', input: sampleInput({ openComplaints: -1 }), reason: 'open complaints must be >= 0' },
    { id: 'X', input: sampleInput({ claimAmount: Number.NaN }), reason: 'claim amount must be > 0' },
  ])('rejects invalid invariants: $reason', ({ id, input, reason }) => {
    const r = createGoldenCase(id, 7, input, DEFAULT_HIGH_RISK_LIMITS);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toEqual({ line: 7, reason });
  });
});
