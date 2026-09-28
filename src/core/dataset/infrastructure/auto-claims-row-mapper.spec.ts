import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '#shared/result.js';
import { DEFAULT_HIGH_RISK_LIMITS } from '../domain/high-risk.js';
import { AutoClaimsRowMapper, parseUsDate, type CsvRow } from './auto-claims-row-mapper.js';

const QC35222: CsvRow = {
  Customer: 'QC35222', State: 'California', 'Customer Lifetime Value': '3622.69', Response: 'No',
  Coverage: 'Basic', 'Coverage Index': '0', Education: 'Bachelor', 'Education Index': '2',
  'Effective To Date': '1/1/2024', 'Employment Status': 'Employed', 'Employment Status Index': '1',
  Gender: 'F', Income: '65163', Location: 'Urban', 'Location Index': '2', 'Marital Status': 'Married',
  'Marital Status Index': '1', 'Monthly Premium Auto': '93', 'Months Since Last Claim': '4',
  'Months Since Policy Inception': '107', 'Number of Open Complaints': '3', 'Number of Policies': '1',
  'Policy Type': 'Corporate Auto', 'Policy Type Index': '1', Policy: 'Corporate L2', 'Policy Index': '4',
  'Renew Offer Type': '3', 'Sales Channel': 'Web', 'Sales Channel Index': '0', 'Total Claim Amount': '380.9',
  'Vehicle Class': 'Four-Door Car', 'Vehicle Class Index': '1', 'Vehicle Size': 'Medsize', 'Vehicle Size Index': '1',
};

const mapper = new AutoClaimsRowMapper(DEFAULT_HIGH_RISK_LIMITS);

describe('AutoClaimsRowMapper', () => {
  it('translates a real row into the domain model', () => {
    const r = mapper.map(QC35222, 2);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.id).toBe('QC35222');
    expect(r.value.line).toBe(2);
    expect(r.value.input.claimAmount).toBe(380.9);
    expect(r.value.input.monthlyPremium).toBe(93);
    expect(r.value.input.effectiveToDate).toBe('2024-01-01');
    expect(r.value.expected).toEqual({ isHighRisk: true, claimAmount: 380.9 });
  });

  it('leaks no CSV column names, Response, Index columns, id or answer key into the input', () => {
    const r = mapper.map(QC35222, 2);
    if (!isOk(r)) throw new Error('expected ok');
    const serialized = JSON.stringify(r.value.input);
    for (const leaked of ['Response', 'Index', 'Total Claim Amount', 'QC35222', 'isHighRisk', 'expected']) {
      expect(serialized).not.toContain(leaked);
    }
    expect(Object.keys(r.value.input).every((k) => /^[a-z][a-zA-Z]*$/.test(k))).toBe(true);
  });

  it.each([
    { field: 'Monthly Premium Auto', value: '0', reason: 'monthly premium must be > 0' },
    { field: 'Total Claim Amount', value: 'abc', reason: 'Total Claim Amount is not numeric: "abc"' },
    { field: 'Customer', value: '', reason: 'customer id is empty' },
    { field: 'Effective To Date', value: '13/45/24', reason: 'Effective To Date is not a valid date: "13/45/24"' },
    { field: 'Coverage', value: 'Gold', reason: 'Coverage has unexpected value: "Gold"' },
  ])('rejects $field = "$value"', ({ field, value, reason }) => {
    const r = mapper.map({ ...QC35222, [field]: value }, 7);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toEqual({ line: 7, reason });
  });
});

describe('parseUsDate', () => {
  it.each([
    ['1/1/2024', '2024-01-01'],
    ['1/13/11', '2011-01-13'],
    ['12/31/99', '2099-12-31'],
    ['2/29/2024', '2024-02-29'],
    ['2/30/2024', null],
    ['13/45/24', null],
    ['2024-01-01', null],
    ['', null],
  ])('%s -> %s', (raw, expected) => {
    expect(parseUsDate(raw)).toBe(expected);
  });
});
