/**
 * Rate limiting via Upstash Redis.
 *
 * Graceful fallback: if @upstash/redis is not installed or
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN env vars are absent,
 * every call returns { allowed: true, remaining: 999, resetAt: 0 } so the
 * server keeps working without Redis configured.
 *
 * To enable real rate limiting:
 *   1. npm install @upstash/redis
 *   2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Minimal duck-typed interface — avoids a hard dependency on @upstash/redis types
interface RedisClient {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
}

const NO_OP_RESULT: RateLimitResult = { allowed: true, remaining: 999, resetAt: 0 }

function isConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  )
}

// Lazy singleton — initialised once, reused across requests in the same process
let _redis: RedisClient | null = null

async function getRedis(): Promise<RedisClient | null> {
  if (_redis) return _redis
  if (!isConfigured()) return null

  try {
    // require() is used instead of import() so tsc never tries to resolve the
    // @upstash/redis module — the package may not be installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    // @ts-ignore — optional peer dependency
    const mod = require('@upstash/redis') as { Redis: { fromEnv(): RedisClient } }
    _redis = mod.Redis.fromEnv()
    return _redis
  } catch {
    // Package not installed or require failed — silently degrade
    return null
  }
}

/**
 * Check whether a given key is within its rate limit window.
 *
 * @param key           Unique identifier (e.g. "upload:1.2.3.4")
 * @param limit         Maximum number of requests allowed in the window
 * @param windowSeconds Rolling window size in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = await getRedis()
  if (!redis) return NO_OP_RESULT

  try {
    const now = Math.floor(Date.now() / 1000)
    const windowKey = `rl:${key}:${Math.floor(now / windowSeconds)}`
    const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds

    const count = await redis.incr(windowKey)
    if (count === 1) {
      await redis.expire(windowKey, windowSeconds)
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    }
  } catch {
    // Redis call failed — fail open so the service stays available
    return NO_OP_RESULT
  }
}
