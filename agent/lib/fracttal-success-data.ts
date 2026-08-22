// Synthetic Customer Success portfolio for the Fracttal interview MVP.
// No row represents an actual Fracttal customer. The dataset is deterministic
// so demo answers and evals remain reproducible.

export type Region = "LATAM" | "Iberia" | "Europe" | "North America";
export type Industry =
  | "Manufacturing"
  | "Food & Beverage"
  | "Facilities"
  | "Energy"
  | "Logistics"
  | "Mining"
  | "Healthcare";
export type SuccessSegment = "Protect Now" | "Accelerate Value" | "Expand" | "Scale";

export type CustomerAccount = {
  readonly accountId: string;
  readonly accountName: string;
  readonly region: Region;
  readonly country: string;
  readonly industry: Industry;
  readonly arrUsd: number;
  readonly renewalDate: string;
  readonly monthsLive: number;
  readonly contractedUsers: number;
  readonly activeUsers30d: number;
  readonly assetsManaged: number;
  readonly assetCoveragePct: number;
  readonly mobileAdoptionPct: number;
  readonly pmCompliancePct: number;
  readonly preventiveSharePct: number;
  readonly workOrderCompletionPct: number;
  readonly mttrImprovementPct: number;
  readonly downtimeReductionPct: number;
  readonly trainingCompletionPct: number;
  readonly integrationsLive: number;
  readonly integrationsPotential: number;
  readonly openTickets: number;
  readonly criticalTickets: number;
  readonly avgResolutionHours: number;
  readonly nps: number;
  readonly csat: number;
  readonly daysSinceExecTouch: number;
  readonly daysSinceQbr: number;
};

export type ScoredAccount = CustomerAccount & {
  readonly activeUserPct: number;
  readonly healthScore: number;
  readonly churnRisk: number;
  readonly valueRealizationScore: number;
  readonly expansionScore: number;
  readonly arrAtRiskUsd: number;
  readonly expansionPotentialUsd: number;
  readonly successSegment: SuccessSegment;
  readonly renewalDays: number;
  readonly valueProof: boolean;
};

const AS_OF_DATE = "2026-08-22";

