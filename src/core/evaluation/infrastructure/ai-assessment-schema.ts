import { z } from 'zod';
import { err, ok, type Result } from '#shared/result.js';
import { CLAIM_STATUSES, type AiAssessment } from '../domain/ai-assessment.js';
import type { AssessorFailure } from '../domain/failure-reason.js';

/** Contrato de resposta da IA. Campos extras (ex.: reasoning) são descartados. */
export const aiAssessmentSchema = z.object({
  claimStatus: z.enum(CLAIM_STATUSES),
  fraudRiskScore: z.number().int().min(0).max(100),
});

const FENCE = /^\s*```(?:json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/i;

/** Remove uma cerca markdown ```json envolvente, se houver. Nenhum outro reparo é feito. */
export const stripCodeFence = (text: string): string => {
  const match = FENCE.exec(text);
  return (match?.[1] ?? text).trim();
};

export const parseAssessment = (text: string): Result<AiAssessment, AssessorFailure> => {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(text));
  } catch {
    return err({ kind: 'CONTRACT_VIOLATION', detail: `response is not valid JSON: ${text.slice(0, 120)}` });
  }
  const parsed = aiAssessmentSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return err({ kind: 'CONTRACT_VIOLATION', detail: `response violates contract: ${issues}` });
  }
  return ok(parsed.data);
};
