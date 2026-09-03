import { Redis } from "@upstash/redis";

// Explicit config rather than Redis.fromEnv() — that helper looks for
// UPSTASH_REDIS_REST_URL/TOKEN, but Vercel's marketplace integration
// provisions KV_REST_API_URL/TOKEN instead.
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
