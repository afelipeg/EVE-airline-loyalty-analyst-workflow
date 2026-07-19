// Doctrine: ASK is FIXED network capacity; loyalty moves RPK/load factor/yield/RASK — never ASK.
//
// Deterministic synthetic Aeromexico Club Premier dataset. Five sources joined on
// memberId ("CP" + 8 digits): crmMembers, cdpProfiles, loyaltyAccounts, bookings
// (generated with a constant-seeded mulberry32 PRNG, never Math.random), and the
// fixed networkCapacity anchor table. Everything here is reproducible run-to-run.

export type Tier = "Clasico" | "Plata" | "Oro" | "Platino" | "Titanio";
export type HomeHub = "MEX" | "GDL" | "MTY";
export type Cabin = "Economy" | "AM Plus" | "Premier";
export type Channel = "app" | "web" | "call_center" | "ota";
export type NpsSegment = "promoter" | "passive" | "detractor";
export type PredictedChannel = "email" | "push" | "app";
export type CobrandCard = "none" | "Santander" | "AmEx";
export type MemberSegment = "Retencion Prioritaria" | "Embajadores" | "En Riesgo" | "Base";

export type CrmMember = {
  readonly memberId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly homeHub: HomeHub;
  readonly enrollmentDate: string;
  readonly tierSince: string;
  readonly tier: Tier;
  readonly corporateAccount: string | null;
  readonly preferredCabin: Cabin;
  readonly serviceCases12m: number;
  readonly csat: number;
};

export type CdpProfile = {
  readonly memberId: string;
  readonly appInstalled: boolean;
  readonly emailOptIn: boolean;
  readonly pushOptIn: boolean;
  readonly lastLoginDays: number;
  readonly emailOpenRate90d: number;
  readonly webSessions90d: number;
  readonly npsSegment: NpsSegment;
  readonly predictedChannel: PredictedChannel;
  readonly marketingSegment: string;
};

export type LoyaltyAccount = {
  readonly memberId: string;
  readonly pointsBalance: number;
  readonly pointsEarned12m: number;
  readonly pointsRedeemed12m: number;
  readonly redemptions12m: number;
  readonly cobrandCard: CobrandCard;
  readonly cardSpend12mMxn: number;
  readonly clvMxn: number;
  readonly statusQualifyingSegmentsYtd: number;
};

export type Booking = {
  readonly bookingId: string;
  readonly memberId: string;
  readonly flightDate: string;
  readonly route: string;
  readonly distanceKm: number;
  readonly cabin: Cabin;
  readonly fareClass: string;
  readonly fareMxn: number;
  readonly ancillaryMxn: number;
  readonly seats: number;
  readonly isAward: boolean;
  readonly bookedChannel: Channel;
};

export type RouteCapacity = {
  readonly route: string;
  readonly distanceKm: number;
  readonly ask12mMillions: number;
  readonly blendedRaskTargetMxn: number;
};

export type BookingRollup = {
  readonly rpk12m: number;
  readonly paidRpk: number;
  readonly awardRpk: number;
  readonly passengerRevenue12mMxn: number;
  readonly ancillary12mMxn: number;
  readonly segments12m: number;
  readonly awardSegments12m: number;
  readonly routesFlown: readonly string[];
  readonly lastFlightDate: string | null;
  readonly daysSinceLastFlight: number;
  readonly avgYieldMxnPerKm: number;
};

export type MemberScore = {
  readonly valueScore: number;
  readonly churnRisk: number;
  readonly segment: MemberSegment;
  readonly raskAtRiskMxn: number;
};

export type UnifiedMemberBase = CrmMember &
  Omit<CdpProfile, "memberId"> &
  Omit<LoyaltyAccount, "memberId"> &
  BookingRollup;

export type UnifiedMember = UnifiedMemberBase & MemberScore;

export type RouteSnapshot = {
  readonly route: string;
  readonly distanceKm: number;
  readonly askMillions: number;
  readonly rpkMillions: number;
  readonly loadFactor: number;
  readonly passengerRevenueMxn: number;
  readonly ancillaryMxn: number;
  readonly raskMxn: number;
  readonly segments: number;
};

export type TierSnapshot = {
  readonly tier: Tier;
  readonly members: number;
  readonly avgValueScore: number;
  readonly avgChurnRisk: number;
  readonly raskAtRiskMxn: number;
  readonly totalClvMxn: number;
};

export type NetworkSnapshot = {
  readonly askMillions: number;
  readonly rpkMillions: number;
  readonly loadFactor: number;
  readonly raskMxn: number;
  readonly yieldMxnPerKm: number;
  readonly ancillaryShare: number;
  readonly byRoute: readonly RouteSnapshot[];
  readonly byTier: readonly TierSnapshot[];
};

const TODAY = "2026-07-18";

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toMemberId(seq: number): string {
  return `CP${String(10_000_000 + seq).padStart(8, "0")}`;
}

function toEmail(firstName: string, lastName: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");
  return `${slug(firstName)}.${slug(lastName)}@clubpremier-demo.mx`;
}

// --- CRM: crmMembers ---------------------------------------------------

type CrmSeed = readonly [
  seq: number,
  firstName: string,
  lastName: string,
  homeHub: HomeHub,
  enrollmentDate: string,
  tierSince: string,
  tier: Tier,
  corporateAccount: string | null,
  preferredCabin: Cabin,
  serviceCases12m: number,
  csat: number,
];

