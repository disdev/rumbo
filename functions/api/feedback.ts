// POST /api/feedback — grade a free-text study entry against its grounding
// material via the Claude API (SPEC §5.7). Stores the feedback as its own
// appended result row (kind='feedback') referencing the entry's UUID.

// Minimal ambient Cloudflare types (no @cloudflare/workers-types dependency).
interface D1Result {
  success: boolean;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
interface R2Bucket {
  put(key: string, value: ArrayBuffer): Promise<unknown>;
  get(key: string): Promise<unknown>;
}
type PagesFunction<Env = unknown> = (ctx: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}) => Response | Promise<Response>;

interface Env {
  DB: D1Database;
  AUDIO: R2Bucket;
  MENTOR_EMAIL?: string;
  ANTHROPIC_API_KEY?: string;
}

interface Grounding {
  chapter?: string;
  key_points?: string[];
  scenario_prompt?: string;
  question?: string;
  options?: string[];
}

interface Feedback {
  covered: string[];
  missing: string[];
  comment: string;
  flags: {
    gibberish?: boolean;
    padding?: boolean;
    transcription?: boolean;
  };
}

const ENTRY_KINDS = new Set(["recall", "scenario", "distractor_explain"]);
const MAX_TEXT_CHARS = 8000;

const SYSTEM_PROMPT = `Eres el evaluador de un piloto estudiante peruano que se prepara para el examen teórico de piloto privado (DGAC). El estudiante escribe entradas de estudio en texto libre (recuerdo libre de un capítulo, resolución de un escenario, o explicación de por qué los distractores de una pregunta son incorrectos). Tu única tarea es evaluar la entrada del estudiante CONTRA el material de referencia (grounding) que se te proporciona.

Reglas estrictas:
- Evalúa únicamente cobertura y exactitud respecto al material de referencia proporcionado. NUNCA introduzcas hechos, cifras, procedimientos ni afirmaciones técnicas que no estén en el material de referencia.
- "covered": los puntos clave del material de referencia que el estudiante sí cubrió correctamente — MÁXIMO 6, los más importantes, cada uno como paráfrasis fiel muy breve (≤10 palabras). Si cubrió más de 6, elige los 6 más centrales.
- "missing": los puntos clave que omitió o expresó de forma incorrecta — MÁXIMO 5, elige los MÁS importantes del capítulo (los que más probablemente caen en el examen), cada uno ≤10 palabras. Nunca listes todo lo que falta: cinco prioridades valen más que cuarenta reproches.
- "comment": 2-3 frases en español, tono directo y alentador. Señala lo más importante que faltó o lo que estuvo bien logrado. No repitas las listas.
- "flags": marca "gibberish" si el texto es incoherente o sin sentido; "padding" si el texto rellena con palabrería para aparentar volumen sin contenido real; "transcription" si el texto parece copiado o transcrito literalmente de una fuente en vez de recordado o razonado con sus propias palabras. Usa false cuando no aplique.
- Si el material de referencia NO incluye puntos clave (key_points vacío o ausente), evalúa solamente la coherencia y la especificidad del texto del estudiante, deja "covered" y "missing" como listas vacías, y dilo explícitamente en el comentario.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin bloques de código, con exactamente esta forma:
{"covered": string[], "missing": string[], "comment": string, "flags": {"gibberish": boolean, "padding": boolean, "transcription": boolean}}`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseModelJson(text: string): Feedback | null {
  let t = text.trim();
  // Strip markdown code fences if present.
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  // Fall back to the outermost {...} span.
  if (!t.startsWith("{")) {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    t = t.slice(start, end + 1);
  }
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      covered: Array.isArray(parsed.covered)
        ? parsed.covered.filter((x): x is string => typeof x === "string")
        : [],
      missing: Array.isArray(parsed.missing)
        ? parsed.missing.filter((x): x is string => typeof x === "string")
        : [],
      comment:
        typeof parsed.comment === "string"
          ? parsed.comment
          : "(retroalimentación no disponible)",
      flags:
        typeof parsed.flags === "object" && parsed.flags !== null
          ? (parsed.flags as Feedback["flags"])
          : {},
    };
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    if (!ctx.env.ANTHROPIC_API_KEY) {
      return json({ ok: false, error: "feedback_unconfigured" }, 501);
    }

    let body: Record<string, unknown>;
    try {
      body = (await ctx.request.json()) as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: "malformed JSON body" }, 400);
    }

    const { id, entry_id, entry_kind, text } = body;
    if (typeof id !== "string" || id.length === 0 || id.length > 64) {
      return json({ ok: false, error: "id must be a string of at most 64 chars" }, 400);
    }
    if (typeof entry_id !== "string" || entry_id.length === 0 || entry_id.length > 64) {
      return json({ ok: false, error: "entry_id must be a string of at most 64 chars" }, 400);
    }
    if (typeof entry_kind !== "string" || !ENTRY_KINDS.has(entry_kind)) {
      return json(
        { ok: false, error: "entry_kind must be one of: recall, scenario, distractor_explain" },
        400,
      );
    }
    if (typeof text !== "string" || text.length === 0 || text.length > MAX_TEXT_CHARS) {
      return json(
        { ok: false, error: `text must be a non-empty string of at most ${MAX_TEXT_CHARS} chars` },
        400,
      );
    }
    const grounding: Grounding =
      typeof body.grounding === "object" && body.grounding !== null
        ? (body.grounding as Grounding)
        : {};

    // Build the user message: grounding material first, student text after.
    const parts: string[] = [`Tipo de entrada: ${entry_kind}`];
    if (grounding.chapter) parts.push(`Capítulo: ${grounding.chapter}`);
    if (grounding.scenario_prompt) {
      parts.push(`Escenario planteado:\n${grounding.scenario_prompt}`);
    }
    if (grounding.question) parts.push(`Pregunta:\n${grounding.question}`);
    if (Array.isArray(grounding.options) && grounding.options.length > 0) {
      parts.push(
        "Opciones:\n" + grounding.options.map((o, i) => `${i + 1}. ${o}`).join("\n"),
      );
    }
    if (Array.isArray(grounding.key_points) && grounding.key_points.length > 0) {
      parts.push(
        "Puntos clave del material de referencia:\n" +
          grounding.key_points.map((p) => `- ${p}`).join("\n"),
      );
    } else {
      parts.push(
        "Puntos clave del material de referencia: (ninguno — evalúa solo coherencia y especificidad)",
      );
    }
    parts.push(`Texto del estudiante:\n${text}`);

    let feedback: Feedback = {
      covered: [],
      missing: [],
      comment: "(retroalimentación no disponible)",
      flags: {},
    };

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ctx.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: parts.join("\n\n") }],
      }),
    });

    if (apiResponse.ok) {
      const data = (await apiResponse.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const textBlock = (data.content || []).find(
        (b) => b.type === "text" && typeof b.text === "string",
      );
      if (textBlock?.text) {
        const parsed = parseModelJson(textBlock.text);
        if (parsed) feedback = parsed;
      }
    } else {
      console.error(
        "Anthropic API error:",
        apiResponse.status,
        await apiResponse.text(),
      );
    }
    // On parse failure or API error we fall through with the fallback
    // feedback object and ok:true so the client isn't blocked.

    const userEmail =
      ctx.request.headers.get("Cf-Access-Authenticated-User-Email") || null;
    await ctx.env.DB.prepare(
      "INSERT OR IGNORE INTO results (id, ts, user_email, kind, family, tier, chapter, category, score, total, duration_sec, detail_json) VALUES (?1, ?2, ?3, 'feedback', NULL, NULL, ?4, NULL, NULL, NULL, NULL, ?5)",
    )
      .bind(
        id,
        Date.now(),
        userEmail,
        grounding.chapter || null,
        JSON.stringify({ entry_id, entry_kind, feedback }),
      )
      .run();

    return json({ ok: true, feedback });
  } catch (err) {
    console.error("POST /api/feedback failed:", err);
    return json({ ok: false, error: "internal error" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  return json({ ok: false, error: "method not allowed" }, 405);
};
