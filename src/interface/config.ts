import { z } from 'zod';
import { err, ok, type Result } from '#shared/result.js';

export type Env = Readonly<Record<string, string | undefined>>;

export type HarnessConfig = {
  readonly datasetPath: string;
  readonly provider: 'anthropic' | 'openai';
  readonly model: string;
  readonly apiKey: string;
  readonly severityCap: number;
  readonly highRiskMinComplaints: number;
  readonly highRiskClaimPremiumRatio: number;
  readonly scoreTolerance: number;
  readonly accuracyThreshold: number;
  readonly maxCases: number | undefined;
  readonly concurrency: number;
  readonly timeoutMs: number;
  readonly temperature: number | undefined;
};

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const num = () => z.coerce.number({ error: 'must be a number' });
const optionalNumber = (schema: z.ZodNumber) => z.preprocess(blankToUndefined, num().pipe(schema).optional());
const numberWithDefault = (schema: z.ZodNumber, fallback: number) =>
  z.preprocess(blankToUndefined, num().pipe(schema).default(fallback));

const envSchema = z.object({
  DATASET_PATH: z.preprocess(blankToUndefined, z.string().default('data/AutoInsuranceClaims2024.csv')),
  AI_PROVIDER: z.preprocess(blankToUndefined, z.enum(['anthropic', 'openai']).default('anthropic')),
  AI_MODEL: z.preprocess(blankToUndefined, z.string({ error: 'is required' })),
  ANTHROPIC_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  OPENAI_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  SEVERITY_CAP: numberWithDefault(z.number().positive(), 2000),
  HIGH_RISK_MIN_COMPLAINTS: numberWithDefault(z.number().int().min(0), 3),
  HIGH_RISK_CLAIM_PREMIUM_RATIO: numberWithDefault(z.number().positive(), 10),
  SCORE_TOLERANCE: numberWithDefault(z.number().min(0).max(100), 15),
  ACCURACY_THRESHOLD: numberWithDefault(z.number().min(0).max(1), 1),
  MAX_CASES: optionalNumber(z.number().int().positive()),
  CONCURRENCY: numberWithDefault(z.number().int().positive(), 1),
  AI_TIMEOUT_MS: numberWithDefault(z.number().int().positive(), 30000),
  AI_TEMPERATURE: optionalNumber(z.number().min(0).max(2)),
});

/** Valida o ambiente. Erros citam o nome da variável e nunca o valor (evita vazar segredos). */
export const loadConfig = (env: Env): Result<HarnessConfig, string[]> => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    return err(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  const e = parsed.data;
  const keyVar = e.AI_PROVIDER === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  const apiKey = e[keyVar];
  if (apiKey === undefined) return err([`${keyVar}: is required when AI_PROVIDER=${e.AI_PROVIDER}`]);

  return ok({
    datasetPath: e.DATASET_PATH,
    provider: e.AI_PROVIDER,
    model: e.AI_MODEL,
    apiKey,
    severityCap: e.SEVERITY_CAP,
    highRiskMinComplaints: e.HIGH_RISK_MIN_COMPLAINTS,
    highRiskClaimPremiumRatio: e.HIGH_RISK_CLAIM_PREMIUM_RATIO,
    scoreTolerance: e.SCORE_TOLERANCE,
    accuracyThreshold: e.ACCURACY_THRESHOLD,
    maxCases: e.MAX_CASES,
    concurrency: e.CONCURRENCY,
    timeoutMs: e.AI_TIMEOUT_MS,
    temperature: e.AI_TEMPERATURE,
  });
};
