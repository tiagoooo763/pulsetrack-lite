/**
 * Proteção em memória contra força bruta e tentativas abusivas em rotas de autenticação
 * (login, cadastro e recuperação de senha).
 * Em ambientes serverless, complementa o rate limit nativo do Supabase Auth.
 */

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();
const MAX_BUCKETS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = params.now ?? Date.now();
  const windowStart = now - params.windowMs;

  // Limpeza preventiva para evitar crescimento indefinido de memória
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets.entries()) {
      const active = b.timestamps.filter((t) => t > windowStart);
      if (active.length === 0) buckets.delete(k);
    }
  }

  const bucket = buckets.get(params.key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= params.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterMs = Math.max(1000, oldest + params.windowMs - now);
    buckets.set(params.key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(params.key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, params.limit - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function resetRateLimitStore(): void {
  buckets.clear();
}
