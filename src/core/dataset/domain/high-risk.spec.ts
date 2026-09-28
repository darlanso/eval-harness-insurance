import { describe, expect, it } from 'vitest';
import { deriveHighRisk } from './high-risk.js';

describe('deriveHighRisk', () => {
  it.each([
    { complaints: 3, claim: 380.9, premium: 93, expected: true, why: 'complaints at limit' },
    { complaints: 0, claim: 1100, premium: 100, expected: true, why: 'ratio 11' },
    { complaints: 0, claim: 1000, premium: 100, expected: false, why: 'ratio exactly 10' },
    { complaints: 2, claim: 500, premium: 100, expected: false, why: 'complaints 2, ratio 5' },
    { complaints: 0, claim: 1098.36, premium: 153, expected: false, why: 'AE98193' },
  ])('$why -> $expected', ({ complaints, claim, premium, expected }) => {
    expect(deriveHighRisk(complaints, claim, premium)).toBe(expected);
  });

  it('honours custom limits', () => {
    expect(deriveHighRisk(2, 500, 100, { minOpenComplaints: 2, maxClaimPremiumRatio: 10 })).toBe(true);
    expect(deriveHighRisk(0, 600, 100, { minOpenComplaints: 3, maxClaimPremiumRatio: 5 })).toBe(true);
  });
});
