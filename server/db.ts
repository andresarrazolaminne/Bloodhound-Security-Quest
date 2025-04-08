import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Create a PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });

// Health check function
export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    console.error("Database connection error:", err);
    return false;
  }
}

export { pool };