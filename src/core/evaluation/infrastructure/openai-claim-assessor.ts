import type OpenAI from 'openai';
import type { Result } from '#shared/result.js';
import type { AiAssessment } from '../domain/ai-assessment.js';
import type { ClaimFacts } from '../domain/evaluation-case.js';
import type { AssessorFailure } from '../domain/failure-reason.js';
import type { ClaimAssessor } from '../domain/ports.js';
import type { ProviderSettings } from './anthropic-claim-assessor.js';
import { assessWith } from './assess-with.js';
import { buildUserMessage } from './underwriting-prompt.js';

export type OpenAiChatClient = {
  readonly chat: {
    readonly completions: {
      create(
        body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
        options?: { signal?: AbortSignal },
      ): PromiseLike<OpenAI.Chat.ChatCompletion>;
    };
  };
};

export class OpenAiClaimAssessor implements ClaimAssessor {
  readonly #client: OpenAiChatClient;
  readonly #settings: ProviderSettings;

  constructor(client: OpenAiChatClient, settings: ProviderSettings) {
    this.#client = client;
    this.#settings = settings;
  }

  assess(facts: ClaimFacts, signal: AbortSignal): Promise<Result<AiAssessment, AssessorFailure>> {
    return assessWith(signal, async () => {
      const { model, systemPrompt, temperature } = this.#settings;
      const completion = await this.#client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: buildUserMessage(facts) },
          ],
          response_format: { type: 'json_object' },
          ...(temperature === undefined ? {} : { temperature }),
        },
        { signal },
      );
      const message = completion.choices[0]?.message;
      if (message?.refusal) return { kind: 'refusal', detail: message.refusal };
      return { kind: 'text', text: message?.content ?? '' };
    });
  }
}