const crmSeeds: readonly CrmSeed[] = [
  [1, "Alejandro", "García", "MEX", "2015-03-12", "2023-01-10", "Titanio", "Femsa", "Premier", 1, 92],
  [2, "María", "Hernández", "MEX", "2014-11-05", "2022-06-01", "Titanio", null, "Premier", 0, 95],
  [3, "Carlos", "Ramírez", "GDL", "2016-02-20", "2024-02-15", "Titanio", "Bimbo", "Premier", 2, 88],
  [4, "Fernanda", "Martínez", "MEX", "2013-07-08", "2021-09-20", "Platino", null, "Premier", 1, 90],
  [5, "Luis", "López", "MTY", "2017-05-30", "2023-11-01", "Platino", "Cemex", "AM Plus", 0, 93],
  [6, "Guadalupe", "González", "MEX", "2018-01-15", "2024-03-01", "Platino", null, "Premier", 3, 78],
  [7, "José", "Pérez", "MEX", "2012-09-22", "2020-05-10", "Platino", null, "AM Plus", 1, 85],
  [8, "Verónica", "Sánchez", "GDL", "2019-04-18", "2025-01-05", "Platino", "Bimbo", "Premier", 2, 81],
  [9, "Ricardo", "Flores", "MEX", "2015-12-01", "2023-07-19", "Oro", null, "AM Plus", 1, 87],
  [10, "Patricia", "Torres", "MEX", "2016-08-14", "2024-01-22", "Oro", null, "Economy", 2, 76],
  [11, "Fernando", "Rivera", "MTY", "2014-03-09", "2022-10-11", "Oro", "Cemex", "AM Plus", 0, 91],
  [12, "Laura", "Gómez", "MEX", "2020-02-25", "2025-04-02", "Oro", null, "Economy", 3, 70],
  [13, "Roberto", "Díaz", "GDL", "2017-11-11", "2023-09-09", "Oro", null, "AM Plus", 1, 84],
  [14, "Ana", "Cruz", "MEX", "2013-06-06", "2021-12-19", "Oro", "Grupo Modelo", "Economy", 2, 79],
  [15, "Jorge", "Morales", "MEX", "2018-09-29", "2024-06-14", "Oro", null, "AM Plus", 0, 89],
  [16, "Sofía", "Reyes", "MTY", "2019-01-02", "2024-11-03", "Oro", null, "Economy", 4, 65],
  [17, "Eduardo", "Jiménez", "MEX", "2016-04-17", "2023-03-08", "Oro", null, "AM Plus", 1, 86],
  [18, "Daniela", "Ortiz", "MEX", "2015-10-23", "2022-08-27", "Oro", null, "Economy", 2, 74],
  [19, "Sergio", "Chávez", "GDL", "2021-03-15", "2025-02-10", "Plata", null, "Economy", 3, 68],
  [20, "Claudia", "Romero", "MEX", "2017-07-19", "2023-05-05", "Plata", null, "Economy", 1, 82],
  [21, "Pablo", "Vázquez", "MEX", "2020-05-12", "2024-09-18", "Plata", null, "Economy", 2, 77],
  [22, "Alejandra", "Mendoza", "MTY", "2019-08-08", "2024-04-21", "Plata", null, "AM Plus", 0, 90],
  [23, "Diego", "Ruiz", "MEX", "2018-12-03", "2023-12-30", "Plata", null, "Economy", 3, 71],
  [24, "Gabriela", "Álvarez", "MEX", "2021-06-27", "2025-05-11", "Plata", null, "Economy", 1, 80],
  [25, "Raúl", "Castillo", "GDL", "2016-10-10", "2023-02-14", "Plata", null, "Economy", 4, 63],
  [26, "Mónica", "Juárez", "MEX", "2019-02-14", "2024-07-07", "Plata", null, "AM Plus", 2, 75],
  [27, "Óscar", "Herrera", "MEX", "2020-09-01", "2024-12-24", "Plata", null, "Economy", 1, 83],
  [28, "Adriana", "Guzmán", "MTY", "2018-05-05", "2023-10-16", "Plata", null, "Economy", 2, 72],
  [29, "Manuel", "Vargas", "MEX", "2022-01-20", "2025-06-01", "Plata", null, "Economy", 0, 88],
  [30, "Paola", "Contreras", "MEX", "2017-03-28", "2023-04-19", "Plata", null, "Economy", 3, 66],
  [31, "Rafael", "Delgado", "GDL", "2021-11-09", "2025-03-27", "Clasico", null, "Economy", 1, 79],
  [32, "Karla", "Aguilar", "MEX", "2022-04-04", "2025-08-15", "Clasico", null, "Economy", 0, 85],
  [33, "Andrés", "Medina", "MEX", "2020-07-16", "2024-05-30", "Clasico", null, "Economy", 2, 70],
  [34, "Elena", "Salazar", "MTY", "2023-02-08", "2025-09-12", "Clasico", null, "Economy", 1, 81],
  [35, "Francisco", "Núñez", "MEX", "2019-09-19", "2024-02-28", "Clasico", null, "Economy", 3, 62],
  [36, "Rosa", "Bautista", "GDL", "2021-01-25", "2024-10-05", "Clasico", null, "Economy", 0, 87],
  [37, "Miguel", "Espinoza", "MEX", "2022-08-30", "2025-07-22", "Clasico", null, "Economy", 2, 73],
  [38, "Lucía", "Fuentes", "MEX", "2020-12-12", "2024-08-09", "Clasico", null, "Economy", 1, 84],
  [39, "Alberto", "Peña", "MTY", "2023-05-05", "2025-10-30", "Clasico", null, "Economy", 4, 60],
  [40, "Valeria", "Cárdenas", "MEX", "2021-08-08", "2024-11-17", "Clasico", null, "Economy", 0, 92],
];

