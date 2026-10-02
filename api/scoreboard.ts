/** Same-origin gateway to the existing persistent Worker. No database copies. */
export async function proxyScoreboard(request: Request, backend=process.env.SCOREBOARD_API_ORIGIN, send:typeof fetch=fetch):Promise<Response> {
  const headers={"Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff"};
  const fail=(error:string,status:number)=>Response.json({error},{status,headers});
  if(!["GET","POST"].includes(request.method))return fail("Choose GET or POST.",405);
  if(request.method==="POST"&&request.headers.get("sec-fetch-site")==="cross-site")return fail("Please use this scoreboard to make changes.",403);
  if(!backend)return fail("The shared scoreboard backend has not been configured.",503);
  try{
    const origin=new URL(backend);
    if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash||origin.origin===new URL(request.url).origin)return fail("The shared scoreboard backend configuration is invalid.",503);
    const url=new URL("/api/scoreboard",origin);
    const room=new URL(request.url).searchParams.get("room");
    if(room!==null)url.searchParams.set("room",room);
    const forwarded=new Headers();
    // Never forward identity headers, authorization, or upstream host routing.
    for(const key of ["cookie","content-type","sec-fetch-site"]) {
      const value=request.headers.get(key);if(value)forwarded.set(key,value);
    }
    let body:string|undefined;
    if(request.method==="POST"){
      if(!request.headers.get("content-type")?.includes("application/json"))return fail("Please send JSON.",415);
      body=await request.text();if(body.length>1024)return fail("That request is too long.",413);
    }
    const upstream=await send(url,{method:request.method,headers:forwarded,body,redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(upstream.status>=300&&upstream.status<400||!upstream.headers.get("content-type")?.includes("application/json"))return fail("The shared scoreboard backend is unavailable.",503);
    const responseHeaders=new Headers(headers);responseHeaders.set("Content-Type","application/json");
    // Preserve private room cookies verbatim; current backend uses no Domain.
    for(const cookie of upstream.headers.getSetCookie())responseHeaders.append("Set-Cookie",cookie);
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  }catch{return fail("The scoreboard couldn't connect. Please try again.",503);}
}
export default {fetch:(request:Request)=>proxyScoreboard(request)};
