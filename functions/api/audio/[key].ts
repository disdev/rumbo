// GET /api/audio/<key> — stream a stored teach-back recording from R2.
// <key> is the bare recording id; the R2 object key is teachback/<id>.webm.

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
interface R2HTTPMetadata {
  contentType?: string;
}
interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: R2HTTPMetadata;
}
interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: R2HTTPMetadata },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
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

const ID_RE = /^[A-Za-z0-9-]{8,64}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const raw = ctx.params.key;
    const id = typeof raw === "string" ? raw : "";
    if (!ID_RE.test(id)) {
      return json({ ok: false, error: "invalid key" }, 400);
    }

    const object = await ctx.env.AUDIO.get(`teachback/${id}.webm`);
    if (!object) {
      return json({ ok: false, error: "not found" }, 404);
    }

    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "audio/webm",
      },
    });
  } catch (err) {
    console.error("GET /api/audio/[key] failed:", err);
    return json({ ok: false, error: "internal error" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  return json({ ok: false, error: "method not allowed" }, 405);
};