export const crmMembers: readonly CrmMember[] = crmSeeds.map(
  ([
    seq,
    firstName,
    lastName,
    homeHub,
    enrollmentDate,
    tierSince,
    tier,
    corporateAccount,
    preferredCabin,
    serviceCases12m,
    csat,
  ]) => ({
    memberId: toMemberId(seq),
    firstName,
    lastName,
    email: toEmail(firstName, lastName),
    homeHub,
    enrollmentDate,
    tierSince,
    tier,
    corporateAccount,
    preferredCabin,
    serviceCases12m,
    csat,
  }),
);

// --- CDP: cdpProfiles ----------------------------------------------------

type CdpSeed = readonly [
  seq: number,
  appInstalled: boolean,
  emailOptIn: boolean,
  pushOptIn: boolean,
  lastLoginDays: number,
  emailOpenRate90d: number,
  webSessions90d: number,
  npsSegment: NpsSegment,
  predictedChannel: PredictedChannel,
  marketingSegment: string,
];

const cdpSeeds: readonly CdpSeed[] = [
  [1, true, true, true, 2, 0.72, 40, "promoter", "app", "Corporate Traveler"],
  [2, true, true, true, 1, 0.8, 55, "promoter", "app", "Frequent Business"],
  [3, true, true, false, 5, 0.65, 30, "promoter", "email", "Corporate Traveler"],
  [4, true, true, true, 3, 0.75, 38, "promoter", "app", "Frequent Business"],
  [5, true, true, true, 4, 0.68, 33, "promoter", "app", "Corporate Traveler"],
  [6, false, true, false, 95, 0.22, 4, "detractor", "email", "Dormant Elite"],
  [7, true, true, false, 12, 0.55, 20, "passive", "email", "Loyal Commuter"],
  [8, true, false, false, 60, 0.3, 8, "detractor", "push", "Dormant Elite"],
  [9, true, true, true, 8, 0.6, 25, "promoter", "app", "Frequent Business"],
  [10, true, false, false, 40, 0.38, 10, "passive", "email", "Leisure Family"],
  [11, true, true, true, 6, 0.63, 28, "promoter", "app", "Corporate Traveler"],
  [12, false, true, false, 70, 0.25, 5, "detractor", "email", "Occasional Flyer"],
  [13, true, true, false, 15, 0.5, 18, "passive", "push", "Digital Native"],
  [14, true, true, true, 10, 0.58, 22, "promoter", "app", "Corporate Traveler"],
  [15, true, true, true, 9, 0.61, 24, "promoter", "app", "Frequent Business"],
  [16, false, false, false, 110, 0.15, 2, "detractor", "email", "Dormant Elite"],
  [17, true, true, false, 18, 0.48, 16, "passive", "push", "Digital Native"],
  [18, true, false, false, 45, 0.35, 9, "passive", "email", "Leisure Family"],
  [19, true, true, true, 20, 0.44, 14, "passive", "app", "Digital Native"],
  [20, true, true, false, 25, 0.42, 12, "passive", "email", "Leisure Family"],
  [21, false, true, false, 55, 0.28, 6, "detractor", "email", "Occasional Flyer"],
  [22, true, true, true, 14, 0.52, 17, "promoter", "app", "Leisure Family"],
  [23, true, false, false, 50, 0.3, 7, "detractor", "email", "Occasional Flyer"],
  [24, true, true, false, 22, 0.4, 11, "passive", "push", "Digital Native"],
  [25, false, false, false, 120, 0.12, 2, "detractor", "email", "Occasional Flyer"],
  [26, true, true, true, 17, 0.46, 15, "passive", "app", "Leisure Family"],
  [27, true, true, false, 19, 0.45, 13, "passive", "email", "Digital Native"],
  [28, true, false, false, 48, 0.33, 8, "detractor", "email", "Occasional Flyer"],
  [29, true, true, true, 6, 0.66, 26, "promoter", "app", "Young Explorer"],
  [30, false, true, false, 65, 0.24, 4, "detractor", "email", "Occasional Flyer"],
  [31, true, true, false, 30, 0.36, 9, "passive", "email", "Young Explorer"],
  [32, true, true, true, 10, 0.55, 19, "promoter", "app", "Young Explorer"],
  [33, false, false, false, 90, 0.18, 3, "detractor", "email", "Occasional Flyer"],
  [34, true, true, false, 28, 0.38, 10, "passive", "push", "New Enrollee"],
  [35, true, false, false, 75, 0.2, 3, "detractor", "email", "Occasional Flyer"],
  [36, true, true, true, 8, 0.58, 21, "promoter", "app", "New Enrollee"],
  [37, false, true, false, 60, 0.27, 5, "detractor", "email", "Occasional Flyer"],
  [38, true, true, false, 20, 0.44, 12, "passive", "email", "Young Explorer"],
  [39, true, false, false, 100, 0.14, 2, "detractor", "email", "Occasional Flyer"],
  [40, true, true, true, 4, 0.7, 27, "promoter", "app", "New Enrollee"],
];

