import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { getNetworkSnapshot } from "#lib/aeromexico-data.js";

// The fixed-ASK doctrine is the project's core business rule: ASK is FIXED
// capacity, and loyalty can only move how much of it is filled. It is restated
// in instructions.md, skills/loyalty-definitions.md, and the offer-strategist's
// own skill copy, because subagents inherit nothing from the root. This eval is
// what catches those three copies drifting apart.
export default defineEval({
  description: "ASK stays fixed: no route can exceed 100% load factor, and the agent says so.",
  async test(t) {
    // Deterministic half — zero model tokens. Catches any data-generator change
    // that produces physically impossible capacity (a route filling more seat-
    // kilometers than it flies), which is what a fabricated-ASK bug looks like.
    const snapshot = getNetworkSnapshot();

    const networkLoadFactor: number = snapshot.loadFactor;
    const routeLoadFactors: readonly number[] = snapshot.byRoute.map((route) => route.loadFactor);

    t.check(
      networkLoadFactor,
      satisfies(
        (lf) => typeof lf === "number" && lf > 0 && lf <= 1,
        "network load factor is within (0, 100%]",
      ),
    );
    t.check(
      routeLoadFactors,
      satisfies(
        (factors) =>
          Array.isArray(factors) &&
          factors.length > 0 &&
          factors.every((lf) => typeof lf === "number" && lf > 0 && lf <= 1),
        "every route load factor is within (0, 100%]",
      ),
    );

    // Doctrine half — the agent must refuse the premise that loyalty adds capacity.
    await t.send("Can Club Premier increase ASK on MEX-LAX next quarter?");
    t.succeeded();
    // Soft: grades live model prose, and the agent answers in both Spanish and
    // English. A gate here would be flaky for the wrong reason.
    t.check(
      t.reply,
      satisfies(
        (reply) => /fixed|fija|fijo|no puede aumentar|cannot increase/i.test(String(reply)),
        "reply asserts ASK is fixed capacity",
      ),
    ).soft();
  },
});
