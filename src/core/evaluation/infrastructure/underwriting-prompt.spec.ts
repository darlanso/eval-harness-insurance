import { describe, expect, it } from 'vitest';
import { isOk } from '#shared/result.js';
import { sampleInput } from '../../../../test/support/sample-claim-input.js';
import { createGoldenCase } from '../../dataset/domain/golden-case.js';
import { DEFAULT_HIGH_RISK_LIMITS } from '../../dataset/domain/high-risk.js';
import { toEvaluationCase } from './dataset-case-source.js';
import { buildUserMessage, loadSystemPrompt } from './underwriting-prompt.js';

describe('underwriting prompt', () => {
  it('loads the versioned system prompt describing the response contract', () => {
    const prompt = loadSystemPrompt();
    for (const token of ['claimStatus', 'fraudRiskScore', 'APPROVED', 'DENIED', 'MANUAL_REVIEW']) {
      expect(prompt).toContain(token);
    }
  });

  it('builds a user message that carries no answer key and no customer id', () => {
    const golden = createGoldenCase('QC35222', 2, sampleInput(), DEFAULT_HIGH_RISK_LIMITS);
    if (!isOk(golden)) throw new Error('expected ok');
    const message = buildUserMessage(toEvaluationCase(golden.value).facts);
    expect(message).toContain('"claimAmount": 380.9');
    for (const leaked of ['isHighRisk', 'expected', 'QC35222', 'Response', 'realSeverity']) {
      expect(message).not.toContain(leaked);
    }
  });
});
