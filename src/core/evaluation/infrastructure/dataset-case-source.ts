import type { Result } from '#shared/result.js';
import type { LoadGoldenDataset } from '../../dataset/application/load-golden-dataset.js';
import type { GoldenCase } from '../../dataset/domain/golden-case.js';
import type { CaseSourceError, EvaluationCase } from '../domain/evaluation-case.js';
import type { CaseSource } from '../domain/ports.js';

/** ACL entre contextos: GoldenCase (dataset) → EvaluationCase (evaluation). */
export const toEvaluationCase = (golden: GoldenCase): EvaluationCase => ({
  id: golden.id,
  facts: { ...golden.input },
  expected: { isHighRisk: golden.expected.isHighRisk, claimAmount: golden.expected.claimAmount },
});

export class DatasetCaseSource implements CaseSource {
  readonly #loader: LoadGoldenDataset;

  constructor(loader: LoadGoldenDataset) {
    this.#loader = loader;
  }

  async *cases(): AsyncIterable<Result<EvaluationCase, CaseSourceError>> {
    for await (const item of this.#loader.execute()) {
      yield item.ok ? { ok: true, value: toEvaluationCase(item.value) } : item;
    }
  }
}