export const cdpProfiles: readonly CdpProfile[] = cdpSeeds.map(
  ([
    seq,
    appInstalled,
    emailOptIn,
    pushOptIn,
    lastLoginDays,
    emailOpenRate90d,
    webSessions90d,
    npsSegment,
    predictedChannel,
    marketingSegment,
  ]) => ({
    memberId: toMemberId(seq),
    appInstalled,
    emailOptIn,
    pushOptIn,
    lastLoginDays,
    emailOpenRate90d,
    webSessions90d,
    npsSegment,
    predictedChannel,
    marketingSegment,
  }),
);

// --- Loyalty: loyaltyAccounts -------------------------------------------

type LoyaltySeed = readonly [
  seq: number,
  pointsBalance: number,
  pointsEarned12m: number,
  pointsRedeemed12m: number,
  redemptions12m: number,
  cobrandCard: CobrandCard,
  cardSpend12mMxn: number,
  clvMxn: number,
  statusQualifyingSegmentsYtd: number,
];

const loyaltySeeds: readonly LoyaltySeed[] = [
  [1, 185_000, 220_000, 140_000, 5, "AmEx", 165_000, 380_000, 58],
  [2, 210_000, 240_000, 150_000, 6, "Santander", 140_000, 410_000, 62],
  [3, 95_000, 190_000, 160_000, 4, "AmEx", 120_000, 300_000, 50],
  [4, 140_000, 175_000, 110_000, 4, "Santander", 95_000, 240_000, 44],
  [5, 120_000, 160_000, 90_000, 3, "AmEx", 88_000, 210_000, 40],
  [6, 260_000, 60_000, 15_000, 1, "Santander", 70_000, 300_000, 18],
  [7, 88_000, 130_000, 70_000, 3, "none", 0, 165_000, 34],
  [8, 175_000, 55_000, 10_000, 1, "Santander", 95_000, 315_000, 15],
  [9, 60_000, 95_000, 55_000, 2, "none", 0, 120_000, 28],
  [10, 40_000, 62_000, 30_000, 2, "none", 0, 85_000, 20],
  [11, 70_000, 105_000, 60_000, 3, "AmEx", 60_000, 140_000, 32],
  [12, 35_000, 40_000, 12_000, 1, "none", 0, 70_000, 12],
  [13, 55_000, 85_000, 45_000, 2, "none", 0, 110_000, 25],
  [14, 65_000, 100_000, 58_000, 3, "Santander", 45_000, 130_000, 30],
  [15, 58_000, 90_000, 50_000, 2, "none", 0, 115_000, 27],
  [16, 48_000, 30_000, 5_000, 0, "none", 0, 60_000, 6],
  [17, 52_000, 80_000, 42_000, 2, "none", 0, 100_000, 23],
  [18, 38_000, 55_000, 25_000, 1, "none", 0, 78_000, 17],
  [19, 22_000, 32_000, 14_000, 1, "none", 0, 42_000, 10],
  [20, 28_000, 40_000, 18_000, 2, "none", 0, 50_000, 13],
  [21, 18_000, 20_000, 6_000, 1, "none", 0, 32_000, 7],
  [22, 30_000, 45_000, 22_000, 2, "Santander", 25_000, 55_000, 14],
  [23, 15_000, 18_000, 5_000, 0, "none", 0, 28_000, 5],
  [24, 25_000, 36_000, 16_000, 1, "none", 0, 46_000, 11],
  [25, 12_000, 10_000, 2_000, 0, "none", 0, 20_000, 3],
  [26, 26_000, 38_000, 17_000, 1, "none", 0, 48_000, 12],
  [27, 24_000, 35_000, 15_000, 1, "none", 0, 44_000, 10],
  [28, 14_000, 16_000, 4_000, 0, "none", 0, 26_000, 5],
  [29, 20_000, 30_000, 12_000, 1, "none", 0, 38_000, 9],
  [30, 10_000, 8_000, 1_500, 0, "none", 0, 18_000, 2],
  [31, 6_000, 9_000, 3_000, 1, "none", 0, 14_000, 4],
  [32, 8_000, 14_000, 6_000, 1, "none", 0, 18_000, 6],
  [33, 3_000, 3_000, 500, 0, "none", 0, 7_000, 1],
  [34, 5_000, 8_000, 2_500, 0, "none", 0, 12_000, 3],
  [35, 2_500, 2_500, 400, 0, "none", 0, 6_000, 1],
  [36, 7_000, 12_000, 5_000, 1, "none", 0, 16_000, 5],
  [37, 2_000, 2_000, 300, 0, "none", 0, 5_000, 1],
  [38, 5_500, 9_000, 3_500, 1, "none", 0, 13_000, 3],
  [39, 1_500, 1_500, 200, 0, "none", 0, 4_000, 0],
  [40, 6_500, 11_000, 4_500, 1, "none", 0, 15_000, 4],
];

export const loyaltyAccounts: readonly LoyaltyAccount[] = loyaltySeeds.map(
  ([
    seq,
    pointsBalance,
    pointsEarned12m,
    pointsRedeemed12m,
    redemptions12m,
    cobrandCard,
    cardSpend12mMxn,
    clvMxn,
    statusQualifyingSegmentsYtd,
  ]) => ({
    memberId: toMemberId(seq),
    pointsBalance,
    pointsEarned12m,
    pointsRedeemed12m,
    redemptions12m,
    cobrandCard,
    cardSpend12mMxn,
    clvMxn,
    statusQualifyingSegmentsYtd,
  }),
);

