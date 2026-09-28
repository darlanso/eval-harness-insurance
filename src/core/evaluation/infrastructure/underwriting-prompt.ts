import { readFileSync } from 'node:fs';
import type { ClaimFacts } from '../domain/evaluation-case.js';

export const PROMPT_VERSION = 'underwriting.v1';

export const loadSystemPrompt = (version: string = PROMPT_VERSION): string =>
  readFileSync(new URL(`./prompts/${version}.md`, import.meta.url), 'utf8');

/** Mensagem do usuário: apenas os fatos do sinistro, serializados como JSON. */
export const buildUserMessage = (facts: ClaimFacts): string =>
  `Claim profile:\n${JSON.stringify(facts, null, 2)}`;
