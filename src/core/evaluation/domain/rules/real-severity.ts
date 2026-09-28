export const DEFAULT_SEVERITY_CAP = 2000;

/** Severidade real 0..100: normalização linear do valor do sinistro contra o teto. */
export const realSeverity = (claimAmount: number, cap: number = DEFAULT_SEVERITY_CAP): number =>
  Math.round((Math.min(Math.max(claimAmount, 0), cap) / cap) * 100);
