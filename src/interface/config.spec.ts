import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const minimal = { AI_MODEL: 'claude-opus-5', ANTHROPIC_API_KEY: 'sk-secret-123' };

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig(minimal)).toEqual({
      ok: true,
      value: {
        datasetPath: 'data/AutoInsuranceClaims2024.csv',
        provider: 'anthropic',
        model: 'claude-opus-5',
        apiKey: 'sk-secret-123',
        severityCap: 2000,
        highRiskMinComplaints: 3,
        highRiskClaimPremiumRatio: 10,
        scoreTolerance: 15,
        accuracyThreshold: 1,
        maxCases: undefined,
        concurrency: 1,
        timeoutMs: 30000,
        temperature: undefined,
      },
    });
  });

  it('parses every override', () => {
    const r = loadConfig({
      AI_PROVIDER: 'openai',
      AI_MODEL: 'gpt-x',
      OPENAI_API_KEY: 'k',
      DATASET_PATH: 'test/fixtures/valid.csv',
      SEVERITY_CAP: '1500',
      HIGH_RISK_MIN_COMPLAINTS: '2',
      HIGH_RISK_CLAIM_PREMIUM_RATIO: '8.5',
      SCORE_TOLERANCE: '10',
      ACCURACY_THRESHOLD: '0.9',
      MAX_CASES: '5',
      CONCURRENCY: '4',
      AI_TIMEOUT_MS: '1000',
      AI_TEMPERATURE: '0',
    });
    expect(r.ok && r.value).toMatchObject({
      provider: 'openai',
      apiKey: 'k',
      datasetPath: 'test/fixtures/valid.csv',
      severityCap: 1500,
      highRiskMinComplaints: 2,
      highRiskClaimPremiumRatio: 8.5,
      scoreTolerance: 10,
      accuracyThreshold: 0.9,
      maxCases: 5,
      concurrency: 4,
      timeoutMs: 1000,
      temperature: 0,
    });
  });

  it('treats blank values as unset', () => {
    const r = loadConfig({ ...minimal, MAX_CASES: '', AI_TEMPERATURE: ' ' });
    expect(r.ok && [r.value.maxCases, r.value.temperature]).toEqual([undefined, undefined]);
  });

  it('requires the API key of the active provider, naming the variable', () => {
    expect(loadConfig({ AI_MODEL: 'm' })).toEqual({
      ok: false,
      error: ['ANTHROPIC_API_KEY: is required when AI_PROVIDER=anthropic'],
    });
    expect(loadConfig({ AI_MODEL: 'm', AI_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'x' })).toEqual({
      ok: false,
      error: ['OPENAI_API_KEY: is required when AI_PROVIDER=openai'],
    });
  });

  it.each([
    [{ AI_MODEL: undefined }, 'AI_MODEL'],
    [{ AI_PROVIDER: 'gemini' }, 'AI_PROVIDER'],
    [{ ACCURACY_THRESHOLD: '1.5' }, 'ACCURACY_THRESHOLD'],
    [{ CONCURRENCY: '0' }, 'CONCURRENCY'],
    [{ MAX_CASES: 'abc' }, 'MAX_CASES'],
    [{ AI_TEMPERATURE: '3' }, 'AI_TEMPERATURE'],
    [{ SEVERITY_CAP: '-1' }, 'SEVERITY_CAP'],
  ])('rejects %j citing %s', (override, variable) => {
    const r = loadConfig({ ...minimal, ...override });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.join('\n')).toContain(variable);
  });

  it('never echoes secret values in errors', () => {
    const r = loadConfig({ ...minimal, CONCURRENCY: 'x' });
    expect(r.ok ? '' : r.error.join()).not.toContain('sk-secret-123');
  });
});
