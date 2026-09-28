import type { Result } from '#shared/result.js';
import type { DatasetError } from './dataset-error.js';
import type { GoldenCase } from './golden-case.js';

/** Port: fonte do Golden Dataset. Lança FatalDatasetError quando a carga inteira é inviável. */
export interface GoldenCaseReader {
  read(): AsyncIterable<Result<GoldenCase, DatasetError>>;
}
