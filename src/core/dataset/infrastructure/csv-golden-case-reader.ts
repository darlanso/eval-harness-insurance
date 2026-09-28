import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';
import type { Result } from '#shared/result.js';
import { FatalDatasetError, type DatasetError } from '../domain/dataset-error.js';
import type { GoldenCaseReader } from '../domain/golden-case-reader.js';
import type { GoldenCase } from '../domain/golden-case.js';
import { REQUIRED_COLUMNS, type AutoClaimsRowMapper, type CsvRow } from './auto-claims-row-mapper.js';

type ParsedRecord = { record: CsvRow; info: { lines: number } };

/** Lê o CSV em streaming (sem carregar o arquivo inteiro) e aplica a ACL linha a linha. */
export class CsvGoldenCaseReader implements GoldenCaseReader {
  readonly #path: string;
  readonly #mapper: AutoClaimsRowMapper;

  constructor(path: string, mapper: AutoClaimsRowMapper) {
    this.#path = path;
    this.#mapper = mapper;
  }

  async *read(): AsyncIterable<Result<GoldenCase, DatasetError>> {
    const source = createReadStream(this.#path);
    try {
      await new Promise<void>((resolve, reject) => {
        source.once('open', () => resolve());
        source.once('error', reject);
      });
    } catch (error) {
      source.destroy();
      throw new FatalDatasetError(`cannot read dataset "${this.#path}": ${(error as Error).message}`);
    }

    const parser = parse({
      bom: true,
      columns: (header: string[]) => {
        const names = header.map((h) => h.trim());
        const missing = REQUIRED_COLUMNS.filter((c) => !names.includes(c));
        if (missing.length > 0) throw new FatalDatasetError(`missing required columns: ${missing.join(', ')}`);
        return names;
      },
      info: true,
      skip_empty_lines: true,
      trim: true,
    });
    source.on('error', (error) => parser.destroy(error));
    source.pipe(parser);

    try {
      for await (const { record, info } of parser as AsyncIterable<ParsedRecord>) {
        yield this.#mapper.map(record, info.lines);
      }
    } catch (error) {
      if (error instanceof FatalDatasetError) throw error;
      const cause = (error as { cause?: unknown }).cause;
      if (cause instanceof FatalDatasetError) throw cause;
      throw new FatalDatasetError(`malformed dataset "${this.#path}": ${(error as Error).message}`);
    } finally {
      source.destroy();
      parser.destroy();
    }
  }
}
