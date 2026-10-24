# Pulse: Vercel Eve Agent Stack Demo

Pulse is the full demo app from the video script, "Vercel's Agent Stack
explained." It is a runnable SaaS metrics analyst built with eve, Vercel AI
Gateway, Vercel Sandbox, Vercel Workflow, Vercel Connect, and a Next.js web chat.

Use this repo if you want to follow along with the video instead of just watching
slides. Pulse can answer metrics questions, call tools, run Python in an isolated
sandbox, delegate anomaly checks to a subagent, and run a scheduled weekly report.

## Despliegue BYOK (tu propia cuenta, tus propias llaves)

Este repo no incluye ninguna credencial. Quien lo despliega usa su propia cuenta
de Vercel y su propio acceso al modelo (`anthropic/claude-sonnet-5` vía Vercel AI
Gateway). Los datos de la demo son sintéticos (generados con semilla fija).

### Opción 1: sin git ni terminal (recomendada)

Solo necesitas una cuenta gratuita de GitHub y una de Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fafelipeg%2Feve-airline-loyalty-analyst-workflow&env=AI_GATEWAY_API_KEY,AUTH_SECRET,AUTH_USERS,VERCEL_USE_EXPERIMENTAL_FRAMEWORKS&envDescription=AI%20Gateway%20key%2C%20firma%20de%20sesi%C3%B3n%2C%20usuarios%20permitidos%20y%20flag%20de%20build%20(valor%201)&envLink=https%3A%2F%2Fgithub.com%2Fafelipeg%2Feve-airline-loyalty-analyst-workflow%23variables-de-entorno)

1. Haz clic en **Deploy with Vercel**. Vercel crea una copia del repo en tu
   GitHub y la conecta a un proyecto nuevo en tu cuenta.
2. Llena las variables que te pide (ver tabla abajo) y presiona **Deploy**.
3. Abre la URL que te da Vercel e inicia sesión en `/login` con el usuario que
   definiste en `AUTH_USERS`.

### Opción 2: con terminal

```bash
git clone https://github.com/afelipeg/eve-airline-loyalty-analyst-workflow
cd eve-airline-loyalty-analyst-workflow
nvm use && pnpm install
cp .env.example .env.local   # llena las variables de la tabla
VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 pnpm dlx vercel@latest deploy
```

Si no tienes git, descarga el ZIP desde **Code → Download ZIP** y sigue desde
`nvm use`.

### Variables de entorno

| Variable | Obligatoria | Qué poner |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Sí* | Tu llave de Vercel AI Gateway (Vercel → AI Gateway → API Keys). *No hace falta si el proyecto está desplegado en Vercel y usa OIDC. Si prefieres pagar directo a Anthropic, agrega tu API key de Anthropic como BYOK en la configuración de AI Gateway. |
| `AUTH_SECRET` | Sí | Cualquier string largo y aleatorio. Genéralo con el comando de abajo. |
| `AUTH_USERS` | Sí | Usuarios permitidos en formato `email:salt:hash` (scrypt), separados por comas. Nunca contraseñas en texto plano. |
| `VERCEL_USE_EXPERIMENTAL_FRAMEWORKS` | Sí (deploy) | `1` |
| `TYPESAFE_API_KEY`, `JEV_VERIFY` | No | Verificación de respuestas con Jev. |
| `SLACK_CONNECTOR` | No | Tu conector de Slack en Vercel Connect. |

Generar `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generar una entrada de `AUTH_USERS` (cambia el email y la contraseña):

```bash
node -e "const c=require('crypto');const[e,p]=process.argv.slice(1);const s=c.randomBytes(16);console.log(e+':'+s.toString('hex')+':'+c.scryptSync(p,s,64).toString('hex'))" tu@correo.com 'TuContraseña'
```

Para varios usuarios, une las salidas con comas.

Si no tienes Node instalado, abre el repo en un Codespace de GitHub
(**Code → Codespaces**) y corre ahí los dos comandos.

## What You Need

- Node 24 or newer. This repo includes `.nvmrc`, so `nvm use` is enough if you
  use nvm.
- pnpm 11.7.0 or newer. The package manager version is declared in
  `package.json`.
- A Vercel project link or an AI Gateway API key. The model in `agent/agent.ts`
  is a Gateway model string: `anthropic/claude-sonnet-5`.
- Vercel CLI access if you want to use the Vercel Sandbox backend locally or wire
  Slack through Vercel Connect.

## Setup

```bash
nvm use
pnpm install
cp .env.example .env.local
```

Then choose one model-auth option:

```bash
# Option A: use Vercel OIDC from a linked project
pnpm dlx vercel@latest link
pnpm dlx vercel@latest env pull .env.local
```

```bash
# Option B: use an AI Gateway key
# Paste AI_GATEWAY_API_KEY into .env.local
```

Run the web demo:

```bash
pnpm dev
```

Open `http://localhost:3000` and ask Pulse something like:

```txt
How did signups do this week compared to last week?
```

## Optional Slack Demo

The Slack channel is already authored in `agent/channels/slack.ts`. It uses
Vercel Connect, so you do not need `SLACK_BOT_TOKEN` or `SLACK_SIGNING_SECRET`.

By default the app looks for this connector UID:

```txt
slack/vercel-eve-bot
```

To use your own connector, set this in `.env.local` and in your Vercel project:

```txt
SLACK_CONNECTOR=slack/your-connector
```

The eve Slack docs cover the full Connect setup:

```bash
pnpm dlx vercel@latest connect create slack --triggers
pnpm dlx vercel@latest connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes
```

## What To Show In The Video

- `agent/` is the filesystem-first eve agent.
- `agent/agent.ts` picks the AI Gateway model and runtime limits.
- `agent/instructions.md` gives Pulse its analyst behavior and demo framing.
- `agent/tools/query_metrics.ts` reads the local SaaS metrics dataset.
- `agent/tools/run_analysis.ts` runs chart-ready analysis through the sandbox.
- `agent/sandbox/sandbox.ts` pins Vercel Sandbox with two vCPUs and `deny-all`
  network egress for each session.
- `agent/subagents/investigator/` is the specialist anomaly-review subagent.
- `agent/schedules/monday-summary.ts` is the Monday weekly report prompt.
- `agent/channels/slack.ts` shows the Vercel Connect-backed Slack channel.
- `app/_components/agent-chat.tsx` is the recording-friendly web chat.

## Trigger The Weekly Report Locally

`eve dev` does not wait for cron. Trigger the same schedule path on demand:

```bash
pnpm dev
```

Then, in another terminal:

```bash
curl -X POST http://localhost:3000/eve/v1/dev/schedules/monday-summary
```

The route returns the started session IDs. You can watch the run in the web UI,
terminal logs, or by streaming the session route.

## Useful Commands

```bash
pnpm typecheck
pnpm build
pnpm build:eve
pnpm dev:eve
```

## Deploy

Deploy it like a normal Vercel app:

```bash
VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 pnpm dlx vercel@latest deploy
```

Set `AI_GATEWAY_API_KEY` only if you are not using Vercel OIDC/Gateway auth for
the deployment. Set `SLACK_CONNECTOR` if your connector UID is different from the
demo default.

Before using private customer data, replace the public demo auth in
`agent/channels/eve.ts` with your real route or app auth policy.
