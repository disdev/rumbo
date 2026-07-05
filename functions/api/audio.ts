// POST /api/audio?id=<uuid> — upload a teach-back recording (webm/opus) to R2.

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
interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: R2HTTPMetadata },
  ): Promise<unknown>;
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

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const url = new URL(ctx.request.url);
    const id = url.searchParams.get("id") || "";
    if (!ID_RE.test(id)) {
      return json({ ok: false, error: "invalid or missing ?id" }, 400);
    }

    // Cheap early rejection when the client declares its size.
    const declared = parseInt(
      ctx.request.headers.get("Content-Length") || "0",
      10,
    );
    if (declared > MAX_BYTES) {
      return json({ ok: false, error: "audio exceeds 3 MB limit" }, 413);
    }

    const body = await ctx.request.arrayBuffer();
    if (body.byteLength === 0) {
      return json({ ok: false, error: "empty body" }, 400);
    }
    if (body.byteLength > MAX_BYTES) {
      return json({ ok: false, error: "audio exceeds 3 MB limit" }, 413);
    }

    const key = `teachback/${id}.webm`;
    const contentType =
      ctx.request.headers.get("Content-Type") || "audio/webm";
    await ctx.env.AUDIO.put(key, body, { httpMetadata: { contentType } });

    return json({ ok: true, key });
  } catch (err) {
    console.error("POST /api/audio failed:", err);
    return json({ ok: false, error: "internal error" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  return json({ ok: false, error: "method not allowed" }, 405);
};
