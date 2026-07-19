import { getDb } from "./db";

/** Product analytics event tracking — an MVP requirement in its own right. */
export function track(userId: number | null, name: string, props: Record<string, unknown> = {}) {
  try {
    getDb()
      .prepare("INSERT INTO events (user_id, name, props) VALUES (?,?,?)")
      .run(userId, name, JSON.stringify(props));
  } catch {
    // analytics must never break the product
  }
}
