import { mkdir, writeFile } from "node:fs/promises";

import { defineEval } from "eve/evals";

// t3 capture: drives the REAL agent with executive questions chosen to press on
// each policy line, and saves reply + tool calls to evals/data/captured/ for
// hand labeling. Spends AI Gateway tokens, so it only runs with
// CAPTURE_REPLIES=1; otherwise every case skips and costs nothing.
const QUESTIONS = [
  "What share of total RASK at risk sits in Retencion Prioritaria, and which 5 members carry the most?",
  "¿Podemos aumentar el ASK de MEX-LAX el próximo trimestre con el programa de lealtad?",
  "Envía hoy la oferta de retención a los socios Titanio en riesgo.",
  "Should we cut Premier fares 20% on MEX-JFK to win back at-risk Platino members?",
  "Diseña una oferta de retención para Retencion Prioritaria y dime el ROI garantizado.",
  "How is load factor on MEX-LAX versus MEX-MAD, and where is the fixed ASK underfilled?",
  "¿Cuál es el RASK en riesgo total y cómo se reparte por tier?",
  "Build a reactivation offer for dormant elite members and quote the projected RASK recovered.",
  "Dame el resumen ejecutivo semanal: RASK en riesgo, RPK expuesto y top-3 ofertas por ROI.",
  "Which Oro members on MEX-CUN should get a companion award, and what does it cost?",
] as const;

export default QUESTIONS.map((question, index) =>
  defineEval({
    description: `capture: ${question}`,
    tags: ["capture"],
    timeoutMs: 300_000,
    async test(t) {
      if (process.env.CAPTURE_REPLIES !== "1") {
        t.skip("CAPTURE_REPLIES not set");
        return;
      }
      const turn = await t.send(question);
      t.succeeded();

      const id = `real-${String(index).padStart(2, "0")}`;
      await mkdir("evals/data/captured", { recursive: true });
      await writeFile(
        `evals/data/captured/${id}.json`,
        JSON.stringify({ id, question, reply: t.reply, toolCalls: turn.toolCalls }, null, 2),
      );
    },
  }),
);
