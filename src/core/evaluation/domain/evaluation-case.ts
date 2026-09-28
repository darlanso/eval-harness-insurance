/**
 * Fatos do sinistro enviados à IA. A avaliação não depende do formato interno:
 * apenas serializa os fatos para o avaliador.
 */
export type ClaimFacts = Readonly<Record<string, string | number>>;

export type EvaluationExpectation = {
  readonly isHighRisk: boolean;
  readonly claimAmount: number;
};

export type EvaluationCase = {
  readonly id: string;
  readonly facts: ClaimFacts;
  readonly expected: EvaluationExpectation;
};

/** Erro de linha vindo da fonte de casos (não fatal). */
export type CaseSourceError = {
  readonly line: number;
  readonly reason: string;
};
