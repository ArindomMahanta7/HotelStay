import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config.js";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const db = drizzle({
  client: pool,
  schema,
});

export async function closeDb() {
  await pool.end();
}
