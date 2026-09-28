import { err, type Result } from '#shared/result.js';
import type { AiAssessment } from '../domain/ai-assessment.js';
import type { AssessorFailure } from '../domain/failure-reason.js';
import { parseAssessment } from './ai-assessment-schema.js';

/** Resultado bruto de uma chamada ao provedor: texto da resposta ou recusa explícita. */
export type ProviderReply = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'refusal'; readonly detail: string };

/** Executa a chamada ao provedor garantindo que nenhuma exceção escape do port. */
export const assessWith = async (
  signal: AbortSignal,
  call: () => Promise<ProviderReply>,
): Promise<Result<AiAssessment, AssessorFailure>> => {
  let reply: ProviderReply;
  try {
    reply = await call();
  } catch (error) {
    const detail = signal.aborted
      ? `request aborted: ${String(signal.reason ?? 'timeout')}`
      : `provider error: ${error instanceof Error ? error.message : String(error)}`;
    return err({ kind: 'RUNTIME_ERROR', detail });
  }
  if (reply.kind === 'refusal') return err({ kind: 'CONTRACT_VIOLATION', detail: `model refused: ${reply.detail}` });
  return parseAssessment(reply.text);
};
