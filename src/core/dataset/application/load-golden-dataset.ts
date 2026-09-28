import type { Result } from '#shared/result.js';
import type { DatasetError } from '../domain/dataset-error.js';
import type { GoldenCaseReader } from '../domain/golden-case-reader.js';
import type { GoldenCase } from '../domain/golden-case.js';

/** Caso de uso: expõe o Golden Dataset como sequência assíncrona de casos ou erros de linha. */
export class LoadGoldenDataset {
  readonly #reader: GoldenCaseReader;

  constructor(reader: GoldenCaseReader) {
    this.#reader = reader;
  }

  execute(): AsyncIterable<Result<GoldenCase, DatasetError>> {
    return this.#reader.read();
  }
}
