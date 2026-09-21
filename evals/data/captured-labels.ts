// t3: hand labels for real agent replies captured by
// evals/verification/capture-replies.eval.ts. Evidence is the turn's own tool
// outputs, compacted to the fields replies cite (raw outputs reach ~50 KB).
// Only offer figures the Lead received from a subagent are absent from
// `toolCalls`; claims citing them are left unlabeled rather than guessed.
import { readFileSync } from "node:fs";

import type { EvidenceKey, ReplyParagraph } from "#evals/data/simulated-replies.js";

export type RealReply = {
  readonly id: string;
  readonly paragraphs: readonly ReplyParagraph[];
  readonly evidence: Record<EvidenceKey, unknown>;
};

type ToolCall = { readonly name: string; readonly output: unknown };
type Row = Record<string, unknown>;

const pick = (row: Row, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, row[k]]));

function compact(call: ToolCall): unknown {
  const out = call.output as Row;
  if (call.name === "query_members") {
    const network = out.network as Row;
    return {
      tool: call.name,
      network: {
        ...pick(network, ["askMillions", "rpkMillions", "loadFactor", "raskMxn", "yieldMxnPerKm"]),
        byRoute: (network.byRoute as Row[]).map((r) => pick(r, ["route", "askMillions", "rpkMillions", "loadFactor", "raskMxn"])),
        byTier: network.byTier,
      },
      rollup: out.rollup,
      members: (out.members as Row[]).map((m) =>
        pick(m, ["memberId", "firstName", "lastName", "tier", "homeHub", "segment", "valueScore", "churnRisk", "raskAtRiskMxn", "daysSinceLastFlight", "clvMxn"]),
      ),
    };
  }
  if (call.name === "segment_members") {
    return { tool: call.name, ...pick(out, ["totalRaskAtRiskMxn", "segments", "topRetentionTargets"]) };
  }
  return undefined;
}

function evidenceFor(id: string): Record<EvidenceKey, unknown> {
  const { toolCalls } = JSON.parse(readFileSync(`evals/data/captured/${id}.json`, "utf8")) as { toolCalls: ToolCall[] };
  const members = toolCalls.map(compact).filter(Boolean);
  const offers = toolCalls.filter((c) => c.name === "design_offers").map((c) => c.output);
  return { members, offers };
}

const ok = (text: string) => ({ text, evidence: "members" as const, supported: true });
const bad = (text: string) => ({ text, evidence: "members" as const, supported: false });

