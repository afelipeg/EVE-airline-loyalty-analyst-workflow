import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { buildClaimCases, POLICY_CASES, POLICY_CHECKS, type PolicyCheck } from "#evals/data/verification-cases.js";

// Integrity gate for the B2/B3 verification sets: zero model tokens, no
// TypeSafe key needed. A set with duplicate ids, no negatives, or a "mutated"
// claim that equals the real value would make the Jev measurement meaningless.
export default defineEval({
  description: "B2/B3 verification fixtures are balanced, unique, and built from real tool output.",
  async test(t) {
    const claims = await buildClaimCases();
    const ids = [...claims.map((c) => c.id), ...POLICY_CASES.map((c) => c.id)];

    t.check(ids, satisfies((all: typeof ids) => new Set(all).size === all.length, "case ids are unique"));
    t.check(
      claims,
      satisfies(
        (cs: typeof claims) => cs.filter((c) => c.supported).length >= 10 && cs.filter((c) => !c.supported).length >= 10,
        "B2 has at least 10 supported and 10 unsupported claims",
      ),
    );

    const checks = Object.keys(POLICY_CHECKS) as PolicyCheck[];
    t.check(
      POLICY_CASES,
      satisfies(
        (cs: typeof POLICY_CASES) =>
          checks.every((check) => {
            const positives = cs.filter((c) => c.violates.includes(check)).length;
            return positives >= 3 && cs.length - positives >= 3;
          }),
        "B3 has at least 3 violating and 3 clean cases per policy check",
      ),
    );
  },
});
