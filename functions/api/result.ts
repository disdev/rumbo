// POST /api/result — append result row(s), idempotent via client UUID.

// @ts-ignore — módulo JS compartido con los tests de node (tests/result-validate.test.mjs)
import { partitionRows } from "./_validate.mjs";

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

const INSERT_SQL =
  "INSERT OR IGNORE INTO results (id, ts, user_email, kind, family, tier, chapter, category, score, total, duration_sec, detail_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const userEmail =
      ctx.request.headers.get("Cf-Access-Authenticated-User-Email") || null;

    let body: unknown;
    try {
      body = await ctx.request.json();
    } catch {
      return json({ ok: false, error: "malformed JSON body" }, 400);
    }

    const rows: unknown[] = Array.isArray(body) ? body : [body];
    if (rows.length === 0) {
      return json({ ok: false, error: "empty result array" }, 400);
    }

    // Validación POR FILA (spec 2026-07-06): las filas inválidas se reportan
    // en `rejected` y las válidas se insertan igual — un kind desconocido
    // jamás vuelve a frenar la cola entera del estudiante.
    const { valid, rejected } = partitionRows(rows) as {
      valid: Record<string, unknown>[];
      rejected: { id: string | null; error: string }[];
    };
    if (valid.length === 0) {
      return json({ ok: false, error: rejected[0]?.error ?? "no valid rows", rejected }, 400);
    }

    const statements: D1PreparedStatement[] = [];
    for (const r of valid) {
      const detail =
        r.detail_json == null
          ? null
          : typeof r.detail_json === "string"
            ? r.detail_json
            : JSON.stringify(r.detail_json);
      statements.push(
        ctx.env.DB.prepare(INSERT_SQL).bind(
          r.id,
          r.ts,
          userEmail,
          r.kind,
          r.family ?? null,
          r.tier ?? null,
          r.chapter ?? null,
          r.category ?? null,
          r.score ?? null,
          r.total ?? null,
          r.duration_sec ?? null,
          detail,
        ),
      );
    }

    if (statements.length === 1) {
      await statements[0].run();
    } else {
      await ctx.env.DB.batch(statements);
    }

    return json({ ok: true, received: statements.length, rejected });
  } catch (err) {
    console.error("POST /api/result failed:", err);
    return json({ ok: false, error: "internal error" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  return json({ ok: false, error: "method not allowed" }, 405);
};
