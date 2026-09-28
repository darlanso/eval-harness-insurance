import { err, type Result } from '#shared/result.js';
import type { DatasetError } from '../domain/dataset-error.js';
import {
  createGoldenCase,
  type ClaimInput,
  type Coverage,
  type Gender,
  type GoldenCase,
  type LocationKind,
  type PolicyType,
  type VehicleSize,
} from '../domain/golden-case.js';
import type { HighRiskLimits } from '../domain/high-risk.js';

/** Colunas do CSV AutoInsuranceClaims2024 exigidas pela ACL. */
export const REQUIRED_COLUMNS = [
  'Customer',
  'State',
  'Customer Lifetime Value',
  'Coverage',
  'Education',
  'Effective To Date',
  'Employment Status',
  'Gender',
  'Income',
  'Location',
  'Marital Status',
  'Monthly Premium Auto',
  'Months Since Last Claim',
  'Months Since Policy Inception',
  'Number of Open Complaints',
  'Number of Policies',
  'Policy Type',
  'Policy',
  'Renew Offer Type',
  'Sales Channel',
  'Total Claim Amount',
  'Vehicle Class',
  'Vehicle Size',
] as const;

export type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];
export type CsvRow = Readonly<Record<string, string>>;

class RowFieldError extends Error {}

const text = (row: CsvRow, column: RequiredColumn): string => (row[column] ?? '').trim();

const num = (row: CsvRow, column: RequiredColumn): number => {
  const raw = text(row, column);
  const value = Number(raw);
  if (raw === '' || !Number.isFinite(value)) throw new RowFieldError(`${column} is not numeric: "${raw}"`);
  return value;
};

const oneOf = <T extends string>(row: CsvRow, column: RequiredColumn, allowed: readonly T[]): T => {
  const raw = text(row, column);
  const match = allowed.find((candidate) => candidate === raw);
  if (match === undefined) throw new RowFieldError(`${column} has unexpected value: "${raw}"`);
  return match;
};

/** Converte `M/D/YYYY` ou `M/D/YY` (→ 20YY) para `YYYY-MM-DD`. */
export const parseUsDate = (raw: string): string | null => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(raw.trim());
  if (match === null) return null;
  const [, m, d, y] = match;
  const month = Number(m);
  const day = Number(d);
  const year = y!.length === 2 ? 2000 + Number(y) : Number(y);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
};

const date = (row: CsvRow, column: RequiredColumn): string => {
  const parsed = parseUsDate(text(row, column));
  if (parsed === null) throw new RowFieldError(`${column} is not a valid date: "${text(row, column)}"`);
  return parsed;
};

/** ACL: linha crua do CSV → GoldenCase. Nomes de coluna não passam desta fronteira. */
export class AutoClaimsRowMapper {
  readonly #limits: HighRiskLimits;

  constructor(limits: HighRiskLimits) {
    this.#limits = limits;
  }

  map(row: CsvRow, line: number): Result<GoldenCase, DatasetError> {
    let input: ClaimInput;
    try {
      input = {
        state: text(row, 'State'),
        customerLifetimeValue: num(row, 'Customer Lifetime Value'),
        coverage: oneOf<Coverage>(row, 'Coverage', ['Basic', 'Extended', 'Premium']),
        education: text(row, 'Education'),
        effectiveToDate: date(row, 'Effective To Date'),
        employmentStatus: text(row, 'Employment Status'),
        gender: oneOf<Gender>(row, 'Gender', ['F', 'M']),
        income: num(row, 'Income'),
        location: oneOf<LocationKind>(row, 'Location', ['Rural', 'Suburban', 'Urban']),
        maritalStatus: text(row, 'Marital Status'),
        monthlyPremium: num(row, 'Monthly Premium Auto'),
        monthsSinceLastClaim: num(row, 'Months Since Last Claim'),
        monthsSincePolicyInception: num(row, 'Months Since Policy Inception'),
        openComplaints: num(row, 'Number of Open Complaints'),
        numberOfPolicies: num(row, 'Number of Policies'),
        policyType: oneOf<PolicyType>(row, 'Policy Type', ['Corporate Auto', 'Personal Auto', 'Special Auto']),
        policy: text(row, 'Policy'),
        renewOfferType: num(row, 'Renew Offer Type'),
        salesChannel: text(row, 'Sales Channel'),
        claimAmount: num(row, 'Total Claim Amount'),
        vehicleClass: text(row, 'Vehicle Class'),
        vehicleSize: oneOf<VehicleSize>(row, 'Vehicle Size', ['Small', 'Medsize', 'Large']),
      };
    } catch (error) {
      if (error instanceof RowFieldError) return err({ line, reason: error.message });
      throw error;
    }
    return createGoldenCase(text(row, 'Customer'), line, input, this.#limits);
  }
}
