import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from '#shared/result.js';
import { sampleInput } from '../../../../test/support/sample-claim-input.js';
import { LoadGoldenDataset } from '../../dataset/application/load-golden-dataset.js';
import type { DatasetError } from '../../dataset/domain/dataset-error.js';
import type { GoldenCase } from '../../dataset/domain/golden-case.js';
import type { CaseSourceError, EvaluationCase } from '../domain/evaluation-case.js';
import { DatasetCaseSource, toEvaluationCase } from './dataset-case-source.js';

const golden: GoldenCase = {
  id: 'QC35222',
  line: 2,
  input: sampleInput(),
  expected: { isHighRisk: true, claimAmount: 380.9 },
};

describe('toEvaluationCase', () => {
  it('keeps id and answer key apart from the facts sent to the AI', () => {
    const c = toEvaluationCase(golden);
    expect(c.id).toBe('QC35222');
    expect(c.expected).toEqual({ isHighRisk: true, claimAmount: 380.9 });
    expect(c.facts).toEqual({ ...sampleInput() });
    expect(c.facts).not.toHaveProperty('id');
    expect(c.facts).not.toHaveProperty('isHighRisk');
  });
});

describe('DatasetCaseSource', () => {
  it('translates cases and forwards row errors in order', async () => {
    const items: Result<GoldenCase, DatasetError>[] = [ok(golden), err({ line: 3, reason: 'bad' })];
    const source = new DatasetCaseSource(new LoadGoldenDataset({ read: async function* () { yield* items; } }));
    const out: Result<EvaluationCase, CaseSourceError>[] = [];
    for await (const r of source.cases()) out.push(r);
    expect(out).toEqual([ok(toEvaluationCase(golden)), err({ line: 3, reason: 'bad' })]);
  });
});
