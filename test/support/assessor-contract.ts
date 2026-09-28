import { describe, expect, it } from 'vitest';
import type { ClaimAssessor } from '../../src/core/evaluation/domain/ports.js';

/** Comportamento programado do provedor fake. */
export type FakeBehavior =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'refusal' }
  | { readonly kind: 'throw'; readonly error: Error }
  | { readonly kind: 'hang' };

export type RecordedCall = { readonly body: Record<string, unknown>; readonly signal: AbortSignal | undefined };

export type AssessorHarness = (
  behavior: FakeBehavior,
  settings?: { temperature?: number },
) => { assessor: ClaimAssessor; calls: RecordedCall[] };

/** Espera até o sinal ser abortado e rejeita, imitando o SDK. */
export const hangUntilAborted = (signal: AbortSignal | undefined): Promise<never> =>
  new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('Request was aborted.')), { once: true });
  });

const facts = { claimAmount: 380.9, openComplaints: 3 };

/** Suíte compartilhada: todo adapter de IA deve produzir os mesmos resultados. */
export const describeAssessorContract = (name: string, make: AssessorHarness): void => {
  describe(`${name} (ClaimAssessor contract)`, () => {
    it('returns the parsed assessment for a valid reply', async () => {
      const { assessor } = make({ kind: 'text', text: '{"claimStatus":"DENIED","fraudRiskScore":80,"reasoning":"x"}' });
      expect(await assessor.assess(facts, new AbortController().signal)).toEqual({
        ok: true,
        value: { claimStatus: 'DENIED', fraudRiskScore: 80 },
      });
    });

    it('maps an invalid reply to CONTRACT_VIOLATION', async () => {
      const { assessor } = make({ kind: 'text', text: '{"claimStatus":"PENDING","fraudRiskScore":80}' });
      const r = await assessor.assess(facts, new AbortController().signal);
      expect(r.ok ? null : r.error.kind).toBe('CONTRACT_VIOLATION');
    });

    it('maps non-JSON text to CONTRACT_VIOLATION', async () => {
      const { assessor } = make({ kind: 'text', text: 'I think it is fine.' });
      const r = await assessor.assess(facts, new AbortController().signal);
      expect(r.ok ? null : r.error.kind).toBe('CONTRACT_VIOLATION');
    });

    it('maps a model refusal to CONTRACT_VIOLATION', async () => {
      const { assessor } = make({ kind: 'refusal' });
      const r = await assessor.assess(facts, new AbortController().signal);
      expect(r.ok ? null : r.error).toMatchObject({ kind: 'CONTRACT_VIOLATION', detail: expect.stringContaining('refused') });
    });

    it('maps a thrown provider error to RUNTIME_ERROR', async () => {
      const { assessor } = make({ kind: 'throw', error: new Error('503 overloaded') });
      const r = await assessor.assess(facts, new AbortController().signal);
      expect(r.ok ? null : r.error).toEqual({ kind: 'RUNTIME_ERROR', detail: 'provider error: 503 overloaded' });
    });

    it('maps a timeout abort to RUNTIME_ERROR', async () => {
      const { assessor } = make({ kind: 'hang' });
      const r = await assessor.assess(facts, AbortSignal.timeout(10));
      expect(r.ok ? null : r.error).toMatchObject({ kind: 'RUNTIME_ERROR', detail: expect.stringContaining('aborted') });
    });

    it('forwards the abort signal and sends only facts in the prompt', async () => {
      const { assessor, calls } = make({ kind: 'text', text: '{"claimStatus":"APPROVED","fraudRiskScore":10}' });
      const signal = new AbortController().signal;
      await assessor.assess(facts, signal);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.signal).toBe(signal);
      const serialized = JSON.stringify(calls[0]?.body);
      expect(serialized).toContain('380.9');
      expect(serialized).not.toContain('isHighRisk');
    });

    it('omits temperature unless configured', async () => {
      const unset = make({ kind: 'text', text: '{"claimStatus":"APPROVED","fraudRiskScore":10}' });
      await unset.assessor.assess(facts, new AbortController().signal);
      expect(unset.calls[0]?.body).not.toHaveProperty('temperature');

      const set = make({ kind: 'text', text: '{"claimStatus":"APPROVED","fraudRiskScore":10}' }, { temperature: 0 });
      await set.assessor.assess(facts, new AbortController().signal);
      expect(set.calls[0]?.body).toHaveProperty('temperature', 0);
    });
  });
};
