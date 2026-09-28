import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '#shared/result.js';
import { parseAssessment, stripCodeFence } from './ai-assessment-schema.js';

describe('parseAssessment', () => {
  it('accepts a valid response and strips extra fields', () => {
    const r = parseAssessment('{"claimStatus":"DENIED","fraudRiskScore":80,"reasoning":"..."}');
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toEqual({ claimStatus: 'DENIED', fraudRiskScore: 80 });
  });

  it('accepts JSON wrapped in a ```json fence', () => {
    const r = parseAssessment('```json\n{"claimStatus":"MANUAL_REVIEW","fraudRiskScore":0}\n```');
    expect(isOk(r) && r.value.claimStatus).toBe('MANUAL_REVIEW');
  });

  it.each([
    ['not json at all', 'not valid JSON'],
    ['{"claimStatus":"PENDING","fraudRiskScore":50}', 'claimStatus'],
    ['{"claimStatus":"APPROVED","fraudRiskScore":120}', 'fraudRiskScore'],
    ['{"claimStatus":"APPROVED","fraudRiskScore":55.5}', 'fraudRiskScore'],
    ['{"claimStatus":"APPROVED","fraudRiskScore":-1}', 'fraudRiskScore'],
    ['{"claimStatus":"APPROVED"}', 'fraudRiskScore'],
    ['{"claimStatus":"APPROVED","fraudRiskScore":"50"}', 'fraudRiskScore'],
    ['[1,2]', '(root)'],
    ['null', '(root)'],
  ])('rejects %s as CONTRACT_VIOLATION', (text, mention) => {
    const r = parseAssessment(text);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.kind).toBe('CONTRACT_VIOLATION');
      expect(r.error.detail).toContain(mention);
    }
  });
});

describe('stripCodeFence', () => {
  it.each([
    ['```json\n{"a":1}\n```', '{"a":1}'],
    ['```\n{"a":1}\n```', '{"a":1}'],
    ['  {"a":1}  ', '{"a":1}'],
  ])('%j -> %j', (input, expected) => {
    expect(stripCodeFence(input)).toBe(expected);
  });
});
