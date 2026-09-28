import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { describeAssessorContract, hangUntilAborted, type RecordedCall } from '../../../../test/support/assessor-contract.js';
import { AnthropicClaimAssessor, type AnthropicMessagesClient } from './anthropic-claim-assessor.js';

const message = (content: Anthropic.ContentBlock[], stop_reason: Anthropic.StopReason = 'end_turn') =>
  ({ content, stop_reason }) as unknown as Anthropic.Message;

const text = (t: string) => ({ type: 'text', text: t, citations: null }) as Anthropic.TextBlock;

describeAssessorContract('AnthropicClaimAssessor', (behavior, settings = {}) => {
  const calls: RecordedCall[] = [];
  const client: AnthropicMessagesClient = {
    messages: {
      create: async (body, options) => {
        calls.push({ body: body as unknown as Record<string, unknown>, signal: options?.signal });
        switch (behavior.kind) {
          case 'text':
            return message([text(behavior.text)]);
          case 'refusal':
            return message([], 'refusal');
          case 'throw':
            throw behavior.error;
          case 'hang':
            return hangUntilAborted(options?.signal);
        }
      },
    },
  };
  return { assessor: new AnthropicClaimAssessor(client, { model: 'm', systemPrompt: 'sys', ...settings }), calls };
});

describe('AnthropicClaimAssessor specifics', () => {
  it('sends model, system prompt and max_tokens, and joins text blocks', async () => {
    let seen: Anthropic.MessageCreateParamsNonStreaming | undefined;
    const client: AnthropicMessagesClient = {
      messages: {
        create: async (body) => {
          seen = body;
          return message([
            { type: 'thinking', thinking: '', signature: 's' } as unknown as Anthropic.ContentBlock,
            text('{"claimStatus":"DENIED",'),
            text('"fraudRiskScore":70}'),
          ]);
        },
      },
    };
    const r = await new AnthropicClaimAssessor(client, { model: 'claude-x', systemPrompt: 'SYS' }).assess(
      { a: 1 },
      new AbortController().signal,
    );
    expect(r).toEqual({ ok: true, value: { claimStatus: 'DENIED', fraudRiskScore: 70 } });
    expect(seen).toMatchObject({ model: 'claude-x', system: 'SYS', max_tokens: 4096 });
  });
});
