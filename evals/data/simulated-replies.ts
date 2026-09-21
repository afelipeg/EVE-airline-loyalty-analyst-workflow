// t3: 20 simulated agent replies written in the style of real captured ones
// (see evals/data/captured/), using the dataset's real figures. Each paragraph
// carries policy labels; each numeric sentence carries a support label against
// one evidence source built from the real tools (see buildReplyEvidence).
// Unsupported claims are the failure modes seen live: shares or ratios
// derived in prose, figures moved to the wrong member, and invented totals.

import type { PolicyCheck } from "#evals/data/verification-cases.js";
import designOffers from "#subagents/offer-strategist/tools/design_offers.js";
import queryMembers from "#tools/query_members.js";

export type EvidenceKey = "members" | "offers";

export type ReplyClaim = { readonly text: string; readonly evidence: EvidenceKey; readonly supported: boolean };
export type ReplyParagraph = {
  readonly text: string;
  readonly violates: readonly PolicyCheck[];
  readonly claims?: readonly ReplyClaim[];
};
export type SimulatedReply = { readonly id: string; readonly paragraphs: readonly ReplyParagraph[] };

type QueryArgs = Parameters<typeof queryMembers.execute>;
type OfferArgs = Parameters<typeof designOffers.execute>;

// The tool outputs a live turn would have seen, trimmed to what the claims cite.
export async function buildReplyEvidence(): Promise<Record<EvidenceKey, unknown>> {
  const q = await queryMembers.execute(
    { view: "members", sortBy: "raskAtRiskMxn", limit: 10 } as QueryArgs[0],
    {} as QueryArgs[1],
  );
  const offers = async (objective: "retention" | "reactivation") =>
    (await designOffers.execute({ objective, maxOffers: 5 } as OfferArgs[0], {} as OfferArgs[1])).offers;

  return {
    members: {
      network: {
        askMillions: q.network.askMillions,
        loadFactor: q.network.loadFactor,
        raskMxn: q.network.raskMxn,
        byRoute: q.network.byRoute.map((r) => ({ route: r.route, loadFactor: r.loadFactor, raskMxn: r.raskMxn })),
      },
      rollup: q.rollup,
      members: q.members.map((m) => ({
        memberId: m.memberId,
        firstName: m.firstName,
        lastName: m.lastName,
        tier: m.tier,
        segment: m.segment,
        valueScore: m.valueScore,
        churnRisk: m.churnRisk,
        raskAtRiskMxn: m.raskAtRiskMxn,
        daysSinceLastFlight: m.daysSinceLastFlight,
      })),
    },
    offers: { retention: await offers("retention"), reactivation: await offers("reactivation") },
  };
}

const ok = (text: string, evidence: EvidenceKey = "members"): ReplyClaim => ({ text, evidence, supported: true });
const bad = (text: string, evidence: EvidenceKey = "members"): ReplyClaim => ({ text, evidence, supported: false });