// --- Network capacity anchor (fixed, never derived from members) --------

export const networkCapacity: readonly RouteCapacity[] = [
  { route: "MEX-GDL", distanceKm: 460, ask12mMillions: 0.065, blendedRaskTargetMxn: 1.85 },
  { route: "MEX-MTY", distanceKm: 710, ask12mMillions: 0.09, blendedRaskTargetMxn: 1.7 },
  { route: "MEX-CUN", distanceKm: 1290, ask12mMillions: 0.14, blendedRaskTargetMxn: 1.55 },
  { route: "MEX-TIJ", distanceKm: 2280, ask12mMillions: 0.16, blendedRaskTargetMxn: 1.2 },
  { route: "MEX-LAX", distanceKm: 2490, ask12mMillions: 0.18, blendedRaskTargetMxn: 1.15 },
  { route: "MEX-JFK", distanceKm: 3360, ask12mMillions: 0.195, blendedRaskTargetMxn: 1.05 },
  { route: "MEX-BOG", distanceKm: 3160, ask12mMillions: 0.14, blendedRaskTargetMxn: 0.95 },
  { route: "MEX-GRU", distanceKm: 7440, ask12mMillions: 0.225, blendedRaskTargetMxn: 0.8 },
  { route: "MEX-MAD", distanceKm: 9070, ask12mMillions: 0.205, blendedRaskTargetMxn: 0.75 },
  { route: "MTY-IAH", distanceKm: 780, ask12mMillions: 0.045, blendedRaskTargetMxn: 1.6 },
  { route: "GDL-LAX", distanceKm: 2230, ask12mMillions: 0.1, blendedRaskTargetMxn: 1.1 },
];

// --- Bookings: deterministic mulberry32 PRNG, never Math.random ---------

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function weightedPick<T>(rng: () => number, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return items[index];
  }
  return items[items.length - 1];
}

const BOOKING_SEED = 88_172_645;
const BOOKING_COUNT = 500;

const TIER_BOOKING_WEIGHT: Record<Tier, number> = {
  Clasico: 1,
  Plata: 2,
  Oro: 4,
  Platino: 7,
  Titanio: 10,
};

// Cabin probability by tier: [Premier, AM Plus, Economy].
const CABIN_PROBABILITY: Record<Tier, readonly [number, number, number]> = {
  Titanio: [0.55, 0.35, 0.1],
  Platino: [0.35, 0.4, 0.25],
  Oro: [0.1, 0.4, 0.5],
  Plata: [0.02, 0.23, 0.75],
  Clasico: [0, 0.1, 0.9],
};

const AWARD_PROBABILITY: Record<Tier, number> = {
  Titanio: 0.3,
  Platino: 0.22,
  Oro: 0.15,
  Plata: 0.08,
  Clasico: 0.04,
};

const FARE_CLASSES: Record<Cabin, readonly string[]> = {
  Economy: ["Y", "B", "M", "H", "Q"],
  "AM Plus": ["W", "S"],
  Premier: ["J", "C", "D"],
};

const YIELD_MXN_PER_KM: Record<Cabin, number> = {
  Economy: 2.3,
  "AM Plus": 3.6,
  Premier: 6.5,
};

const ANCILLARY_RANGE_MXN: Record<Cabin, readonly [number, number]> = {
  Economy: [150, 600],
  "AM Plus": [300, 900],
  Premier: [500, 1800],
};

const CHANNELS: readonly Channel[] = ["app", "web", "call_center", "ota"];
const CHANNEL_WEIGHTS: readonly number[] = [42, 33, 12, 13];

// These members keep their normal (tier-driven) flight volume, but every one
// of their bookings lands in the older half of the trailing 12 months — a
// "used to fly a lot, stopped recently" pattern. That is what lets a member
// stay high-value (clv/rpk/revenue stay strong) while also reading as
// high-churn-risk (large daysSinceLastFlight), producing the "Retencion
// Prioritaria" segment the demo is built around.
const DORMANT_MEMBER_IDS: ReadonlySet<string> = new Set([toMemberId(6), toMemberId(8), toMemberId(16)]);

// Route weight aligned to networkCapacity order. Elite tiers skew toward the
// longer international routes; everyone else skews toward short domestic hops.
const ROUTE_WEIGHTS_BASE: readonly number[] = [20, 18, 16, 10, 10, 8, 6, 4, 3, 8, 6];
const ROUTE_WEIGHTS_LONGHAUL: readonly number[] = [10, 10, 12, 12, 14, 12, 8, 10, 8, 4, 8];

