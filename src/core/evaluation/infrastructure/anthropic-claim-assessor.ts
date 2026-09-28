import type Anthropic from '@anthropic-ai/sdk';
import type { Result } from '#shared/result.js';
import type { AiAssessment } from '../domain/ai-assessment.js';
import type { ClaimFacts } from '../domain/evaluation-case.js';
import type { AssessorFailure } from '../domain/failure-reason.js';
import type { ClaimAssessor } from '../domain/ports.js';
import { assessWith } from './assess-with.js';
import { buildUserMessage } from './underwriting-prompt.js';

export type AnthropicMessagesClient = {
  readonly messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
      options?: { signal?: AbortSignal },
    ): PromiseLike<Anthropic.Message>;
  };
};

export type ProviderSettings = {
  readonly model: string;
  readonly systemPrompt: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
};

export class AnthropicClaimAssessor implements ClaimAssessor {
  readonly #client: AnthropicMessagesClient;
  readonly #settings: ProviderSettings;

  constructor(client: AnthropicMessagesClient, settings: ProviderSettings) {
    this.#client = client;
    this.#settings = settings;
  }

  assess(facts: ClaimFacts, signal: AbortSignal): Promise<Result<AiAssessment, AssessorFailure>> {
    return assessWith(signal, async () => {
      const { model, systemPrompt, temperature, maxTokens = 4096 } = this.#settings;
      const response = await this.#client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: buildUserMessage(facts) }],
          ...(temperature === undefined ? {} : { temperature }),
        },
        { signal },
      );
      if (response.stop_reason === 'refusal') return { kind: 'refusal', detail: 'stop_reason=refusal' };
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      return { kind: 'text', text };
    });
  }
}