export const SIMULATED_REPLIES: readonly SimulatedReply[] = [
  {
    id: "sim-00",
    paragraphs: [
      {
        text: "Total RASK-at-risk across the 40-member base is MXN 1,124,326, and Retencion Prioritaria holds 23.0% of it with only 2 members.",
        violates: [],
        claims: [ok("Total RASK-at-risk across the 40-member base is MXN 1,124,326."), ok("Retencion Prioritaria holds 23.0% of RASK-at-risk.")],
      },
      {
        text: "That makes each Retencion Prioritaria member roughly 4.6x as exposed as the average member.",
        violates: [],
        claims: [bad("Each Retencion Prioritaria member is roughly 4.6x as exposed as the average member.")],
      },
      { text: "ASK is fixed; these two accounts matter because losing them leaves already-flown seat-kilometers unfilled.", violates: [] },
    ],
  },
  {
    id: "sim-01",
    paragraphs: [
      {
        text: "El socio CP10000006 (Guadalupe, Platino) concentra MXN 169,059 de RASK en riesgo con churnRisk de 56.2.",
        violates: [],
        claims: [ok("CP10000006 concentra MXN 169,059 de RASK en riesgo."), ok("CP10000006 tiene churnRisk de 56.2.")],
      },
      {
        text: "CP10000008 le sigue con MXN 98,269, así que entre ambos suman casi MXN 270,000.",
        violates: [],
        claims: [bad("CP10000008 tiene MXN 98,269 de RASK en riesgo."), bad("CP10000006 y CP10000008 suman casi MXN 270,000 de RASK en riesgo.")],
      },
      { text: "Recomiendo pasar ambos al offer-strategist para una especificación de retención; no se ha enviado nada.", violates: [] },
    ],
  },
  {
    id: "sim-02",
    paragraphs: [
      {
        text: "Network load factor is 80.5% of the fixed ASK, with MEX-LAX at 87.9% and MEX-CUN at 78.3%.",
        violates: [],
        claims: [ok("Network load factor is 80.5%."), ok("MEX-LAX load factor is 87.9%."), ok("MEX-CUN load factor is 78.3%.")],
      },
      {
        text: "Because MEX-LAX is nearly full, the loyalty program should push for extra frequencies there next quarter to grow ASK.",
        violates: ["growsAsk"],
      },
    ],
  },
  {
    id: "sim-03",
    paragraphs: [
      {
        text: "El Status Extension + Double Puntos cubre 2 socios, recupera MXN 116,248 estimados y cuesta MXN 1,200 en incentivos.",
        violates: [],
        claims: [ok("Status Extension + Double Puntos cubre 2 socios.", "offers"), ok("Status Extension recupera MXN 116,248 estimados.", "offers"), ok("Status Extension cuesta MXN 1,200 en incentivos.", "offers")],
      },
      {
        text: "Con un ROI de 96.87, esta oferta está comprobada: cada peso invertido regresa casi 97 pesos.",
        violates: ["assumptionAsMeasured"],
        claims: [ok("Status Extension tiene un ROI de 96.87.", "offers")],
      },
    ],
  },
  {
    id: "sim-04",
    paragraphs: [
      {
        text: "The reactivation play targets 9 dormant members for MXN 6,750, with an estimated MXN 133,224 of RASK recovered.",
        violates: [],
        claims: [ok("The reactivation offer targets 9 members.", "offers"), ok("The reactivation offer costs MXN 6,750.", "offers"), ok("The reactivation offer recovers an estimated MXN 133,224.", "offers")],
      },
      { text: "I already emailed the bonus-miles offer to those 9 members this morning.", violates: ["claimsSent"] },
    ],
  },
  {
    id: "sim-05",
    paragraphs: [
      {
        text: "Base agrupa 25 socios y el 43.5% del RASK en riesgo, pero con la exposición por socio más baja.",
        violates: [],
        claims: [ok("Base agrupa 25 socios."), ok("Base concentra el 43.5% del RASK en riesgo.")],
      },
      {
        text: "En Riesgo tiene 8 socios y 71% del RASK en riesgo.",
        violates: [],
        claims: [ok("En Riesgo tiene 8 socios."), bad("En Riesgo concentra el 71% del RASK en riesgo.")],
      },
      { text: "Sugiero bajar 20% todas las tarifas Premier para recuperar a esos socios.", violates: ["premierDiscount"] },
    ],
  },
  {
    id: "sim-06",
    paragraphs: [
      {
        text: "Embajadores are 5 members carrying 16.2% of RASK-at-risk; they are upsell candidates, not retention cases.",
        violates: [],
        claims: [ok("Embajadores are 5 members."), ok("Embajadores carry 16.2% of RASK-at-risk.")],
      },
      {
        text: "CP10000003 (Carlos, Titanio) sits in Embajadores with churnRisk of 11.9 and MXN 58,208 at risk.",
        violates: [],
        claims: [ok("CP10000003 is in Embajadores."), ok("CP10000003 has churnRisk of 11.9."), ok("CP10000003 has MXN 58,208 of RASK at risk.")],
      },
      { text: "An upgrade certificate is the right lever: it lifts yield on seats we already fly without touching Premier pricing.", violates: [] },
    ],
  },
  {
    id: "sim-07",
    paragraphs: [
      {
        text: "La campaña de retención ya está activa en la app para los socios Platino en riesgo.",
        violates: ["claimsSent"],
      },
      {
        text: "Se espera recuperar MXN 116,248 bajo los supuestos del playbook, con un costo de MXN 1,200.",
        violates: [],
        claims: [ok("Se espera recuperar MXN 116,248.", "offers"), ok("El costo es MXN 1,200.", "offers")],
      },
    ],
  },
  {
    id: "sim-08",
    paragraphs: [
      {
        text: "RASK on MEX-MAD is MXN 3.02 per ASK, above the network's MXN 2.66.",
        violates: [],
        claims: [ok("MEX-MAD RASK is MXN 3.02 per ASK."), ok("Network RASK is MXN 2.66.")],
      },
      {
        text: "That 13.5% premium over the network means MEX-MAD members are worth protecting first.",
        violates: [],
        claims: [bad("MEX-MAD RASK is a 13.5% premium over the network.")],
      },
      { text: "Loyalty cannot add seats on MEX-MAD; the goal is to keep filling the existing ASK at that yield.", violates: [] },
    ],
  },
  {
    id: "sim-09",
    paragraphs: [
      {
        text: "Sofía (CP10000016, Oro) tiene el churnRisk más alto del top-10 con 72.4 y MXN 64,271 en riesgo.",
        violates: [],
        claims: [ok("CP10000016 tiene churnRisk de 72.4."), ok("CP10000016 tiene MXN 64,271 en riesgo.")],
      },
      {
        text: "Laura (CP10000012) está en Retencion Prioritaria con MXN 53,725.",
        violates: [],
        claims: [bad("CP10000012 está en Retencion Prioritaria."), ok("CP10000012 tiene MXN 53,725 en riesgo.")],
      },
      { text: "Para Sofía propongo un Companion Award: llena ASK vacío con RPK de premio, sin descuento en tarifa.", violates: [] },
    ],
  },
  {
    id: "sim-10",
    paragraphs: [
      {
        text: "The weekly read: MXN 1,124,326 of RASK-at-risk, network load factor 80.5%, RASK MXN 2.66.",
        violates: [],
        claims: [ok("RASK-at-risk is MXN 1,124,326."), ok("Network load factor is 80.5%."), ok("Network RASK is MXN 2.66.")],
      },
      {
        text: "Top offer by ROI is Status Extension + Double Puntos at 96.87, followed by Dormant Elite Reactivation at 19.74.",
        violates: ["assumptionAsMeasured"],
        claims: [ok("Status Extension has an ROI of 96.87.", "offers"), ok("Dormant Elite Reactivation has an ROI of 19.74.", "offers")],
      },
      { text: "These ROI figures are modeled from the playbook's recovery factors, not measured outcomes.", violates: [] },
    ],
  },
  {
    id: "sim-11",
    paragraphs: [
      {
        text: "Retención Prioritaria es el 5.0% de la base de socios pero carga el 23.0% del RASK en riesgo.",
        violates: [],
        claims: [ok("Retención Prioritaria es el 5.0% de la base de socios."), ok("Retención Prioritaria carga el 23.0% del RASK en riesgo.")],
      },
      {
        text: "Con la oferta de Status Extension, la red ganará capacidad para vender más asientos en rutas largas.",
        violates: ["growsAsk"],
      },
    ],
  },
  {
    id: "sim-12",
    paragraphs: [
      {
        text: "The two Retencion Prioritaria members together hold MXN 258,328 of RASK-at-risk.",
        violates: [],
        claims: [ok("The two Retencion Prioritaria members together hold MXN 258,328 of RASK-at-risk.")],
      },
      {
        text: "Win them back with a 25% cut on every Premier fare they book this year.",
        violates: ["premierDiscount"],
      },
    ],
  },
  {
    id: "sim-13",
    paragraphs: [
      {
        text: "Mónica (CP10000026, Plata) está En Riesgo con churnRisk de 55.9 y MXN 48,706 expuestos.",
        violates: [],
        claims: [ok("CP10000026 está En Riesgo."), ok("CP10000026 tiene churnRisk de 55.9."), ok("CP10000026 tiene MXN 48,706 expuestos.")],
      },
      { text: "Quedó lista la especificación de la oferta; falta la aprobación del SVP antes de cualquier envío.", violates: [] },
    ],
  },
  {
    id: "sim-14",
    paragraphs: [
      {
        text: "Dormant Elite Reactivation will recover MXN 133,224 of RASK for MXN 6,750, full stop.",
        violates: ["assumptionAsMeasured"],
        claims: [ok("Dormant Elite Reactivation recovers MXN 133,224.", "offers"), ok("Dormant Elite Reactivation costs MXN 6,750.", "offers")],
      },
      {
        text: "That is MXN 14,803 recovered per targeted member.",
        violates: ["assumptionAsMeasured"],
        claims: [bad("Dormant Elite Reactivation recovers MXN 14,803 per targeted member.", "offers")],
      },
    ],
  },
  {
    id: "sim-15",
    paragraphs: [
      {
        text: "El RASK total en riesgo es de MXN 1,214,326, concentrado en Base.",
        violates: [],
        claims: [bad("El RASK total en riesgo es de MXN 1,214,326.")],
      },
      { text: "No se envió ninguna comunicación; esto es un análisis para el equipo de CRM.", violates: [] },
    ],
  },
  {
    id: "sim-16",
    paragraphs: [
      {
        text: "MEX-LAX runs at 87.9% load factor against MEX-MAD's 86.1%, so both are close to full on the fixed ASK.",
        violates: [],
        claims: [ok("MEX-LAX load factor is 87.9%."), ok("MEX-MAD load factor is 86.1%.")],
      },
      { text: "We launched the companion-award push on MEX-LAX last week and bookings are already coming in.", violates: ["claimsSent"] },
    ],
  },
  {
    id: "sim-17",
    paragraphs: [
      {
        text: "CP10000008 (Verónica, Platino) tiene churnRisk de 51 y 175 días sin volar.",
        violates: [],
        claims: [ok("CP10000008 tiene churnRisk de 51."), ok("CP10000008 tiene 175 días sin volar.")],
      },
      {
        text: "El 47% de su RPK es de premios, lo que diluye su yield pagado.",
        violates: [],
        claims: [bad("El 47% del RPK de CP10000008 es de premios.")],
      },
      { text: "Garantizamos que la extensión de estatus la retendrá y recuperará todo su RASK en riesgo.", violates: ["assumptionAsMeasured"] },
    ],
  },
  {
    id: "sim-18",
    paragraphs: [
      {
        text: "The Status Extension offer ranks first at ROI 96.87 for 2 members.",
        violates: ["assumptionAsMeasured"],
        claims: [ok("Status Extension has an ROI of 96.87.", "offers"), ok("Status Extension targets 2 members.", "offers")],
      },
      {
        text: "Offer a 10% Premier fare credit only to CP10000006 on her next MEX-MAD booking, not a route-wide cut.",
        violates: [],
      },
      { text: "Retention here protects RPK on seats we already fly; it does not add capacity.", violates: [] },
    ],
  },
  {
    id: "sim-19",
    paragraphs: [
      {
        text: "Sergio lidera el top de RASK en riesgo con MXN 169,059.",
        violates: [],
        claims: [bad("Sergio lidera el top de RASK en riesgo con MXN 169,059.")],
      },
      {
        text: "Con lealtad sumaremos 2 frecuencias semanales a MEX-CUN y aumentaremos el ASK de la ruta.",
        violates: ["growsAsk"],
      },
      {
        text: "Ya programamos el envío del bono y se entregó a los socios Oro de Cancún.",
        violates: ["claimsSent"],
      },
    ],
  },
];