function generateBookings(): readonly Booking[] {
  const rng = mulberry32(BOOKING_SEED);
  const memberWeights = crmMembers.map((member) => TIER_BOOKING_WEIGHT[member.tier]);

  const generated: Booking[] = [];
  for (let i = 0; i < BOOKING_COUNT; i += 1) {
    const member = weightedPick(rng, crmMembers, memberWeights);
    const isElite = member.tier === "Titanio" || member.tier === "Platino";
    const route = weightedPick(
      rng,
      networkCapacity,
      isElite ? ROUTE_WEIGHTS_LONGHAUL : ROUTE_WEIGHTS_BASE,
    );

    const [premierP, amPlusP] = CABIN_PROBABILITY[member.tier];
    const cabinRoll = rng();
    const cabin: Cabin =
      cabinRoll < premierP ? "Premier" : cabinRoll < premierP + amPlusP ? "AM Plus" : "Economy";
    const fareClass = FARE_CLASSES[cabin][Math.floor(rng() * FARE_CLASSES[cabin].length)];
    const isAward = rng() < AWARD_PROBABILITY[member.tier];

    const seatRoll = rng();
    const seats = seatRoll < 0.82 ? 1 : seatRoll < 0.95 ? 2 : 3;

    const variance = 0.85 + rng() * 0.3;
    const fareMxn = isAward
      ? 0
      : Math.round(route.distanceKm * YIELD_MXN_PER_KM[cabin] * seats * variance);

    const [ancMin, ancMax] = ANCILLARY_RANGE_MXN[cabin];
    const ancillaryMxn = Math.round(
      (ancMin + rng() * (ancMax - ancMin)) * (seats === 1 ? 1 : seats * 0.8),
    );

    const bookedChannel = weightedPick(rng, CHANNELS, CHANNEL_WEIGHTS);
    const dayOffset = DORMANT_MEMBER_IDS.has(member.memberId)
      ? 150 + Math.floor(rng() * 215)
      : Math.floor(rng() * 365);
    const flightDate = addDays(TODAY, -dayOffset);

    generated.push({
      bookingId: `AM${100_000 + i}`,
      memberId: member.memberId,
      flightDate,
      route: route.route,
      distanceKm: route.distanceKm,
      cabin,
      fareClass,
      fareMxn,
      ancillaryMxn,
      seats,
      isAward,
      bookedChannel,
    });
  }

  return generated.sort((a, b) => a.flightDate.localeCompare(b.flightDate));
}

export const bookings: readonly Booking[] = generateBookings();

// --- Rollups --------------------------------------------------------------

function computeRollup(memberBookings: readonly Booking[], asOfDate: string): BookingRollup {
  let paidRpk = 0;
  let awardRpk = 0;
  let passengerRevenue12mMxn = 0;
  let ancillary12mMxn = 0;
  let awardSegments12m = 0;
  const routes = new Set<string>();
  let lastFlightDate: string | null = null;

  for (const booking of memberBookings) {
    const km = booking.distanceKm * booking.seats;
    if (booking.isAward) {
      awardRpk += km;
      awardSegments12m += 1;
    } else {
      paidRpk += km;
      passengerRevenue12mMxn += booking.fareMxn;
    }
    ancillary12mMxn += booking.ancillaryMxn;
    routes.add(booking.route);
    if (!lastFlightDate || booking.flightDate > lastFlightDate) {
      lastFlightDate = booking.flightDate;
    }
  }

  return {
    rpk12m: paidRpk + awardRpk,
    paidRpk,
    awardRpk,
    passengerRevenue12mMxn,
    ancillary12mMxn,
    segments12m: memberBookings.length,
    awardSegments12m,
    routesFlown: [...routes],
    lastFlightDate,
    daysSinceLastFlight: lastFlightDate ? daysBetween(lastFlightDate, asOfDate) : 999,
    avgYieldMxnPerKm: paidRpk === 0 ? 0 : passengerRevenue12mMxn / paidRpk,
  };
}

function groupBookingsByMember(subset: readonly Booking[]): Map<string, Booking[]> {
  const byMember = new Map<string, Booking[]>();
  for (const booking of subset) {
    const list = byMember.get(booking.memberId);
    if (list) {
      list.push(booking);
    } else {
      byMember.set(booking.memberId, [booking]);
    }
  }
  return byMember;
}

export function rollupBookingsByMember(): Map<string, BookingRollup> {
  const byMember = groupBookingsByMember(bookings);
  const result = new Map<string, BookingRollup>();
  for (const member of crmMembers) {
    result.set(member.memberId, computeRollup(byMember.get(member.memberId) ?? [], TODAY));
  }
  return result;
}

function joinMembers(rollups: Map<string, BookingRollup>): readonly UnifiedMemberBase[] {
  const cdpById = new Map(cdpProfiles.map((profile) => [profile.memberId, profile] as const));
  const loyaltyById = new Map(loyaltyAccounts.map((account) => [account.memberId, account] as const));

  return crmMembers.map((member) => {
    const cdp = cdpById.get(member.memberId);
    const loyalty = loyaltyById.get(member.memberId);
    const rollup = rollups.get(member.memberId);
    if (!cdp || !loyalty || !rollup) {
      throw new Error(`Missing joined data for member ${member.memberId}.`);
    }
    return { ...member, ...cdp, ...loyalty, ...rollup };
  });
}

let cachedBase: readonly UnifiedMemberBase[] | null = null;
function getBase(): readonly UnifiedMemberBase[] {
  if (!cachedBase) {
    cachedBase = joinMembers(rollupBookingsByMember());
  }
  return cachedBase;
}

// --- Scoring ----------------------------------------------------------

const TIER_RANK: Record<Tier, number> = { Clasico: 1, Plata: 2, Oro: 3, Platino: 4, Titanio: 5 };

