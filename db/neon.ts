import {neon} from "@neondatabase/serverless";
import {createPostgresDatabase} from "./postgres.ts";
import type {PgResult} from "./postgres.ts";
export function getNeonDb(connectionString:string) {
  const sql=neon(connectionString);
  return createPostgresDatabase(async queries=>{
    const results=await sql.transaction(queries.map(query=>sql.query(query.sql,query.params)),{fullResults:true,isolationLevel:"Serializable"});
    return results as unknown as PgResult[];
  });
}
