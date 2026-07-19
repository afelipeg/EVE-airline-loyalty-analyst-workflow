import type { InputRow } from "./schema";
import type { RetentionTarget, SegmentationResult, SegmentCount } from "./types";

// Unit note: rows carry rpk12m as raw seat-km (matching
// aeromexico-data.ts's BookingRollup.rpk12m). askMillions is expressed in
// millions of ASK-km (matching aeromexico-data.ts's networkCapacity /
// NetworkSnapshot.askMillions). Load factor divides like-for-like, so the raw
// km sum is converted to millions before dividing by askMillions.

const SEGMENT_ORDER = ["Retencion Prioritaria", "Embajadores", "En Riesgo", "Base"] as const;

type MemberRow = {
  readonly memberId: string;
  readonly valueScore: number;
  readonly churnRisk: number;
  readonly raskAtRiskMxn: number;
  readonly rpk12m: number;
  readonly segment: string;
};

export function classify(valueScore: number, churnRisk: number): string {
  const highValue = valueScore >= 60;
  const highRisk = churnRisk >= 50;
  if (highValue && highRisk) return "Retencion Prioritaria";
  if (highValue) return "Embajadores";
  if (highRisk) return "En Riesgo";
  return "Base";
}

export function toMemberRow(row: InputRow, index: number): MemberRow {
  const memberId = typeof row.memberId === "string" ? row.memberId : `member-${index + 1}`;
  const valueScore = readNumber(row.valueScore, index, "valueScore");
  const churnRisk = readNumber(row.churnRisk, index, "churnRisk");
  const raskAtRiskMxn = readNumber(row.raskAtRiskMxn, index, "raskAtRiskMxn");
  const rpk12m = readNumber(row.rpk12m, index, "rpk12m");
  const segment = typeof row.segment === "string" ? row.segment : classify(valueScore, churnRisk);

  return { memberId, valueScore, churnRisk, raskAtRiskMxn, rpk12m, segment };
}

export function segmentMembers(
  rows: readonly InputRow[],
  askMillions: number,
  title: string,
): SegmentationResult {
  const members = rows.map((row, index) => toMemberRow(row, index));

  const bySegment = new Map<string, { members: number; raskAtRiskMxn: number }>(
    SEGMENT_ORDER.map((segment) => [segment, { members: 0, raskAtRiskMxn: 0 }]),
  );
  let totalRaskAtRiskMxn = 0;
  let totalRpk = 0;

  for (const member of members) {
    const bucket = bySegment.get(member.segment) ?? { members: 0, raskAtRiskMxn: 0 };
    bucket.members += 1;
    bucket.raskAtRiskMxn += member.raskAtRiskMxn;
    bySegment.set(member.segment, bucket);
    totalRaskAtRiskMxn += member.raskAtRiskMxn;
    totalRpk += member.rpk12m;
  }

  const segments: SegmentCount[] = [...bySegment.entries()].map(([segment, bucket]) => ({
    segment,
    members: bucket.members,
    raskAtRiskMxn: bucket.raskAtRiskMxn,
  }));

  const topRetentionTargets: RetentionTarget[] = members
    .filter((member) => member.segment === "Retencion Prioritaria")
    .sort((a, b) => b.raskAtRiskMxn - a.raskAtRiskMxn)
    .slice(0, 10)
    .map((member) => ({
      memberId: member.memberId,
      valueScore: member.valueScore,
      churnRisk: member.churnRisk,
      raskAtRiskMxn: member.raskAtRiskMxn,
      segment: member.segment,
    }));

  const totalRpkMillions = totalRpk / 1_000_000;
  const loadFactor = askMillions === 0 ? 0 : totalRpkMillions / askMillions;

  return {
    title,
    memberCount: members.length,
    segments,
    totalRaskAtRiskMxn,
    loadFactor,
    topRetentionTargets,
    takeaway: `${members.length} members scored; ${totalRaskAtRiskMxn.toLocaleString()} MXN of trailing-12m revenue is at risk across the selected members. (Network load factor is a fixed-ASK metric — read it from query_members view=network.)`,
  };
}

function readNumber(value: unknown, index: number, field: string): number {
  if (typeof value !== "number") {
    throw new Error(`Row ${index + 1} does not contain numeric field ${field}.`);
  }
  return value;
}
