import { evaluateCase, type CaseResult, type EvaluationPolicy } from '../domain/evaluate-case.js';
import type { EvaluationCase } from '../domain/evaluation-case.js';
import { HarnessRun } from '../domain/harness-run.js';
import type { CaseSource, ClaimAssessor } from '../domain/ports.js';

export type RunOptions = {
  readonly policy: EvaluationPolicy;
  readonly concurrency: number;
  readonly timeoutMs: number;
  readonly maxCases?: number;
};

/** Caso de uso: avalia cada caso na IA, aplica as regras e consolida o HarnessRun. */
export class RunHarnessSuite {
  readonly #source: CaseSource;
  readonly #assessor: ClaimAssessor;

  constructor(source: CaseSource, assessor: ClaimAssessor) {
    this.#source = source;
    this.#assessor = assessor;
  }

  async execute(options: RunOptions): Promise<HarnessRun> {
    const run = new HarnessRun();
    const results: CaseResult[] = [];
    const inFlight = new Set<Promise<void>>();
    const concurrency = Math.max(1, Math.floor(options.concurrency));
    let position = 0;

    const evaluate = async (evaluationCase: EvaluationCase, index: number): Promise<void> => {
      const outcome = await this.#assessor.assess(evaluationCase.facts, AbortSignal.timeout(options.timeoutMs));
      results[index] = evaluateCase(evaluationCase, outcome, options.policy);
    };

    try {
      for await (const item of this.#source.cases()) {
        if (!item.ok) {
          run.recordDatasetError(item.error);
          continue;
        }
        if (options.maxCases !== undefined && position >= options.maxCases) break;

        const task = evaluate(item.value, position++).finally(() => inFlight.delete(task));
        inFlight.add(task);
        if (inFlight.size >= concurrency) await Promise.race(inFlight);
        if (options.maxCases !== undefined && position >= options.maxCases) break;
      }
    } finally {
      await Promise.all(inFlight);
    }

    for (const result of results) run.record(result);
    return run;
  }
}
