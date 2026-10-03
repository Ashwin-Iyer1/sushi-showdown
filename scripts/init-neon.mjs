// Run only for the newly provisioned separate Sushi Showdown database.
// Use native `vercel env pull` then `node --env-file=.env.local ...`.
import {readFile} from "node:fs/promises";
import {neon} from "@neondatabase/serverless";
const connection=process.env.DATABASE_URL_UNPOOLED;
const expectedHost=process.env.SUSHI_NEON_EXPECTED_HOST;
if(!connection||!expectedHost||expectedHost.includes("-pooler")||new URL(connection).hostname!==expectedHost||!expectedHost.endsWith(".neon.tech"))throw new Error("A verified separate Neon database and matching direct hostname are required");
const sql=neon(connection);
const existing=await sql.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
if(existing.length)throw new Error("The target contains tables; refusing to modify an existing database");
const schema=await readFile(new URL("../db/postgres-schema.sql",import.meta.url),"utf8");
await sql.transaction(schema.split(";").map(statement=>statement.trim()).filter(Boolean).map(statement=>sql.query(statement)),{isolationLevel:"Serializable"});
console.log("Initialized the five-table Sushi Showdown schema in the verified empty database.");
