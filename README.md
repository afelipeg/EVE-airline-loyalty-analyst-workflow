# Customer Success Command Center — Vercel Eve Interview MVP

An interview prototype for a Global Chief Success Officer / CX operating model. It uses Vercel Eve to turn product adoption, maintenance outcomes, support friction, relationship signals, renewals, and ARR economics into a prioritized Customer Success portfolio.

This is not a Fracttal maintenance copilot. Fracttal One already has AI capabilities for maintenance workflows. The prototype instead demonstrates the operating layer a global Customer Success leader needs above the product: where value is not being realized, which recurring revenue is exposed, which intervention should happen next, and where expansion is justified by proven value.

## Data policy

All account names and values in `agent/lib/fracttal-success-data.ts` are synthetic and deterministic. They do not represent actual Fracttal customers, contracts, usage, NPS, maintenance performance, ARR, or renewal dates.

## Decision model

The portfolio is scored across five executive dimensions:

- **Health Score** — adoption + maintenance value + support friction + executive relationship.
- **Churn Risk** — intervention heuristic derived from inverse health, renewal proximity, and critical support friction.
- **Value Realization** — preventive maintenance compliance, preventive/corrective mix, work-order completion, MTTR improvement, and downtime reduction.
- **ARR at Risk** — ARR weighted by the synthetic risk heuristic to prioritize leadership attention.
- **Expansion Readiness** — value, adoption, asset coverage, and integration whitespace; expansion is blocked conceptually until value proof exists.

Accounts fall into four operating motions:

1. `Protect Now`
2. `Accelerate Value`
3. `Expand`
4. `Scale`

The governing doctrine is: **prove value, protect GRR, then compound NRR.**

## Eve architecture

The app keeps the strongest parts of the original Eve demo architecture:

- filesystem-first agent configuration in `agent/`
- AI Gateway model routing
- durable Vercel Workflow-backed sessions
- typed tools with Zod schemas
- Vercel Sandbox capability for isolated analysis
- declared subagents / specialist decomposition
- Vercel Connect channel support
- schedules for recurring executive reviews
- evals for regression and behavioral guardrails
- Next.js web chat with structured Eve events

The first Fracttal-specific tool is `agent/tools/query_accounts.ts`. It grounds portfolio questions in deterministic source data and returns precomputed totals/shares so the model does not fabricate portfolio arithmetic.

## Interview hero prompts

```text
Which accounts represent the largest ARR-at-risk in the next 90 days, why, and what should we do first?
```

```text
Separate the portfolio into Protect Now, Accelerate Value, Expand, and Scale. Quantify the ARR in each motion.
```

```text
Where do we have proven maintenance value and enough whitespace to build a responsible expansion motion?
```

```text
Give me the Monday executive portfolio review: risk, renewals, value proof, expansion readiness, and the five actions requiring leadership attention.
```

## Production target architecture

The synthetic data layer is deliberately replaceable. A production version would connect governed sources such as:

```text
Fracttal One telemetry / API / MCP
          |
CRM / contracts / renewals ---- Customer 360 ---- Support / CSAT / NPS
          |                          |
          +------ Value layer ------+
                     |
           Eve CS Orchestrator
              /   |   |   \
       adoption value risk renewal
                     |
             CS decision layer
                     |
        human approval for actions
```

The production agent should remain read-only by default. CRM changes, customer communication, entitlement changes, discounts, or commercial commitments should require explicit authorization / human approval.

## Local setup

Requirements:

- Node 24+
- pnpm 11.7+
- Vercel project/OIDC or `AI_GATEWAY_API_KEY`

```bash
nvm use
pnpm install
cp .env.example .env.local
pnpm dev
```

Model configuration lives in `agent/agent.ts`.

## Weekly review

`agent/schedules/weekly-success-review.ts` defines the Monday executive Customer Success review. In a production deployment the destination should be replaced by a governed CS leadership channel and connected to real customer sources.

## Deploy

```bash
VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 pnpm dlx vercel@latest deploy
```

Before connecting private customer data, replace demo authorization policies, enforce tenant/account scope, validate Fracttal data permissions, and add human approval for any write-capable action.
