import { Redis } from "@upstash/redis";

// Upstash Redis over HTTP, so it works from Vercel functions without a
// connection pool. Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
// Used for idempotency keys on writes and for rate limits.
export const redis = Redis.fromEnv();
