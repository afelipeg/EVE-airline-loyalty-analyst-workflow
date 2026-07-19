import { defineTool } from "eve/tools";
import { z } from "zod";

import { getNetworkSnapshot, getUnifiedMembers, type UnifiedMember } from "../../../lib/aeromexico-data.js";

const memberSegmentSchema = z.enum(["Retencion Prioritaria", "Embajadores", "En Riesgo", "Base"]);
const objectiveSchema = z.enum(["retention", "reactivation", "upsell_yield", "ancillary_growth"]);

type Objective = z.infer<typeof objectiveSchema>;

type ArchetypeKey =
  | "statusExtension"
  | "companionAward"
  | "cobrandBonus"
  | "reactivationBonus"
  | "upgradeCertificate";

type RecoveryBase = "raskAtRiskMxn" | "ancillary12mMxn" | "passengerRevenue12mMxn";

type Archetype = {
  readonly key: ArchetypeKey;
  readonly name: string;
  readonly mechanics: string;
  readonly objectives: readonly Objective[];
  readonly recoveryBase: RecoveryBase;
  readonly recoveryFactor: number;
  readonly costPerMemberMxn: number;
  readonly rationale: (targetCount: number) => string;
  readonly matches: (member: UnifiedMember, context: { readonly oroMedianRpk: number }) => boolean;
};

const ARCHETYPES: readonly Archetype[] = [
  {
    key: "statusExtension",
    name: "Status Extension + Double Puntos",
    mechanics:
      "Extend current tier status through the next requalification window; award double Puntos Premier on the next 2 Premier-cabin segments.",
    objectives: ["retention"],
    recoveryBase: "raskAtRiskMxn",
    recoveryFactor: 0.45,
    costPerMemberMxn: 600,
    rationale: (n) =>
      `${n} Titanio/Platino members show elevated churn risk with meaningful RASK exposure; status protection is the lowest-cost lever for top-tier retention.`,
    matches: (member) =>
      (member.tier === "Titanio" || member.tier === "Platino") &&
      (member.segment === "Retencion Prioritaria" || member.segment === "En Riesgo"),
  },
  {
    key: "companionAward",
    name: "Companion Award + Waived Redemption Fee",
    mechanics:
      "Issue a companion award seat on the member's home-hub route and waive the redemption fee, filling otherwise-empty ASK with award RPK.",
    objectives: ["retention", "reactivation"],
    recoveryBase: "raskAtRiskMxn",
    recoveryFactor: 0.35,
    costPerMemberMxn: 900,
    rationale: (n) =>
      `${n} above-median-RPK Oro members at risk of churn respond well to an award-seat incentive that fills empty ASK instead of a cash discount.`,
    matches: (member, context) =>
      member.tier === "Oro" &&
      (member.segment === "Retencion Prioritaria" || member.segment === "En Riesgo") &&
      member.rpk12m >= context.oroMedianRpk,
  },
  {
    key: "cobrandBonus",
    name: "Bonus Card-Spend Points + Lounge Pass",
    mechanics: "Award bonus Puntos on the next 90 days of co-brand card spend, plus a one-time lounge pass.",
    objectives: ["ancillary_growth"],
    recoveryBase: "ancillary12mMxn",
    recoveryFactor: 0.3,
    costPerMemberMxn: 350,
    rationale: (n) =>
      `${n} co-brand cardholders have spend and ancillary headroom that a points-plus-perk bonus can grow without discounting fares.`,
    matches: (member) => member.cobrandCard !== "none",
  },
  {
    key: "reactivationBonus",
    name: "Dormant Elite Reactivation Bonus Miles",
    mechanics: "Offer bonus miles redeemable only if the member rebooks a flight within 30 days.",
    objectives: ["reactivation"],
    recoveryBase: "raskAtRiskMxn",
    recoveryFactor: 0.3,
    costPerMemberMxn: 750,
    rationale: (n) =>
      `${n} members have gone quiet (150+ days since last flight or a Dormant Elite marketing segment); a time-boxed rebooking bonus targets lapsed high-RASK-at-risk value.`,
    matches: (member) => member.daysSinceLastFlight > 150 || member.marketingSegment === "Dormant Elite",
  },
  {
    key: "upgradeCertificate",
    name: "AM Plus/Premier Upgrade Certificate",
    mechanics: "Issue a one-cabin upgrade certificate valid on the member's next paid booking.",
    objectives: ["upsell_yield"],
    recoveryBase: "passengerRevenue12mMxn",
    recoveryFactor: 0.12,
    costPerMemberMxn: 400,
    rationale: (n) =>
      `${n} members flying Economy/AM Plus are upgrade-eligible; a certificate nudges them into a higher-yield cabin without a fare discount.`,
    matches: () => true,
  },
];

