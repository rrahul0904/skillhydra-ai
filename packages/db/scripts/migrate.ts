import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const directory = resolve(process.cwd(), "packages/db/migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
const pool = new Pool({ connectionString });

try {
  await pool.query(`
    create table if not exists schema_migrations(
      name text primary key,
      applied_at timestamptz not null default now()
    )`);

  for (const file of files) {
    const applied = await pool.query("select 1 from schema_migrations where name=$1", [file]);
    if (applied.rowCount) continue;

    const sql = await readFile(resolve(directory, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations(name) values($1)", [file]);
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
