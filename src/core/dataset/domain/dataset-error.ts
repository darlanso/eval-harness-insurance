/** Linha rejeitada do dataset (não fatal). */
export type DatasetError = {
  readonly line: number;
  readonly reason: string;
};

/** Erro que impede a carga do dataset inteiro. */
export class FatalDatasetError extends Error {
  override readonly name = 'FatalDatasetError';
}
