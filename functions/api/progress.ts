// GET /api/progress — mentor-only dashboard data (rows + SQL aggregates).
// Cloudflare Access enforces the mentor policy at the edge; this Function
// re-verifies the authenticated email as defense in depth (SPEC §8).

// Minimal ambient Cloudflare types (no @cloudflare/workers-types dependency).
interface D1Result {
  success: boolean;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
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
  STUDENT_EMAIL?: string;
  ANTHROPIC_API_KEY?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    // Defense in depth: if MENTOR_EMAIL is configured, the authenticated
    // email must match it. (Unset = local dev; allow.)
    const mentor = ctx.env.MENTOR_EMAIL;
    if (mentor) {
      const email =
        ctx.request.headers.get("Cf-Access-Authenticated-User-Email") || "";
      if (email.toLowerCase() !== mentor.toLowerCase()) {
        return json({ ok: false, error: "forbidden" }, 403);
      }
    }

    // The dashboard reflects the STUDENT's log only — mentor/other rows are
    // stored for audit but never pollute progress (SPEC §8). NULL = local dev
    // or pre-Access rows.
    const student = ctx.env.STUDENT_EMAIL;
    const where = student
      ? "WHERE user_email IS NULL OR LOWER(user_email) = LOWER(?1)"
      : "";
    const bindArgs = student ? [student] : [];

    const { results } = await ctx.env.DB.prepare(
      `SELECT id, ts, user_email, kind, family, tier, chapter, category, score, total, duration_sec, detail_json FROM results ${where} ORDER BY ts ASC`,
    ).bind(...bindArgs).all();

    const totals = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS row_count, MAX(ts) AS last_sync_ts FROM results ${where}`,
    ).bind(...bindArgs).first<{ row_count: number; last_sync_ts: number | null }>();

    const byCategory = await ctx.env.DB.prepare(
      `SELECT category, kind, COUNT(*) AS n, SUM(score) AS score_sum, SUM(total) AS total_sum FROM results ${where ? where + " AND" : "WHERE"} kind IN ('quiz', 'simulacro', 'rapidfire') GROUP BY category, kind ORDER BY category, kind`,
    ).bind(...bindArgs).all();

    return json({
      results,
      aggregates: {
        row_count: totals?.row_count ?? 0,
        last_sync_ts: totals?.last_sync_ts ?? null,
        by_category: byCategory.results,
      },
    });
  } catch (err) {
    console.error("GET /api/progress failed:", err);
    return json({ ok: false, error: "internal error" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  return json({ ok: false, error: "method not allowed" }, 405);
};
