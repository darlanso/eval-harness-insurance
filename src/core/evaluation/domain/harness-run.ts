import type { CaseResult } from './evaluate-case.js';
import type { CaseSourceError } from './evaluation-case.js';
import { FAILURE_REASONS, type FailureReason } from './failure-reason.js';

/** Agregado: resultado de uma execução do harness. */
export class HarnessRun {
  readonly #results: CaseResult[] = [];
  readonly #datasetErrors: CaseSourceError[] = [];

  record(result: CaseResult): void {
    this.#results.push(result);
  }

  recordDatasetError(error: CaseSourceError): void {
    this.#datasetErrors.push(error);
  }

  get results(): readonly CaseResult[] {
    return this.#results;
  }

  get datasetErrors(): readonly CaseSourceError[] {
    return this.#datasetErrors;
  }

  get evaluated(): number {
    return this.#results.length;
  }

  get passedCount(): number {
    return this.#results.filter((r) => r.passed).length;
  }

  /** Aprovados / avaliados. Falhas de contrato e runtime contam; erros de linha do dataset não. */
  accuracy(): number {
    return this.evaluated === 0 ? 0 : this.passedCount / this.evaluated;
  }

  /** Lote vazio sempre falha. Erros de linha do dataset não influenciam. */
  passed(threshold: number): boolean {
    return this.evaluated > 0 && this.accuracy() >= threshold;
  }

  failuresByReason(): Readonly<Record<FailureReason, number>> {
    const counts = Object.fromEntries(FAILURE_REASONS.map((r) => [r, 0])) as Record<FailureReason, number>;
    for (const result of this.#results) for (const reason of result.reasons) counts[reason] += 1;
    return counts;
  }
}
