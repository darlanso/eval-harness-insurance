import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { LoadGoldenDataset } from '../core/dataset/application/load-golden-dataset.js';
import { FatalDatasetError } from '../core/dataset/domain/dataset-error.js';
import { AutoClaimsRowMapper } from '../core/dataset/infrastructure/auto-claims-row-mapper.js';
import { CsvGoldenCaseReader } from '../core/dataset/infrastructure/csv-golden-case-reader.js';
import { RunHarnessSuite } from '../core/evaluation/application/run-harness-suite.js';
import type { CaseSource, ClaimAssessor } from '../core/evaluation/domain/ports.js';
import { AnthropicClaimAssessor } from '../core/evaluation/infrastructure/anthropic-claim-assessor.js';
import { DatasetCaseSource } from '../core/evaluation/infrastructure/dataset-case-source.js';
import { OpenAiClaimAssessor } from '../core/evaluation/infrastructure/openai-claim-assessor.js';
import { loadSystemPrompt } from '../core/evaluation/infrastructure/underwriting-prompt.js';
import { loadConfig, type Env, type HarnessConfig } from './config.js';
import { formatReport } from './report.js';

export type RunnerDeps = {
  readonly makeAssessor: (config: HarnessConfig, systemPrompt: string) => ClaimAssessor;
  readonly makeSource: (config: HarnessConfig) => CaseSource;
  readonly out: (text: string) => void;
  readonly errOut: (text: string) => void;
};

export const defaultDeps: RunnerDeps = {
  makeAssessor: (config, systemPrompt) => {
    const settings = {
      model: config.model,
      systemPrompt,
      ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
    };
    return config.provider === 'anthropic'
      ? new AnthropicClaimAssessor(new Anthropic({ apiKey: config.apiKey }), settings)
      : new OpenAiClaimAssessor(new OpenAI({ apiKey: config.apiKey }), settings);
  },
  makeSource: (config) =>
    new DatasetCaseSource(
      new LoadGoldenDataset(
        new CsvGoldenCaseReader(
          config.datasetPath,
          new AutoClaimsRowMapper({
            minOpenComplaints: config.highRiskMinComplaints,
            maxClaimPremiumRatio: config.highRiskClaimPremiumRatio,
          }),
        ),
      ),
    ),
  out: (text) => console.log(text),
  errOut: (text) => console.error(text),
};

/** Composition root. Retorna o código de saída sem tocar em `process`. */
export const main = async (env: Env, deps: RunnerDeps = defaultDeps): Promise<number> => {
  const config = loadConfig(env);
  if (!config.ok) {
    deps.errOut(`Invalid configuration:\n${config.error.map((e) => `  - ${e}`).join('\n')}`);
    return 1;
  }
  const c = config.value;

  try {
    const suite = new RunHarnessSuite(deps.makeSource(c), deps.makeAssessor(c, loadSystemPrompt()));
    const run = await suite.execute({
      policy: { severityCap: c.severityCap, scoreTolerance: c.scoreTolerance },
      concurrency: c.concurrency,
      timeoutMs: c.timeoutMs,
      ...(c.maxCases === undefined ? {} : { maxCases: c.maxCases }),
    });
    deps.out(formatReport(run, c.accuracyThreshold));
    return run.passed(c.accuracyThreshold) ? 0 : 1;
  } catch (error) {
    const label = error instanceof FatalDatasetError ? 'Dataset error' : 'Unexpected error';
    deps.errOut(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

const isDirectRun = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  process.exitCode = await main(process.env);
}
