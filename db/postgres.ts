import type { PreparedStatement, QueryResult, ScoreboardDatabase } from "./contracts.ts";
export type PgQuery={sql:string;params:unknown[]};
export type PgResult={rows:Record<string,unknown>[];rowCount:number|null};
export type PgTransaction=(queries:PgQuery[])=>Promise<PgResult[]>;
export function postgresSql(sql:string):string {
  let position=0;
  return sql.replace(/\?/g,()=>`$${++position}`).replace(/MAX\(0, count \+ (\$\d+)\)/g,"GREATEST(0, count + $1)");
}
function result(input:PgResult):QueryResult {
  const results=input.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>{
    if(["count","version","created_at"].includes(key)&&typeof value==="string"){
      const number=Number(value);if(!Number.isSafeInteger(number))throw new Error("Database integer exceeds supported range");
      return [key,number];
    }
    return [key,value];
  })));
  return {results,meta:{changes:input.rowCount??0}};
}
export function createPostgresDatabase(transaction:PgTransaction):ScoreboardDatabase {
  async function execute(statements:Statement[]):Promise<QueryResult[]> {
    // Serializable transactions preserve D1's serialized-write assumptions.
    for(let attempt=0;;attempt++){
      try{return (await transaction(statements.map(s=>({sql:postgresSql(s.sql),params:s.values})))).map(result);}
      catch(error){
        const code=(error as {code?:string}).code;
        if(!["40001","40P01"].includes(code??"")||attempt>=4)throw error;
        await new Promise(resolve=>setTimeout(resolve,5*2**attempt));
      }
    }
  }
  class Statement implements PreparedStatement {
    readonly sql:string;
    readonly values:unknown[];
    constructor(sql:string,values:unknown[]=[]) {this.sql=sql;this.values=values;}
    bind(...values:unknown[]){return new Statement(this.sql,values);}
    async all<T>(){return (await execute([this]))[0] as QueryResult<T>;}
    async first<T>(){return (await this.all<T>()).results[0]??null;}
    async run(){return (await execute([this]))[0];}
  }
  return {
    prepare:sql=>new Statement(sql),
    batch:statements=>execute(statements.map(statement=>{
      if(!(statement instanceof Statement))throw new Error("Statement belongs to another database adapter");
      return statement;
    })),
  };
}
