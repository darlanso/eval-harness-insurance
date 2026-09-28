import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from '#shared/result.js';
import type { AiAssessment } from '../core/evaluation/domain/ai-assessment.js';
import type { AssessorFailure } from '../core/evaluation/domain/failure-reason.js';
import type { ClaimAssessor } from '../core/evaluation/domain/ports.js';
import { defaultDeps, main, type RunnerDeps } from './runner.js';

const fixture = (name: string) => fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url));

type Reply = Result<AiAssessment, AssessorFailure>;

/**
 * Assessor fake que "acerta" o gabarito: MANUAL_REVIEW para alto risco
 * e score igual à severidade real (cap 2000), o que passa em todas as regras.
 */
const perfect = (): Reply => ok({ claimStatus: 'MANUAL_REVIEW', fraudRiskScore: 0 });
const perfectAssessor: ClaimAssessor = {
  assess: async (facts) =>
    ok({
      claimStatus: 'MANUAL_REVIEW',
      fraudRiskScore: Math.round((Math.min(Number(facts['claimAmount']), 2000) / 2000) * 100),
    }),
};

const harness = (assessor: ClaimAssessor) => {
  const out: string[] = [];
  const errOut: string[] = [];
  const created: string[] = [];
  const deps: RunnerDeps = {
    ...defaultDeps,
    makeAssessor: (config, systemPrompt) => {
      created.push(`${config.provider}:${config.model}:${systemPrompt.length > 0}`);
      return assessor;
    },
    out: (t) => out.push(t),
    errOut: (t) => errOut.push(t),
  };
  return { deps, out, errOut, created };
};

const env = (overrides: Record<string, string> = {}) => ({
  AI_MODEL: 'claude-opus-5',
  ANTHROPIC_API_KEY: 'sk-secret-xyz',
  DATASET_PATH: fixture('valid.csv'),
  ...overrides,
});

describe('runner main', () => {
  it('exits 0 when every case passes with the default threshold', async () => {
    const h = harness(perfectAssessor);
    expect(await main(env(), h.deps)).toBe(0);
    expect(h.out.join()).toContain('Evaluated:      5');
    expect(h.out.join()).toContain('Result:         PASS');
    expect(h.created).toEqual(['anthropic:claude-opus-5:true']);
  });

  it('exits 1 when a single case fails with CONTRACT_VIOLATION', async () => {
    let calls = 0;
    const h = harness({
      assess: async (facts, signal) =>
        ++calls === 2 ? err({ kind: 'CONTRACT_VIOLATION', detail: 'bad json' }) : perfectAssessor.assess(facts, signal),
    });
    expect(await main(env(), h.deps)).toBe(1);
    expect(h.out.join()).toContain('CONTRACT_VIOLATION      1');
  });

  it('exits 0 when accuracy meets a relaxed threshold', async () => {
    let calls = 0;
    const h = harness({
      assess: async (facts, signal) =>
        ++calls === 1 ? err({ kind: 'RUNTIME_ERROR', detail: 'down' }) : perfectAssessor.assess(facts, signal),
    });
    expect(await main(env({ ACCURACY_THRESHOLD: '0.8' }), h.deps)).toBe(0);
  });

  it('exits 0 when an invalid row is only reported', async () => {
    const h = harness(perfectAssessor);
    expect(await main(env({ DATASET_PATH: fixture('invalid-rows.csv') }), h.deps)).toBe(0);
    const report = h.out.join('\n');
    expect(report).toContain('Evaluated:      1');
    expect(report).toContain('Dataset errors: 4');
    expect(report).toContain('line 2: monthly premium must be > 0');
  });

  it('exits 1 with a dataset error when the CSV does not exist', async () => {
    const h = harness(perfectAssessor);
    expect(await main(env({ DATASET_PATH: fixture('nope.csv') }), h.deps)).toBe(1);
    expect(h.errOut.join()).toMatch(/^Dataset error: cannot read dataset/);
  });

  it('exits 1 with a dataset error when a required column is missing', async () => {
    const h = harness(perfectAssessor);
    expect(await main(env({ DATASET_PATH: fixture('missing-columns.csv') }), h.deps)).toBe(1);
    expect(h.errOut.join()).toContain('Total Claim Amount');
  });

  it('exits 1 on invalid configuration without calling the AI', async () => {
    const h = harness(perfectAssessor);
    const { ANTHROPIC_API_KEY: _, ...noKey } = env();
    expect(await main(noKey, h.deps)).toBe(1);
    expect(h.created).toEqual([]);
    expect(h.errOut.join()).toContain('ANTHROPIC_API_KEY');
  });

  it('honours MAX_CASES', async () => {
    const h = harness(perfectAssessor);
    await main(env({ MAX_CASES: '2' }), h.deps);
    expect(h.out.join()).toContain('Evaluated:      2');
  });

  it('never prints the API key', async () => {
    const h = harness({ assess: async () => perfect() });
    await main(env(), h.deps);
    expect([...h.out, ...h.errOut].join()).not.toContain('sk-secret-xyz');
  });
});