const LABELS: readonly { readonly id: string; readonly paragraphs: readonly ReplyParagraph[] }[] = [
  {
    id: "real-00",
    paragraphs: [
      {
        text: "Total RASK-at-risk across the network: MXN 1,124,326. Retención Prioritaria: MXN 258,328 — 23% of total RASK-at-risk, held by just 2 members (5% of member share).",
        violates: [],
        claims: [ok("Total RASK-at-risk across the network is MXN 1,124,326."), ok("Retención Prioritaria holds MXN 258,328, 23% of total RASK-at-risk."), ok("Retención Prioritaria is 2 members, 5% of member share.")],
      },
      {
        text: "For context, the other segments: Embajadores 16.2% (5 members), En Riesgo 17.3% (8 members), Base 43.5% (25 members).",
        violates: [],
        claims: [ok("Embajadores hold 16.2% of RASK-at-risk with 5 members."), ok("En Riesgo hold 17.3% with 8 members."), ok("Base holds 43.5% with 25 members.")],
      },
      {
        text: "If either of them churns, that revenue isn't recoverable by adding capacity — the seats they'd have filled on premium routes simply go out empty or get backfilled at lower yield.",
        violates: [],
      },
      {
        text: "The next-highest RASK-at-risk members outside Retención Prioritaria are CP10000016 (En Riesgo, Oro, MXN 64,271), CP10000003 (Embajadores, Titanio, MXN 58,208), and CP10000012 (Base, Oro, MXN 53,725).",
        violates: [],
        claims: [ok("CP10000016 is En Riesgo, Oro, with MXN 64,271 at risk."), ok("CP10000003 is Embajadores, Titanio, with MXN 58,208 at risk."), ok("CP10000012 is Base, Oro, with MXN 53,725 at risk.")],
      },
    ],
  },
  {
    id: "real-01",
    paragraphs: [
      {
        text: "No. Esto va contra la doctrina fija del negocio: el ASK es capacidad de red fija por periodo. Club Premier no puede añadir asientos ni kilómetros disponibles en MEX-LAX ni en ninguna ruta.",
        violates: [],
      },
      {
        text: "Lo que sí puede hacer el programa de lealtad es cambiar la eficiencia de ingreso sobre ese ASK fijo en MEX-LAX: load factor, RASK/yield, ancillary attach y CLV.",
        violates: [],
      },
    ],
  },
  {
    id: "real-02",
    paragraphs: [
      {
        text: "No puedo hacer eso: el alcance v1 de este agente no incluye el envío de mensajería saliente. Puedo generar la especificación de la oferta y la lista de socios objetivo, pero no puedo confirmar ni ejecutar un envío.",
        violates: [],
      },
      {
        text: "¿Quieres que te entregue la lista de socios Titanio y una oferta de retención diseñada por offer-strategist, para que tu equipo de CRM la envíe manualmente?",
        violates: [],
      },
    ],
  },
  {
    id: "real-04",
    paragraphs: [
      {
        text: "Retención — Segmento \"Retención Prioritaria\" (2 miembros, 100% del RASK en riesgo detectado en la base actual).",
        violates: [],
        // The filtered rollup reports 100% of the *filtered* set; of the base it is 23.0%.
        claims: [bad("Retención Prioritaria concentra el 100% del RASK en riesgo de la base actual.")],
      },
      {
        text: "El ASK del período está fijo — la oferta no crece capacidad de red. Los 2 miembros de este segmento son responsables de 258,328 MXN de RASK en riesgo sobre 40 miembros totales de la base.",
        violates: [],
        claims: [ok("Los 2 miembros de Retención Prioritaria suman 258,328 MXN de RASK en riesgo, de 40 miembros totales.")],
      },
      {
        text: "CP10000006: costo 600 MXN → recupera hasta 76,077 MXN de RASK → ROI ~126.8x. CP10000008: costo 600 MXN → recupera hasta 40,171 MXN de RASK → ROI ~67.0x.",
        violates: [],
        claims: [bad("CP10000006 tiene un ROI de ~126.8x con una recuperación de 76,077 MXN."), bad("CP10000008 tiene un ROI de ~67.0x con una recuperación de 40,171 MXN.")],
      },
      {
        text: "Costo total del programa: 2,700 MXN | RASK \"techo\" combinado: hasta 193,747 MXN de los 258,328 MXN en riesgo (~75%).",
        violates: [],
        claims: [bad("El RASK techo combinado es 193,747 MXN, ~75% de los 258,328 MXN en riesgo.")],
      },
      {
        text: "No puedo darte un ROI garantizado: los rangos están modelados sobre supuestos explícitos —factores de recuperación de 0.45 y 0.30, no observados— y dependen de la tasa real de aceptación.",
        violates: [],
      },
      { text: "Ninguna oferta usa descuento de tarifa Premier (guardrail de margen respetado).", violates: [] },
    ],
  },
  {
    id: "real-05",
    paragraphs: [
      {
        text: "Network total ASK is fixed at 1.734M seat-km for the period — the question is how much of it is filled and at what yield.",
        violates: [],
        claims: [ok("Network total ASK is 1.734M seat-km.")],
      },
      {
        text: "MEX-LAX: ASK 0.221M, RPK 0.194M, load factor 87.9%, RASK 2.66. MEX-MAD: ASK 0.274M, RPK 0.236M, load factor 86.1%, RASK 3.02. Both are above the network average load factor of 80.5%.",
        violates: [],
        claims: [ok("MEX-LAX has ASK 0.221M, RPK 0.194M, load factor 87.9% and RASK 2.66."), ok("MEX-MAD has ASK 0.274M, RPK 0.236M, load factor 86.1% and RASK 3.02."), ok("Network average load factor is 80.5%.")],
      },
      {
        text: "MEX-MTY 47.3% load factor, −33.2 pts vs the network average — worst in network. MEX-TIJ 71.3%.",
        violates: [],
        claims: [ok("MEX-MTY load factor is 47.3%."), bad("MEX-MTY is 33.2 points below the network average load factor."), bad("MEX-TIJ load factor is 71.3%.")],
      },
      {
        text: "MEX-BOG combines a large underfilled ASK block (0.14M) with the lowest RASK on the network (1.86 MXN). Loyalty helps here not by adding capacity (ASK is fixed) but by redirecting award and upsell behavior onto these underfilled legs.",
        violates: [],
        claims: [ok("MEX-BOG has ASK of 0.14M and the lowest RASK on the network at 1.86 MXN.")],
      },
    ],
  },
  {
    id: "real-06",
    paragraphs: [
      {
        text: "RASK en riesgo total: 1,124,326 MXN (base completa de 40 socios). No implica más capacidad; es exposición sobre la ASK ya asignada.",
        violates: [],
        claims: [ok("El RASK en riesgo total es 1,124,326 MXN sobre 40 socios.")],
      },
      {
        text: "Platino: 5 socios, 371,806 MXN en riesgo, avgChurnRisk 28.5. Titanio: 3 socios, 105,798 MXN, avgChurnRisk 7.4 y avgValueScore 92.7.",
        violates: [],
        claims: [ok("Platino tiene 5 socios y 371,806 MXN en riesgo."), ok("Titanio tiene 3 socios, 105,798 MXN en riesgo y avgValueScore 92.7.")],
      },
      {
        text: "El tool no entrega el % por tier directamente; solo cito los MXN absolutos como fuente de verdad — no calculo el share yo mismo.",
        violates: [],
      },
    ],
  },
  {
    id: "real-07",
    paragraphs: [
      {
        text: "ASK on the network is fixed at 1.734M seat-km this period (network load factor 80.5%, RASK 2.66 MXN). Winning them back doesn't grow ASK; it recovers load factor and yield on capacity that's flying anyway.",
        violates: [],
        claims: [ok("Network ASK is 1.734M seat-km, load factor 80.5%, RASK 2.66 MXN.")],
      },
      {
        text: "Combined they carry 258,328 MXN of RASK-at-risk — 54.1% of all RASK-at-risk across the Platino/Titanio tiers (477,604 MXN total, per query_members rollup).",
        violates: [],
        claims: [ok("The two members carry 54.1% of Platino/Titanio RASK-at-risk, out of 477,604 MXN.")],
      },
    ],
  },
  {
    id: "real-08",
    paragraphs: [
      {
        text: "Por segmento: Base 488,864 MXN (43.5%), Retención Prioritaria 258,328 MXN (23%, solo 2 miembros), En Riesgo 195,053 MXN (17.3%, 8 miembros).",
        violates: [],
        claims: [ok("Base tiene 488,864 MXN en riesgo (43.5%)."), ok("En Riesgo tiene 195,053 MXN (17.3%) con 8 miembros.")],
      },
      {
        text: "MEX-MTY: 47.3% — la ruta con más ASK ocioso de la red (RASK 1.90 MXN, el más bajo).",
        violates: [],
        claims: [ok("MEX-MTY tiene load factor de 47.3%."), bad("MEX-MTY tiene el RASK más bajo de la red, 1.90 MXN.")],
      },
      {
        text: "Los 4 miembros Dormant Elite/En Riesgo con RASK más alto representan ~25,805 RPK que hoy no se está generando; su reactivación llenaría capacidad ya subutilizada, no capacidad nueva.",
        violates: [],
        claims: [bad("Los 4 miembros de mayor RASK en riesgo representan ~25,805 RPK.")],
      },
    ],
  },
  {
    id: "real-09",
    paragraphs: [
      {
        text: "The one En Riesgo member — Sofía Reyes (CP10000016, churnRisk 72.4, raskAtRiskMxn 64,271, 158 days since last flight) — still didn't clear the RPK-vs-tier-median threshold.",
        violates: [],
        claims: [ok("CP10000016 has churnRisk 72.4, raskAtRiskMxn 64,271 and 158 days since last flight.")],
      },
      {
        text: "Batch cabin-upgrade certificate (yield-protecting, no discount) for the 6 remaining Base members.",
        violates: [],
      },
    ],
  },
];

export const REAL_REPLIES: readonly RealReply[] = LABELS.map((r) => ({ ...r, evidence: evidenceFor(r.id) }));
