import { err, ok, type Result } from '#shared/result.js';
import type { DatasetError } from './dataset-error.js';
import { deriveHighRisk, type HighRiskLimits } from './high-risk.js';

export type Coverage = 'Basic' | 'Extended' | 'Premium';
export type LocationKind = 'Rural' | 'Suburban' | 'Urban';
export type PolicyType = 'Corporate Auto' | 'Personal Auto' | 'Special Auto';
export type VehicleSize = 'Small' | 'Medsize' | 'Large';
export type Gender = 'F' | 'M';

/** Dados do sinistro enviados à IA. Não contém identificador nem gabarito. */
export type ClaimInput = {
  readonly state: string;
  readonly customerLifetimeValue: number;
  readonly coverage: Coverage;
  readonly education: string;
  readonly effectiveToDate: string;
  readonly employmentStatus: string;
  readonly gender: Gender;
  readonly income: number;
  readonly location: LocationKind;
  readonly maritalStatus: string;
  readonly monthlyPremium: number;
  readonly monthsSinceLastClaim: number;
  readonly monthsSincePolicyInception: number;
  readonly openComplaints: number;
  readonly numberOfPolicies: number;
  readonly policyType: PolicyType;
  readonly policy: string;
  readonly renewOfferType: number;
  readonly salesChannel: string;
  readonly claimAmount: number;
  readonly vehicleClass: string;
  readonly vehicleSize: VehicleSize;
};

/** Gabarito oculto. Nunca é enviado à IA. */
export type ExpectedOutcome = {
  readonly isHighRisk: boolean;
  readonly claimAmount: number;
};

export type GoldenCase = {
  readonly id: string;
  readonly line: number;
  readonly input: ClaimInput;
  readonly expected: ExpectedOutcome;
};

export const createGoldenCase = (
  id: string,
  line: number,
  input: ClaimInput,
  limits: HighRiskLimits,
): Result<GoldenCase, DatasetError> => {
  if (id.trim() === '') return err({ line, reason: 'customer id is empty' });
  if (!(input.claimAmount > 0)) return err({ line, reason: 'claim amount must be > 0' });
  if (!(input.monthlyPremium > 0)) return err({ line, reason: 'monthly premium must be > 0' });
  if (!(input.openComplaints >= 0)) return err({ line, reason: 'open complaints must be >= 0' });

  return ok({
    id,
    line,
    input,
    expected: {
      isHighRisk: deriveHighRisk(input.openComplaints, input.claimAmount, input.monthlyPremium, limits),
      claimAmount: input.claimAmount,
    },
  });
};