function minMax(values: readonly number[]): { readonly min: number; readonly max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function normalize(value: number, min: number, max: number): number {
  return max === min ? 0.5 : (value - min) / (max - min);
}

function computeScore(base: readonly UnifiedMemberBase[], member: UnifiedMemberBase): MemberScore {
  const clv = minMax(base.map((m) => m.clvMxn));
  const rpk = minMax(base.map((m) => m.rpk12m));
  const revenue = minMax(base.map((m) => m.passengerRevenue12mMxn + m.ancillary12mMxn));
  const tier = minMax(base.map((m) => TIER_RANK[m.tier]));
  const cobrand = minMax(base.map((m) => m.cardSpend12mMxn));
  const recency = minMax(base.map((m) => m.daysSinceLastFlight));
  const engagement = minMax(base.map((m) => m.lastLoginDays));
  const frequency = minMax(base.map((m) => m.segments12m));
  const satisfaction = minMax(base.map((m) => m.csat));
  const friction = minMax(base.map((m) => m.serviceCases12m));

  const valueScore =
    100 *
    (0.3 * normalize(member.clvMxn, clv.min, clv.max) +
      0.25 * normalize(member.rpk12m, rpk.min, rpk.max) +
      0.2 *
        normalize(member.passengerRevenue12mMxn + member.ancillary12mMxn, revenue.min, revenue.max) +
      0.15 * normalize(TIER_RANK[member.tier], tier.min, tier.max) +
      0.1 * normalize(member.cardSpend12mMxn, cobrand.min, cobrand.max));

  const churnRisk =
    100 *
    (0.35 * normalize(member.daysSinceLastFlight, recency.min, recency.max) +
      0.2 * normalize(member.lastLoginDays, engagement.min, engagement.max) +
      0.2 * (1 - normalize(member.segments12m, frequency.min, frequency.max)) +
      0.15 * (1 - normalize(member.csat, satisfaction.min, satisfaction.max)) +
      0.1 * normalize(member.serviceCases12m, friction.min, friction.max));

  const raskAtRiskMxn = (churnRisk / 100) * (member.passengerRevenue12mMxn + member.ancillary12mMxn);
  const highValue = valueScore >= 60;
  const highRisk = churnRisk >= 50;
  const segment: MemberSegment =
    highValue && highRisk
      ? "Retencion Prioritaria"
      : highValue
        ? "Embajadores"
        : highRisk
          ? "En Riesgo"
          : "Base";

  return {
    valueScore: round1(valueScore),
    churnRisk: round1(churnRisk),
    segment,
    raskAtRiskMxn: Math.round(raskAtRiskMxn),
  };
}

export function scoreMember(member: UnifiedMemberBase): MemberScore {
  return computeScore(getBase(), member);
}

let cachedUnified: readonly UnifiedMember[] | null = null;
export function getUnifiedMembers(): readonly UnifiedMember[] {
  if (!cachedUnified) {
    const base = getBase();
    cachedUnified = base.map((member) => ({ ...member, ...computeScore(base, member) }));
  }
  return cachedUnified;
}

// --- Network / route / tier views ---------------------------------------

function buildRouteSnapshots(subset: readonly Booking[]): readonly RouteSnapshot[] {
  return networkCapacity.map((capacity) => {
    const routeBookings = subset.filter((booking) => booking.route === capacity.route);
    const rpkKm = routeBookings.reduce((sum, booking) => sum + booking.distanceKm * booking.seats, 0);
    const rpkMillions = rpkKm / 1_000_000;
    const passengerRevenueMxn = routeBookings.reduce((sum, booking) => sum + booking.fareMxn, 0);
    const ancillaryMxn = routeBookings.reduce((sum, booking) => sum + booking.ancillaryMxn, 0);
    const loadFactor = capacity.ask12mMillions === 0 ? 0 : rpkMillions / capacity.ask12mMillions;
    const raskMxn =
      capacity.ask12mMillions === 0
        ? 0
        : (passengerRevenueMxn + ancillaryMxn) / (capacity.ask12mMillions * 1_000_000);

    return {
      route: capacity.route,
      distanceKm: capacity.distanceKm,
      askMillions: capacity.ask12mMillions,
      rpkMillions,
      loadFactor,
      passengerRevenueMxn,
      ancillaryMxn,
      raskMxn,
      segments: routeBookings.length,
    };
  });
}

const TIER_ORDER: readonly Tier[] = ["Clasico", "Plata", "Oro", "Platino", "Titanio"];

function buildTierSnapshots(members: readonly UnifiedMember[]): readonly TierSnapshot[] {
  return TIER_ORDER.map((tier) => {
    const group = members.filter((member) => member.tier === tier);
    const count = group.length || 1;

    return {
      tier,
      members: group.length,
      avgValueScore: round1(group.reduce((sum, member) => sum + member.valueScore, 0) / count),
      avgChurnRisk: round1(group.reduce((sum, member) => sum + member.churnRisk, 0) / count),
      raskAtRiskMxn: Math.round(group.reduce((sum, member) => sum + member.raskAtRiskMxn, 0)),
      totalClvMxn: Math.round(group.reduce((sum, member) => sum + member.clvMxn, 0)),
    };
  });
}

export function getNetworkSnapshot(): NetworkSnapshot {
  const byRoute = buildRouteSnapshots(bookings);
  const askMillions = networkCapacity.reduce((sum, capacity) => sum + capacity.ask12mMillions, 0);
  const rpkMillions = byRoute.reduce((sum, route) => sum + route.rpkMillions, 0);
  const passengerRevenueMxn = byRoute.reduce((sum, route) => sum + route.passengerRevenueMxn, 0);
  const ancillaryMxn = byRoute.reduce((sum, route) => sum + route.ancillaryMxn, 0);
  const loadFactor = askMillions === 0 ? 0 : rpkMillions / askMillions;
  const raskMxn = askMillions === 0 ? 0 : (passengerRevenueMxn + ancillaryMxn) / (askMillions * 1_000_000);
  const paidRpkKm = bookings
    .filter((booking) => !booking.isAward)
    .reduce((sum, booking) => sum + booking.distanceKm * booking.seats, 0);
  const yieldMxnPerKm = paidRpkKm === 0 ? 0 : passengerRevenueMxn / paidRpkKm;
  const ancillaryShare =
    passengerRevenueMxn + ancillaryMxn === 0 ? 0 : ancillaryMxn / (passengerRevenueMxn + ancillaryMxn);
  const byTier = buildTierSnapshots(getUnifiedMembers());

  return { askMillions, rpkMillions, loadFactor, raskMxn, yieldMxnPerKm, ancillaryShare, byRoute, byTier };
}

export function getRouteView(route: string) {
  const snapshot = getNetworkSnapshot().byRoute.find((entry) => entry.route === route) ?? null;
  const routeBookings = bookings.filter((booking) => booking.route === route);
  const memberIds = new Set(routeBookings.map((booking) => booking.memberId));
  const topMembers = getUnifiedMembers()
    .filter((member) => memberIds.has(member.memberId))
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 10);

  return { route, snapshot, bookings: routeBookings, topMembers };
}

