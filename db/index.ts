import { env } from "cloudflare:workers";
export function getDb(): D1Database {
  if (!env.DB) throw new Error("Scoreboard database is unavailable");
  return env.DB;
}
