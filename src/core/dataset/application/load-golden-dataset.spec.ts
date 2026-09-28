import { describe, expect, it } from 'vitest';
import { err, isOk, ok, type Result } from '#shared/result.js';
import { sampleInput } from '../../../../test/support/sample-claim-input.js';
import { FatalDatasetError, type DatasetError } from '../domain/dataset-error.js';
import type { GoldenCaseReader } from '../domain/golden-case-reader.js';
import type { GoldenCase } from '../domain/golden-case.js';
import { LoadGoldenDataset } from './load-golden-dataset.js';

const golden = (id: string, line: number): GoldenCase => ({
  id,
  line,
  input: sampleInput(),
  expected: { isHighRisk: false, claimAmount: 380.9 },
});

const fakeReader = (items: Result<GoldenCase, DatasetError>[], fatal?: Error): GoldenCaseReader => ({
  async *read() {
    if (fatal) throw fatal;
    yield* items;
  },
});

describe('LoadGoldenDataset', () => {
  it('yields cases and row errors in reader order', async () => {
    const items = [ok(golden('A', 2)), err({ line: 3, reason: 'bad' }), ok(golden('C', 4))];
    const out: Result<GoldenCase, DatasetError>[] = [];
    for await (const r of new LoadGoldenDataset(fakeReader(items)).execute()) out.push(r);
    expect(out).toEqual(items);
    expect(out.filter(isOk).map((r) => r.value.id)).toEqual(['A', 'C']);
  });

  it('propagates fatal dataset errors', async () => {
    const useCase = new LoadGoldenDataset(fakeReader([], new FatalDatasetError('missing required columns: X')));
    await expect(async () => {
      for await (const _ of useCase.execute()) void _;
    }).rejects.toThrow(FatalDatasetError);
  });
});
