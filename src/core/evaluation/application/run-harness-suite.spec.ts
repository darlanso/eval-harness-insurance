import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from '#shared/result.js';
import type { AiAssessment } from '../domain/ai-assessment.js';
import { DEFAULT_EVALUATION_POLICY } from '../domain/evaluate-case.js';
import type { CaseSourceError, ClaimFacts, EvaluationCase } from '../domain/evaluation-case.js';
import type { AssessorFailure } from '../domain/failure-reason.js';
import type { CaseSource, ClaimAssessor } from '../domain/ports.js';
import { RunHarnessSuite } from './run-harness-suite.js';

type Item = Result<EvaluationCase, CaseSourceError>;

const makeCase = (id: string, isHighRisk = false, claimAmount = 1000): EvaluationCase => ({
  id,
  facts: { id: id, claimAmount },
  expected: { isHighRisk, claimAmount },
});

class InMemoryCaseSource implements CaseSource {
  pulled = 0;
  readonly #items: Item[];
  constructor(items: Item[]) {
    this.#items = items;
  }
  async *cases(): AsyncIterable<Item> {
    for (const item of this.#items) {
      this.pulled++;
      yield item;
    }
  }
}

type Reply = Result<AiAssessment, AssessorFailure>;
type Script = { reply: Reply; delayMs?: number };

class StubClaimAssessor implements ClaimAssessor {
  active = 0;
  maxActive = 0;
  signals: AbortSignal[] = [];
  readonly #script: (facts: ClaimFacts) => Script;
  constructor(script: (facts: ClaimFacts) => Script) {
    this.#script = script;
  }
  async assess(facts: ClaimFacts, signal: AbortSignal): Promise<Reply> {
    this.signals.push(signal);
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);
    const { reply, delayMs = 0 } = this.#script(facts);
    await new Promise((r) => setTimeout(r, delayMs));
    this.active--;
    return reply;
  }
}

const approve50 = ok<AiAssessment>({ claimStatus: 'APPROVED', fraudRiskScore: 50 });
const baseOptions = { policy: DEFAULT_EVALUATION_POLICY, concurrency: 1, timeoutMs: 1000 };

describe('RunHarnessSuite', () => {
  it('evaluates every case and records dataset row errors separately', async () => {
    const source = new InMemoryCaseSource([ok(makeCase('A')), err({ line: 3, reason: 'bad' }), ok(makeCase('B'))]);
    const run = await new RunHarnessSuite(source, new StubClaimAssessor(() => ({ reply: approve50 }))).execute(baseOptions);
    expect(run.results.map((r) => r.caseId)).toEqual(['A', 'B']);
    expect(run.accuracy()).toBe(1);
    expect(run.datasetErrors).toEqual([{ line: 3, reason: 'bad' }]);
  });

  it('keeps evaluating after an assessor failure', async () => {
    const source = new InMemoryCaseSource([ok(makeCase('A')), ok(makeCase('B')), ok(makeCase('C'))]);
    const assessor = new StubClaimAssessor((facts) => ({
      reply: facts['id'] === 'B' ? err({ kind: 'RUNTIME_ERROR', detail: 'down' }) : approve50,
    }));
    const run = await new RunHarnessSuite(source, assessor).execute(baseOptions);
    expect(run.results.map((r) => [r.caseId, r.reasons])).toEqual([
      ['A', []],
      ['B', ['RUNTIME_ERROR']],
      ['C', []],
    ]);
    expect(run.accuracy()).toBeCloseTo(2 / 3);
  });

  it('applies the evaluation policy to each result', async () => {
    const source = new InMemoryCaseSource([ok(makeCase('HR', true, 1000))]);
    const run = await new RunHarnessSuite(source, new StubClaimAssessor(() => ({ reply: approve50 }))).execute(baseOptions);
    expect(run.results[0]?.reasons).toEqual(['CRITICAL_FALSE_NEGATIVE']);
  });

  it('respects concurrency and keeps results in source order', async () => {
    const items = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ok(makeCase(id)));
    const delays: Record<string, number> = { A: 40, B: 5, C: 25, D: 1, E: 15, F: 2 };
    const assessor = new StubClaimAssessor((facts) => ({ reply: approve50, delayMs: delays[String(facts['id'])] ?? 0 }));
    const run = await new RunHarnessSuite(new InMemoryCaseSource(items), assessor).execute({ ...baseOptions, concurrency: 3 });
    expect(assessor.maxActive).toBe(3);
    expect(run.results.map((r) => r.caseId)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('runs sequentially with concurrency 1', async () => {
    const items = ['A', 'B', 'C'].map((id) => ok(makeCase(id)));
    const assessor = new StubClaimAssessor(() => ({ reply: approve50, delayMs: 2 }));
    await new RunHarnessSuite(new InMemoryCaseSource(items), assessor).execute(baseOptions);
    expect(assessor.maxActive).toBe(1);
  });

  it('stops pulling from the source once maxCases valid cases were taken', async () => {
    const items: Item[] = [ok(makeCase('A')), err({ line: 3, reason: 'bad' }), ok(makeCase('B')), ok(makeCase('C')), ok(makeCase('D'))];
    const source = new InMemoryCaseSource(items);
    const run = await new RunHarnessSuite(source, new StubClaimAssessor(() => ({ reply: approve50 }))).execute({
      ...baseOptions,
      maxCases: 2,
    });
    expect(run.results.map((r) => r.caseId)).toEqual(['A', 'B']);
    expect(source.pulled).toBe(3);
  });

  it('gives each call a timeout signal', async () => {
    const assessor = new StubClaimAssessor(() => ({ reply: approve50 }));
    await new RunHarnessSuite(new InMemoryCaseSource([ok(makeCase('A'))]), assessor).execute({ ...baseOptions, timeoutMs: 5 });
    await new Promise((r) => setTimeout(r, 20));
    expect(assessor.signals[0]?.aborted).toBe(true);
  });

  it('propagates fatal source errors', async () => {
    const source: CaseSource = {
      async *cases() {
        throw new Error('missing required columns: X');
      },
    };
    await expect(new RunHarnessSuite(source, new StubClaimAssessor(() => ({ reply: approve50 }))).execute(baseOptions)).rejects.toThrow(
      'missing required columns',
    );
  });
});