export function getTierView(): readonly TierSnapshot[] {
  return buildTierSnapshots(getUnifiedMembers());
}

// --- Dashboard snapshot ---------------------------------------------------

const PREVIOUS_ASOF = "2026-01-17";

type PeriodSnapshot = {
  readonly asOfDate: string;
  readonly loadFactor: number;
  readonly raskMxn: number;
  readonly rpkMillions: number;
  readonly valueAtRiskMxn: number;
};

function buildPeriodSnapshot(asOfDate: string): PeriodSnapshot {
  const windowStart = addDays(asOfDate, -365);
  const windowBookings = bookings.filter(
    (booking) => booking.flightDate <= asOfDate && booking.flightDate >= windowStart,
  );
  const byMember = groupBookingsByMember(windowBookings);
  const rollups = new Map<string, BookingRollup>();
  for (const member of crmMembers) {
    rollups.set(member.memberId, computeRollup(byMember.get(member.memberId) ?? [], asOfDate));
  }

  const base = joinMembers(rollups);
  const scored = base.map((member) => ({ ...member, ...computeScore(base, member) }));

  const byRoute = buildRouteSnapshots(windowBookings);
  const askMillions = networkCapacity.reduce((sum, capacity) => sum + capacity.ask12mMillions, 0);
  const rpkMillions = byRoute.reduce((sum, route) => sum + route.rpkMillions, 0);
  const passengerRevenueMxn = byRoute.reduce((sum, route) => sum + route.passengerRevenueMxn, 0);
  const ancillaryMxn = byRoute.reduce((sum, route) => sum + route.ancillaryMxn, 0);
  const loadFactor = askMillions === 0 ? 0 : rpkMillions / askMillions;
  const raskMxn = askMillions === 0 ? 0 : (passengerRevenueMxn + ancillaryMxn) / (askMillions * 1_000_000);
  const valueAtRiskMxn = Math.round(scored.reduce((sum, member) => sum + member.raskAtRiskMxn, 0));

  return { asOfDate, loadFactor, raskMxn, rpkMillions, valueAtRiskMxn };
}

type DashboardMetric = "loadFactor" | "raskMxn" | "rpkMillions" | "valueAtRiskMxn";

export function getDashboardSnapshot() {
  const current = buildPeriodSnapshot(TODAY);
  const previous = buildPeriodSnapshot(PREVIOUS_ASOF);

  const currentWeek = {
    label: `Trailing 12 months as of ${current.asOfDate}`,
    startDate: addDays(current.asOfDate, -365),
    endDate: current.asOfDate,
    loadFactor: current.loadFactor,
    raskMxn: current.raskMxn,
    rpkMillions: current.rpkMillions,
    valueAtRiskMxn: current.valueAtRiskMxn,
  };
  const previousWeek = {
    label: `Trailing 12 months as of ${previous.asOfDate}`,
    startDate: addDays(previous.asOfDate, -365),
    endDate: previous.asOfDate,
    loadFactor: previous.loadFactor,
    raskMxn: previous.raskMxn,
    rpkMillions: previous.rpkMillions,
    valueAtRiskMxn: previous.valueAtRiskMxn,
  };

  const compare = (metric: DashboardMetric) => {
    const previousValue = previousWeek[metric];
    const currentValue = currentWeek[metric];
    const absoluteChange = currentValue - previousValue;
    const percentChange = previousValue === 0 ? null : (absoluteChange / previousValue) * 100;

    return {
      metric,
      previous: {
        label: previousWeek.label,
        startDate: previousWeek.startDate,
        endDate: previousWeek.endDate,
        value: previousValue,
      },
      current: {
        label: currentWeek.label,
        startDate: currentWeek.startDate,
        endDate: currentWeek.endDate,
        value: currentValue,
      },
      absoluteChange,
      percentChange,
    };
  };

  const network = getNetworkSnapshot();

  return {
    previousWeek,
    currentWeek,
    comparisons: [
      compare("loadFactor"),
      compare("raskMxn"),
      compare("rpkMillions"),
      compare("valueAtRiskMxn"),
    ],
    byRoute: network.byRoute,
    byTier: network.byTier,
  };
}
