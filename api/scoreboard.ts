import {getNeonDb} from "../db/neon.ts";
import {createScoreboardHandlers} from "../lib/scoreboard-api.ts";
export async function handleScoreboard(request:Request):Promise<Response> {
  const headers={"Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff"};
  if(!["GET","POST"].includes(request.method))return Response.json({error:"Choose GET or POST."},{status:405,headers});
  if(!process.env.DATABASE_URL||process.env.NEON_SCHEMA_READY!=="1")return Response.json({error:"The shared scoreboard database is not ready yet."},{status:503,headers});
  const handlers=createScoreboardHandlers({getDb:()=>getNeonDb(process.env.DATABASE_URL!)});
  return request.method==="GET"?handlers.GET(request):handlers.POST(request);
}
export default {fetch:handleScoreboard};
