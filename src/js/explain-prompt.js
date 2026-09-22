// Prompt listo para pegar en ChatGPT por cada pregunta fallada en un
// simulacro o quiz por tema (mentor directive 2026-09-22) — para cuando el
// estudiante quiere una explicación más conversacional que la línea de
// `reason` del banco.
const LETTERS = 'ABCDEFGH';

export function buildExplainPrompt({ category, question, options, answer }) {
  const optsList = options.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n');
  const correct = options[answer];
  return `Estoy preparando el examen teórico DGAC (Perú) para piloto privado (PPL) y fallé esta pregunta de la categoría "${category}":

${question}

${optsList}

La respuesta correcta es: "${correct}".

Explícamela paso a paso, en español y en términos simples para un estudiante de piloto privado — por qué esa opción es la correcta y por qué las demás no lo son.`;
}
