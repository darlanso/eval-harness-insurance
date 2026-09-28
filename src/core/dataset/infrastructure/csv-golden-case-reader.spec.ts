import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isErr, isOk, type Result } from '#shared/result.js';
import { FatalDatasetError, type DatasetError } from '../domain/dataset-error.js';
import type { GoldenCase } from '../domain/golden-case.js';
import { DEFAULT_HIGH_RISK_LIMITS } from '../domain/high-risk.js';
import { AutoClaimsRowMapper } from './auto-claims-row-mapper.js';
import { CsvGoldenCaseReader } from './csv-golden-case-reader.js';

const fixture = (name: string) => fileURLToPath(new URL(`../../../../test/fixtures/${name}`, import.meta.url));

const readAll = async (name: string) => {
  const reader = new CsvGoldenCaseReader(fixture(name), new AutoClaimsRowMapper(DEFAULT_HIGH_RISK_LIMITS));
  const out: Result<GoldenCase, DatasetError>[] = [];
  for await (const r of reader.read()) out.push(r);
  return out;
};

describe('CsvGoldenCaseReader', () => {
  it('streams valid rows (BOM + CRLF) in file order', async () => {
    const results = await readAll('valid.csv');
    expect(results).toHaveLength(5);
    const ids = results.map((r) => (isOk(r) ? r.value.id : null));
    expect(ids.slice(0, 2)).toEqual(['QC35222', 'AE98193']);
    expect(ids.every((id) => id !== null && !id.includes('\r') && !id.startsWith('﻿'))).toBe(true);
  });

  it('reports the real file line number for each case', async () => {
    const [first, second] = await readAll('valid.csv');
    expect(first && isOk(first) && first.value.line).toBe(2);
    expect(second && isOk(second) && second.value.line).toBe(3);
  });

  it('parses both date formats', async () => {
    const results = await readAll('dates.csv');
    expect(results.map((r) => (isOk(r) ? r.value.input.effectiveToDate : r.error.reason))).toEqual([
      '2024-01-01',
      '2011-01-13',
    ]);
  });

  it('records invalid rows without stopping the stream', async () => {
    const results = await readAll('invalid-rows.csv');
    expect(results).toHaveLength(5);
    const errors = results.filter(isErr).map((r) => r.error);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
    expect(errors[0]?.reason).toBe('monthly premium must be > 0');
    expect(errors[1]?.reason).toContain('Total Claim Amount');
    expect(errors[2]?.reason).toBe('customer id is empty');
    expect(errors[3]?.reason).toContain('Effective To Date');
    const last = results[4];
    expect(last && isOk(last) && last.value.id).toBe('OK1');
  });

  it('aborts with a fatal error listing missing columns', async () => {
    await expect(readAll('missing-columns.csv')).rejects.toThrow(FatalDatasetError);
    await expect(readAll('missing-columns.csv')).rejects.toThrow(/Total Claim Amount/);
  });

  it('aborts with a fatal error when the file does not exist', async () => {
    await expect(readAll('nope.csv')).rejects.toThrow(FatalDatasetError);
  });
});