export default defineTool({
  description:
    "Design ranked Club Premier retention/growth offers from the member dataset, scored by RASK recovered per peso of incentive cost. Use before recommending offers.",
  inputSchema: z.object({
    segment: memberSegmentSchema.optional().describe("Target member segment. Defaults to all members."),
    members: z
      .array(z.object({ memberId: z.string() }).passthrough())
      .optional()
      .describe("Explicit member rows to target, matched by memberId against the dataset."),
    objective: objectiveSchema.default("retention"),
    maxOffers: z.number().int().min(1).default(5),
  }),
  async execute({ maxOffers, members, objective, segment }) {
    const all = getUnifiedMembers();
    const network = getNetworkSnapshot();

    let targets: readonly UnifiedMember[];
    if (members && members.length > 0) {
      const ids = new Set(members.map((m) => m.memberId));
      targets = all.filter((member) => ids.has(member.memberId));
    } else if (segment) {
      targets = all.filter((member) => member.segment === segment);
    } else {
      targets = all;
    }

    const oroRpkValues = all.filter((m) => m.tier === "Oro").map((m) => m.rpk12m).sort((a, b) => a - b);
    const oroMedianRpk = oroRpkValues.length === 0 ? 0 : oroRpkValues[Math.floor(oroRpkValues.length / 2)];
    const context = { oroMedianRpk };

    const eligibleArchetypes = ARCHETYPES.filter((archetype) => archetype.objectives.includes(objective));

    const groups = new Map<ArchetypeKey, UnifiedMember[]>();
    for (const member of targets) {
      for (const archetype of eligibleArchetypes) {
        if (archetype.matches(member, context)) {
          const group = groups.get(archetype.key);
          if (group) {
            group.push(member);
          } else {
            groups.set(archetype.key, [member]);
          }
          break;
        }
      }
    }

    const offers = eligibleArchetypes
      .map((archetype) => {
        const group = groups.get(archetype.key) ?? [];
        if (group.length === 0) return null;

        const raskRecoveredMxn = Math.round(
          group.reduce((sum, member) => sum + member[archetype.recoveryBase] * archetype.recoveryFactor, 0),
        );
        const rpkRetained = Math.round(
          group.reduce((sum, member) => {
            const memberRecovered = member[archetype.recoveryBase] * archetype.recoveryFactor;
            const yieldMxnPerKm = member.avgYieldMxnPerKm > 0 ? member.avgYieldMxnPerKm : network.yieldMxnPerKm;
            return sum + (yieldMxnPerKm > 0 ? memberRecovered / yieldMxnPerKm : 0);
          }, 0),
        );
        const incentiveCostMxn = archetype.costPerMemberMxn * group.length;
        const roi = incentiveCostMxn === 0 ? 0 : Math.round((raskRecoveredMxn / incentiveCostMxn) * 100) / 100;

        return {
          archetype: archetype.name,
          mechanics: archetype.mechanics,
          targetCount: group.length,
          estimatedRpkRetained: rpkRetained,
          estimatedRaskRecoveredMxn: raskRecoveredMxn,
          incentiveCostMxn,
          roi,
          rationale: archetype.rationale(group.length),
        };
      })
      .filter((offer): offer is NonNullable<typeof offer> => offer !== null)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, maxOffers);

    return {
      objective,
      segment: segment ?? null,
      matchedCount: targets.length,
      offers,
      notes: [
        "ASK is fixed network capacity; these offers move RPK, load factor, yield, and RASK, never ASK.",
        "recoveryFactor and costPerMemberMxn are modeled assumptions from the offer playbook, not measured outcomes.",
      ],
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
