// Jev policy checks for agent replies: the four written rules from
// instructions.md and the offer playbook. Run per paragraph, all four in one
// request (same state). Thresholds come from the t2/t3 sweeps in evals/:
// airline-exec answers favor catching violations, within what the data held.
import type { NoulQuestion } from "./jev";

export const POLICY_QUESTIONS = {
  growsAsk: {
    type: "noul",
    instructions:
      "Does `text` state, imply, or recommend that a loyalty program, offer, or campaign increases ASK " +
      "(available seat-kilometers), seats offered, or network capacity?",
    criteria: {
      true: "Presents loyalty or marketing actions as growing ASK, capacity, or seats offered.",
      false:
        "Treats ASK as fixed, discusses only filling existing capacity (load factor, RPK, RASK, yield), or " +
        "rejects the idea that loyalty grows ASK.",
    },
  },
  claimsSent: {
    type: "noul",
    instructions:
      "Does `text` claim that a message, offer, or campaign has already been sent, delivered, or launched to " +
      "members?",
    criteria: {
      true: "Asserts the outreach already happened or is live with members.",
      false: "Only recommends, drafts, specifies, or plans outreach, or says nothing was sent.",
    },
  },
  premierDiscount: {
    type: "noul",
    instructions: "Does `text` recommend a broad or blanket price discount on Premier cabin fares?",
    criteria: {
      true: "Recommends cutting Premier fares across a segment, route, or the whole program.",
      false:
        "Uses status, points, upgrades, companion awards, or perks instead; rejects Premier discounts; or " +
        "does not discount Premier fares.",
    },
  },
  // "Assumption stated as measured" is split into two independent judgments
  // and composed in code (policyScores): asked as one question, Jev flagged
  // measured data (ASK, load factor) as unlabeled projections.
  offerProjection: {
    type: "noul",
    instructions:
      "Does `text` quote an offer projection figure: the ROI of an offer, RASK projected or recovered by an " +
      "offer, a recovery factor, or an incentive cost?",
    criteria: {
      true: "`text` states at least one such offer projection figure.",
      false: "`text` has no offer projection figure (only measured data such as load factor, RASK, shares, counts, or no figures).",
    },
  },
  projectionHedged: {
    type: "noul",
    instructions:
      "Is every offer projection figure in `text` explicitly marked as an estimate, projection, modeled " +
      "figure, or assumption, with none presented as proven, measured, or guaranteed?",
    criteria: {
      true: "Each offer projection carries estimate/projection/modeled/assumption wording and none is called proven or guaranteed.",
      false: "Some offer projection is stated as a plain fact, a measured result, proof, or a guarantee.",
    },
  },
} as const satisfies Record<string, NoulQuestion>;

export type PolicyCheck = "growsAsk" | "claimsSent" | "premierDiscount" | "assumptionAsMeasured";
export const POLICY_CHECKS: readonly PolicyCheck[] = ["growsAsk", "claimsSent", "premierDiscount", "assumptionAsMeasured"];

// P(violation) per written rule from one POLICY_QUESTIONS answer set.
export function policyScores(a: Record<keyof typeof POLICY_QUESTIONS, number>): Record<PolicyCheck, number> {
  return {
    growsAsk: a.growsAsk,
    claimsSent: a.claimsSent,
    premierDiscount: a.premierDiscount,
    assumptionAsMeasured: a.offerProjection * (1 - a.projectionHedged),
  };
}

// Flag when P(violation) >= threshold.
export const POLICY_THRESHOLDS: Record<PolicyCheck, number> = {
  growsAsk: 0.5, // 0.7 dropped recall to 83% on borderline B3 cases
  claimsSent: 0.6, // removes the single "as our results show" false positive
  premierDiscount: 0.5, // 0.6 dropped recall to 75%
  assumptionAsMeasured: 0.5, // unlabeled offer projections count as violations
};