const seeds: readonly CustomerAccount[] = [
  { accountId: "CS-001", accountName: "Andes Foods", region: "LATAM", country: "Colombia", industry: "Food & Beverage", arrUsd: 186000, renewalDate: "2026-11-18", monthsLive: 28, contractedUsers: 220, activeUsers30d: 78, assetsManaged: 3400, assetCoveragePct: 52, mobileAdoptionPct: 41, pmCompliancePct: 61, preventiveSharePct: 43, workOrderCompletionPct: 68, mttrImprovementPct: 7, downtimeReductionPct: 5, trainingCompletionPct: 46, integrationsLive: 1, integrationsPotential: 4, openTickets: 11, criticalTickets: 2, avgResolutionHours: 31, nps: -18, csat: 69, daysSinceExecTouch: 96, daysSinceQbr: 142 },
  { accountId: "CS-002", accountName: "Nova Manufacturing", region: "North America", country: "Mexico", industry: "Manufacturing", arrUsd: 248000, renewalDate: "2027-02-11", monthsLive: 34, contractedUsers: 310, activeUsers30d: 252, assetsManaged: 6800, assetCoveragePct: 91, mobileAdoptionPct: 84, pmCompliancePct: 92, preventiveSharePct: 76, workOrderCompletionPct: 94, mttrImprovementPct: 31, downtimeReductionPct: 27, trainingCompletionPct: 88, integrationsLive: 4, integrationsPotential: 5, openTickets: 2, criticalTickets: 0, avgResolutionHours: 5, nps: 61, csat: 94, daysSinceExecTouch: 18, daysSinceQbr: 42 },
  { accountId: "CS-003", accountName: "Iberia Facilities Group", region: "Iberia", country: "Spain", industry: "Facilities", arrUsd: 164000, renewalDate: "2026-10-04", monthsLive: 19, contractedUsers: 185, activeUsers30d: 137, assetsManaged: 9100, assetCoveragePct: 83, mobileAdoptionPct: 79, pmCompliancePct: 88, preventiveSharePct: 70, workOrderCompletionPct: 90, mttrImprovementPct: 22, downtimeReductionPct: 19, trainingCompletionPct: 76, integrationsLive: 3, integrationsPotential: 5, openTickets: 4, criticalTickets: 0, avgResolutionHours: 8, nps: 48, csat: 91, daysSinceExecTouch: 28, daysSinceQbr: 61 },
  { accountId: "CS-004", accountName: "Pacifica Logistics", region: "LATAM", country: "Chile", industry: "Logistics", arrUsd: 122000, renewalDate: "2026-09-27", monthsLive: 13, contractedUsers: 140, activeUsers30d: 51, assetsManaged: 2100, assetCoveragePct: 47, mobileAdoptionPct: 38, pmCompliancePct: 58, preventiveSharePct: 39, workOrderCompletionPct: 63, mttrImprovementPct: 4, downtimeReductionPct: 3, trainingCompletionPct: 39, integrationsLive: 0, integrationsPotential: 3, openTickets: 14, criticalTickets: 1, avgResolutionHours: 38, nps: -27, csat: 64, daysSinceExecTouch: 117, daysSinceQbr: 168 },
  { accountId: "CS-005", accountName: "Atlas Mining", region: "LATAM", country: "Peru", industry: "Mining", arrUsd: 315000, renewalDate: "2027-01-15", monthsLive: 31, contractedUsers: 280, activeUsers30d: 226, assetsManaged: 7400, assetCoveragePct: 88, mobileAdoptionPct: 86, pmCompliancePct: 89, preventiveSharePct: 73, workOrderCompletionPct: 91, mttrImprovementPct: 29, downtimeReductionPct: 25, trainingCompletionPct: 82, integrationsLive: 4, integrationsPotential: 7, openTickets: 5, criticalTickets: 0, avgResolutionHours: 7, nps: 55, csat: 92, daysSinceExecTouch: 21, daysSinceQbr: 49 },
  { accountId: "CS-006", accountName: "Nordic Energy Services", region: "Europe", country: "Sweden", industry: "Energy", arrUsd: 276000, renewalDate: "2026-12-22", monthsLive: 22, contractedUsers: 245, activeUsers30d: 162, assetsManaged: 5200, assetCoveragePct: 76, mobileAdoptionPct: 67, pmCompliancePct: 81, preventiveSharePct: 65, workOrderCompletionPct: 84, mttrImprovementPct: 18, downtimeReductionPct: 15, trainingCompletionPct: 68, integrationsLive: 2, integrationsPotential: 6, openTickets: 7, criticalTickets: 1, avgResolutionHours: 16, nps: 31, csat: 86, daysSinceExecTouch: 47, daysSinceQbr: 83 },
  { accountId: "CS-007", accountName: "MedCore Hospitals", region: "Iberia", country: "Portugal", industry: "Healthcare", arrUsd: 198000, renewalDate: "2026-11-02", monthsLive: 17, contractedUsers: 205, activeUsers30d: 119, assetsManaged: 4300, assetCoveragePct: 69, mobileAdoptionPct: 61, pmCompliancePct: 77, preventiveSharePct: 58, workOrderCompletionPct: 79, mttrImprovementPct: 13, downtimeReductionPct: 10, trainingCompletionPct: 63, integrationsLive: 2, integrationsPotential: 5, openTickets: 8, criticalTickets: 1, avgResolutionHours: 19, nps: 19, csat: 81, daysSinceExecTouch: 62, daysSinceQbr: 91 },
  { accountId: "CS-008", accountName: "Caribe Beverage Co", region: "LATAM", country: "Dominican Republic", industry: "Food & Beverage", arrUsd: 97000, renewalDate: "2027-03-09", monthsLive: 10, contractedUsers: 115, activeUsers30d: 72, assetsManaged: 1700, assetCoveragePct: 71, mobileAdoptionPct: 66, pmCompliancePct: 79, preventiveSharePct: 61, workOrderCompletionPct: 82, mttrImprovementPct: 16, downtimeReductionPct: 12, trainingCompletionPct: 70, integrationsLive: 1, integrationsPotential: 3, openTickets: 3, criticalTickets: 0, avgResolutionHours: 9, nps: 37, csat: 88, daysSinceExecTouch: 35, daysSinceQbr: 67 },
  { accountId: "CS-009", accountName: "Rhine Industrial", region: "Europe", country: "Germany", industry: "Manufacturing", arrUsd: 342000, renewalDate: "2026-10-29", monthsLive: 40, contractedUsers: 390, activeUsers30d: 174, assetsManaged: 8600, assetCoveragePct: 58, mobileAdoptionPct: 49, pmCompliancePct: 66, preventiveSharePct: 48, workOrderCompletionPct: 70, mttrImprovementPct: 8, downtimeReductionPct: 6, trainingCompletionPct: 52, integrationsLive: 2, integrationsPotential: 8, openTickets: 12, criticalTickets: 2, avgResolutionHours: 29, nps: -9, csat: 72, daysSinceExecTouch: 88, daysSinceQbr: 133 },
  { accountId: "CS-010", accountName: "Sierra Cement", region: "North America", country: "Mexico", industry: "Manufacturing", arrUsd: 229000, renewalDate: "2027-04-17", monthsLive: 26, contractedUsers: 260, activeUsers30d: 208, assetsManaged: 5900, assetCoveragePct: 87, mobileAdoptionPct: 82, pmCompliancePct: 90, preventiveSharePct: 74, workOrderCompletionPct: 92, mttrImprovementPct: 26, downtimeReductionPct: 23, trainingCompletionPct: 84, integrationsLive: 3, integrationsPotential: 6, openTickets: 3, criticalTickets: 0, avgResolutionHours: 6, nps: 52, csat: 93, daysSinceExecTouch: 24, daysSinceQbr: 51 },
  { accountId: "CS-011", accountName: "Benelux Property Ops", region: "Europe", country: "Netherlands", industry: "Facilities", arrUsd: 151000, renewalDate: "2027-01-31", monthsLive: 14, contractedUsers: 170, activeUsers30d: 124, assetsManaged: 7600, assetCoveragePct: 80, mobileAdoptionPct: 73, pmCompliancePct: 85, preventiveSharePct: 67, workOrderCompletionPct: 87, mttrImprovementPct: 20, downtimeReductionPct: 17, trainingCompletionPct: 78, integrationsLive: 2, integrationsPotential: 4, openTickets: 4, criticalTickets: 0, avgResolutionHours: 10, nps: 43, csat: 89, daysSinceExecTouch: 32, daysSinceQbr: 59 },
  { accountId: "CS-012", accountName: "Patagonia Cold Chain", region: "LATAM", country: "Argentina", industry: "Logistics", arrUsd: 139000, renewalDate: "2026-12-08", monthsLive: 16, contractedUsers: 155, activeUsers30d: 83, assetsManaged: 2600, assetCoveragePct: 62, mobileAdoptionPct: 55, pmCompliancePct: 72, preventiveSharePct: 54, workOrderCompletionPct: 75, mttrImprovementPct: 11, downtimeReductionPct: 8, trainingCompletionPct: 57, integrationsLive: 1, integrationsPotential: 4, openTickets: 9, criticalTickets: 1, avgResolutionHours: 23, nps: 8, csat: 77, daysSinceExecTouch: 71, daysSinceQbr: 106 },
  { accountId: "CS-013", accountName: "Lusitania Foods", region: "Iberia", country: "Portugal", industry: "Food & Beverage", arrUsd: 174000, renewalDate: "2027-05-06", monthsLive: 24, contractedUsers: 190, activeUsers30d: 156, assetsManaged: 3900, assetCoveragePct: 90, mobileAdoptionPct: 85, pmCompliancePct: 93, preventiveSharePct: 78, workOrderCompletionPct: 95, mttrImprovementPct: 33, downtimeReductionPct: 29, trainingCompletionPct: 91, integrationsLive: 4, integrationsPotential: 5, openTickets: 1, criticalTickets: 0, avgResolutionHours: 4, nps: 67, csat: 96, daysSinceExecTouch: 15, daysSinceQbr: 36 },
  { accountId: "CS-014", accountName: "Central Grid Services", region: "North America", country: "United States", industry: "Energy", arrUsd: 388000, renewalDate: "2026-09-19", monthsLive: 37, contractedUsers: 420, activeUsers30d: 236, assetsManaged: 10500, assetCoveragePct: 63, mobileAdoptionPct: 58, pmCompliancePct: 71, preventiveSharePct: 51, workOrderCompletionPct: 74, mttrImprovementPct: 10, downtimeReductionPct: 7, trainingCompletionPct: 59, integrationsLive: 3, integrationsPotential: 9, openTickets: 15, criticalTickets: 2, avgResolutionHours: 34, nps: -14, csat: 70, daysSinceExecTouch: 104, daysSinceQbr: 151 },
  { accountId: "CS-015", accountName: "Catalonia Transit", region: "Iberia", country: "Spain", industry: "Logistics", arrUsd: 207000, renewalDate: "2027-02-26", monthsLive: 20, contractedUsers: 230, activeUsers30d: 181, assetsManaged: 4700, assetCoveragePct: 85, mobileAdoptionPct: 81, pmCompliancePct: 87, preventiveSharePct: 69, workOrderCompletionPct: 89, mttrImprovementPct: 24, downtimeReductionPct: 21, trainingCompletionPct: 80, integrationsLive: 3, integrationsPotential: 6, openTickets: 3, criticalTickets: 0, avgResolutionHours: 7, nps: 50, csat: 92, daysSinceExecTouch: 26, daysSinceQbr: 54 },
  { accountId: "CS-016", accountName: "Andean Health Network", region: "LATAM", country: "Ecuador", industry: "Healthcare", arrUsd: 118000, renewalDate: "2026-10-12", monthsLive: 12, contractedUsers: 135, activeUsers30d: 61, assetsManaged: 2300, assetCoveragePct: 54, mobileAdoptionPct: 43, pmCompliancePct: 64, preventiveSharePct: 46, workOrderCompletionPct: 69, mttrImprovementPct: 6, downtimeReductionPct: 4, trainingCompletionPct: 44, integrationsLive: 0, integrationsPotential: 4, openTickets: 10, criticalTickets: 1, avgResolutionHours: 27, nps: -5, csat: 73, daysSinceExecTouch: 84, daysSinceQbr: 121 },
  { accountId: "CS-017", accountName: "Baltic Components", region: "Europe", country: "Poland", industry: "Manufacturing", arrUsd: 191000, renewalDate: "2027-06-20", monthsLive: 18, contractedUsers: 210, activeUsers30d: 148, assetsManaged: 4100, assetCoveragePct: 79, mobileAdoptionPct: 72, pmCompliancePct: 84, preventiveSharePct: 66, workOrderCompletionPct: 86, mttrImprovementPct: 19, downtimeReductionPct: 16, trainingCompletionPct: 74, integrationsLive: 2, integrationsPotential: 5, openTickets: 5, criticalTickets: 0, avgResolutionHours: 11, nps: 41, csat: 88, daysSinceExecTouch: 37, daysSinceQbr: 64 },
  { accountId: "CS-018", accountName: "Gulf Process Industries", region: "North America", country: "United States", industry: "Manufacturing", arrUsd: 271000, renewalDate: "2027-03-28", monthsLive: 21, contractedUsers: 295, activeUsers30d: 223, assetsManaged: 6200, assetCoveragePct: 86, mobileAdoptionPct: 79, pmCompliancePct: 89, preventiveSharePct: 71, workOrderCompletionPct: 91, mttrImprovementPct: 25, downtimeReductionPct: 22, trainingCompletionPct: 81, integrationsLive: 3, integrationsPotential: 7, openTickets: 4, criticalTickets: 0, avgResolutionHours: 8, nps: 49, csat: 91, daysSinceExecTouch: 29, daysSinceQbr: 57 },
  { accountId: "CS-019", accountName: "Amazonia Minerals", region: "LATAM", country: "Brazil", industry: "Mining", arrUsd: 293000, renewalDate: "2026-12-14", monthsLive: 29, contractedUsers: 320, activeUsers30d: 191, assetsManaged: 8300, assetCoveragePct: 73, mobileAdoptionPct: 62, pmCompliancePct: 78, preventiveSharePct: 59, workOrderCompletionPct: 80, mttrImprovementPct: 15, downtimeReductionPct: 13, trainingCompletionPct: 65, integrationsLive: 2, integrationsPotential: 7, openTickets: 8, criticalTickets: 1, avgResolutionHours: 17, nps: 22, csat: 83, daysSinceExecTouch: 54, daysSinceQbr: 88 },
  { accountId: "CS-020", accountName: "Alpine Facility Systems", region: "Europe", country: "Switzerland", industry: "Facilities", arrUsd: 233000, renewalDate: "2027-07-08", monthsLive: 27, contractedUsers: 255, activeUsers30d: 218, assetsManaged: 9800, assetCoveragePct: 94, mobileAdoptionPct: 89, pmCompliancePct: 95, preventiveSharePct: 80, workOrderCompletionPct: 96, mttrImprovementPct: 36, downtimeReductionPct: 31, trainingCompletionPct: 93, integrationsLive: 5, integrationsPotential: 6, openTickets: 1, criticalTickets: 0, avgResolutionHours: 3, nps: 72, csat: 97, daysSinceExecTouch: 12, daysSinceQbr: 31 },
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
function round1(value: number): number { return Math.round(value * 10) / 10; }
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

function score(account: CustomerAccount): ScoredAccount {
  const activeUserPct = account.contractedUsers === 0 ? 0 : (account.activeUsers30d / account.contractedUsers) * 100;
  const adoption = 0.25 * activeUserPct + 0.2 * account.assetCoveragePct + 0.2 * account.mobileAdoptionPct + 0.2 * account.trainingCompletionPct + 0.15 * Math.min(100, (account.integrationsLive / Math.max(1, account.integrationsPotential)) * 100);
  const operationalValue = 0.28 * account.pmCompliancePct + 0.22 * account.preventiveSharePct + 0.2 * account.workOrderCompletionPct + 0.15 * clamp(account.mttrImprovementPct * 2.5) + 0.15 * clamp(account.downtimeReductionPct * 2.8);
  const friction = clamp(100 - (account.criticalTickets * 16 + account.openTickets * 2.1 + account.avgResolutionHours * 0.7));
  const relationship = clamp(0.35 * ((account.nps + 100) / 2) + 0.3 * account.csat + 0.2 * (100 - Math.min(100, account.daysSinceExecTouch)) + 0.15 * (100 - Math.min(100, account.daysSinceQbr)));
  const healthScore = clamp(0.32 * adoption + 0.3 * operationalValue + 0.2 * friction + 0.18 * relationship);
  const renewalDays = daysBetween(AS_OF_DATE, account.renewalDate);
  const renewalPressure = renewalDays <= 45 ? 18 : renewalDays <= 90 ? 10 : renewalDays <= 150 ? 5 : 0;
  const churnRisk = clamp(100 - healthScore + renewalPressure + (account.criticalTickets > 0 ? 5 : 0));
  const valueRealizationScore = clamp(operationalValue);
  const whitespace = Math.max(0, account.integrationsPotential - account.integrationsLive) / Math.max(1, account.integrationsPotential);
  const expansionScore = clamp(0.38 * healthScore + 0.27 * operationalValue + 0.2 * account.assetCoveragePct + 0.15 * whitespace * 100);
  const arrAtRiskUsd = Math.round(account.arrUsd * (churnRisk / 100));
  const expansionPotentialUsd = Math.round(account.arrUsd * 0.35 * (expansionScore / 100));
  const valueProof = operationalValue >= 78 && account.downtimeReductionPct >= 15 && account.pmCompliancePct >= 80;
  const highArr = account.arrUsd >= 180000;
  const highRisk = churnRisk >= 45;
  const successSegment: SuccessSegment = highRisk && highArr ? "Protect Now" : healthScore < 68 || !valueProof ? "Accelerate Value" : expansionScore >= 72 ? "Expand" : "Scale";
  return { ...account, activeUserPct: round1(activeUserPct), healthScore: round1(healthScore), churnRisk: round1(churnRisk), valueRealizationScore: round1(valueRealizationScore), expansionScore: round1(expansionScore), arrAtRiskUsd, expansionPotentialUsd, successSegment, renewalDays, valueProof };
}

let cached: readonly ScoredAccount[] | null = null;
export function getScoredAccounts(): readonly ScoredAccount[] {
  if (!cached) cached = seeds.map(score);
  return cached;
}

export function getPortfolioSnapshot() {
  const accounts = getScoredAccounts();
  const totalArrUsd = accounts.reduce((s, a) => s + a.arrUsd, 0);
  const arrAtRiskUsd = accounts.reduce((s, a) => s + a.arrAtRiskUsd, 0);
  const expansionPotentialUsd = accounts.reduce((s, a) => s + a.expansionPotentialUsd, 0);
  const avgHealthScore = round1(accounts.reduce((s, a) => s + a.healthScore, 0) / accounts.length);
  const valueProofPct = round1((accounts.filter((a) => a.valueProof).length / accounts.length) * 100);
  const renewals90d = accounts.filter((a) => a.renewalDays >= 0 && a.renewalDays <= 90);
  const renewalArr90dUsd = renewals90d.reduce((s, a) => s + a.arrUsd, 0);
  const protectedRenewalArr90dUsd = renewals90d.filter((a) => a.churnRisk < 45).reduce((s, a) => s + a.arrUsd, 0);
  const renewalCoveragePct = renewalArr90dUsd === 0 ? 100 : round1((protectedRenewalArr90dUsd / renewalArr90dUsd) * 100);
  return { asOfDate: AS_OF_DATE, accounts: accounts.length, totalArrUsd, avgHealthScore, arrAtRiskUsd, expansionPotentialUsd, valueProofPct, renewalCoveragePct, renewalArr90dUsd };
}

export function getDashboardSnapshot() {
  const current = getPortfolioSnapshot();
  // A deterministic prior-period baseline purely for visual trend context.
  const prior = { avgHealthScore: round1(current.avgHealthScore - 2.8), arrAtRiskUsd: Math.round(current.arrAtRiskUsd * 1.09), valueProofPct: round1(Math.max(0, current.valueProofPct - 10)), expansionPotentialUsd: Math.round(current.expansionPotentialUsd * 0.91) };
  const comparisons = [
    { metric: "avgHealthScore", current: current.avgHealthScore, previous: prior.avgHealthScore, format: "score" },
    { metric: "arrAtRiskUsd", current: current.arrAtRiskUsd, previous: prior.arrAtRiskUsd, format: "usd" },
    { metric: "valueProofPct", current: current.valueProofPct, previous: prior.valueProofPct, format: "pct" },
    { metric: "expansionPotentialUsd", current: current.expansionPotentialUsd, previous: prior.expansionPotentialUsd, format: "usd" },
  ] as const;
  return { current, prior, comparisons };
}

export const SUCCESS_DEFINITIONS = {
  healthScore: "0-100 composite of adoption, operational value, support friction, and executive relationship signals.",
  churnRisk: "0-100 intervention priority derived from inverse health plus renewal proximity and critical support friction; it is a demo heuristic, not a production churn model.",
  arrAtRiskUsd: "ARR weighted by the account churn-risk heuristic. Use for portfolio prioritization, not accounting guidance.",
  valueRealizationScore: "0-100 evidence of maintenance outcomes: preventive compliance, work-order completion, MTTR improvement, and downtime reduction.",
  expansionScore: "0-100 expansion readiness based on health, realized value, asset coverage, and integration whitespace.",
  valueProof: "True when the account has strong preventive compliance plus material downtime improvement and overall operational-value evidence.",
} as const;
