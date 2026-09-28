import type OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { describeAssessorContract, hangUntilAborted, type RecordedCall } from '../../../../test/support/assessor-contract.js';
import { OpenAiClaimAssessor, type OpenAiChatClient } from './openai-claim-assessor.js';

const completion = (content: string | null, refusal: string | null = null) =>
  ({ choices: [{ message: { role: 'assistant', content, refusal } }] }) as unknown as OpenAI.Chat.ChatCompletion;

describeAssessorContract('OpenAiClaimAssessor', (behavior, settings = {}) => {
  const calls: RecordedCall[] = [];
  const client: OpenAiChatClient = {
    chat: {
      completions: {
        create: async (body, options) => {
          calls.push({ body: body as unknown as Record<string, unknown>, signal: options?.signal });
          switch (behavior.kind) {
            case 'text':
              return completion(behavior.text);
            case 'refusal':
              return completion(null, 'cannot help');
            case 'throw':
              throw behavior.error;
            case 'hang':
              return hangUntilAborted(options?.signal);
          }
        },
      },
    },
  };
  return { assessor: new OpenAiClaimAssessor(client, { model: 'm', systemPrompt: 'sys', ...settings }), calls };
});

describe('OpenAiClaimAssessor specifics', () => {
  it('sends system + user messages and requests a JSON object', async () => {
    let seen: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming | undefined;
    const client: OpenAiChatClient = {
      chat: {
        completions: {
          create: async (body) => {
            seen = body;
            return completion('{"claimStatus":"APPROVED","fraudRiskScore":5}');
          },
        },
      },
    };
    const r = await new OpenAiClaimAssessor(client, { model: 'gpt-x', systemPrompt: 'SYS' }).assess(
      { a: 1 },
      new AbortController().signal,
    );
    expect(r.ok).toBe(true);
    expect(seen?.model).toBe('gpt-x');
    expect(seen?.response_format).toEqual({ type: 'json_object' });
    expect(seen?.messages[0]).toEqual({ role: 'system', content: 'SYS' });
  });

  it('treats an empty choice list as CONTRACT_VIOLATION', async () => {
    const client: OpenAiChatClient = {
      chat: { completions: { create: async () => ({ choices: [] }) as unknown as OpenAI.Chat.ChatCompletion } },
    };
    const r = await new OpenAiClaimAssessor(client, { model: 'm', systemPrompt: 's' }).assess({}, new AbortController().signal);
    expect(r.ok ? null : r.error.kind).toBe('CONTRACT_VIOLATION');
  });
});
