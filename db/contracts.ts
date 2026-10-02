export type QueryResult<T=Record<string,unknown>>={results:T[];meta:{changes:number}};
export interface PreparedStatement {
  bind(...values:unknown[]):PreparedStatement;
  first<T=Record<string,unknown>>():Promise<T|null>;
  all<T=Record<string,unknown>>():Promise<QueryResult<T>>;
  run():Promise<QueryResult>;
}
export interface ScoreboardDatabase {
  prepare(sql:string):PreparedStatement;
  batch(statements:PreparedStatement[]):Promise<QueryResult[]>;
}
