import type { HarnessRun } from '../core/evaluation/domain/harness-run.js';
import { FAILURE_REASONS } from '../core/evaluation/domain/failure-reason.js';

const pct = (value: number): string => `${(value * 100).toFixed(2)}%`;

/** Relatório textual da execução. Não recebe configuração sensível, então não pode vazar segredos. */
export const formatReport = (run: HarnessRun, threshold: number): string => {
  const byReason = run.failuresByReason();
  const failed = run.results.filter((r) => !r.passed);
  const verdict = run.passed(threshold) ? 'PASS' : 'FAIL';

  const lines = [
    '== Eval Harness Report ==',
    `Evaluated:      ${run.evaluated}`,
    `Passed:         ${run.passedCount}`,
    `Failed:         ${failed.length}`,
    ...FAILURE_REASONS.map((reason) => `  ${reason.padEnd(24)}${byReason[reason]}`),
    `Dataset errors: ${run.datasetErrors.length}`,
    `Accuracy:       ${pct(run.accuracy())} (threshold ${pct(threshold)})`,
    `Result:         ${verdict}${run.evaluated === 0 ? ' (no cases evaluated)' : ''}`,
  ];

  if (failed.length > 0) {
    lines.push('', '-- Failed cases --');
    for (const r of failed) {
      const score = r.assessment ? ` status=${r.assessment.claimStatus} score=${r.assessment.fraudRiskScore}` : '';
      const detail = r.detail ? ` detail="${r.detail}"` : '';
      lines.push(`${r.caseId}: ${r.reasons.join(', ')} severity=${r.realSeverity}${score}${detail}`);
    }
  }

  if (run.datasetErrors.length > 0) {
    lines.push('', '-- Dataset errors --');
    for (const e of run.datasetErrors) lines.push(`line ${e.line}: ${e.reason}`);
  }

  return lines.join('\n');
};
