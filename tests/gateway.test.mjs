import test from "node:test";
import assert from "node:assert/strict";
import {proxyScoreboard} from "../api/scoreboard.ts";

const backend="https://persistent.example";
test("unconfigured or self-referencing backend fails closed",async()=>{
  const request=new Request("https://frontend.example/api/scoreboard");
  for(const origin of ["","http://persistent.example","https://frontend.example","https://persistent.example/path"]){
    const result=await proxyScoreboard(request,origin,()=>assert.fail("must not contact backend"));
    assert.equal(result.status,503);
  }
});
test("reads preserve room and private cookies but strip identity headers",async()=>{
  const result=await proxyScoreboard(new Request("https://frontend.example/api/scoreboard?room=ABC234&redirect=https://evil.example",{headers:{cookie:"sushi_room_ABC234=private",authorization:"secret","x-user-email":"spoof@example.com"}}),backend,async(url,init)=>{
    assert.equal(String(url),`${backend}/api/scoreboard?room=ABC234`);
    assert.equal(init.headers.get("cookie"),"sushi_room_ABC234=private");
    assert.equal(init.headers.get("authorization"),null);
    assert.equal(init.headers.get("x-user-email"),null);
    assert.equal(init.redirect,"manual");
    return Response.json({role:"participant"});
  });
  assert.deepEqual(await result.json(),{role:"participant"});
  assert.match(result.headers.get("cache-control"),/no-store/);
});
test("writes retain operation IDs, backend permissions and session cookies",async()=>{
  const body=JSON.stringify({action:"adjust",roomCode:"ABC234",operationId:"retry-id",participantId:"own-id",delta:1});
  const result=await proxyScoreboard(new Request("https://frontend.example/api/scoreboard",{method:"POST",headers:{"content-type":"application/json","sec-fetch-site":"same-origin"},body}),backend,async(url,init)=>{
    assert.equal(init.body,body);
    return Response.json({role:"host"},{status:201,headers:{"Set-Cookie":"sushi_room_ABC234=private; Path=/; HttpOnly; Secure; SameSite=Lax"}});
  });
  assert.equal(result.status,201);
  assert.match(result.headers.get("set-cookie"),/HttpOnly; Secure; SameSite=Lax/);
  const rejected=await proxyScoreboard(new Request("https://frontend.example/api/scoreboard"),backend,async()=>Response.json({error:"only your own"},{status:403}));
  assert.equal(rejected.status,403);
});
test("cross-site writes and invalid requests never reach backend",async()=>{
  const send=()=>assert.fail("must not contact backend");
  assert.equal((await proxyScoreboard(new Request("https://frontend.example/api/scoreboard",{method:"POST",headers:{"sec-fetch-site":"cross-site"}}),backend,send)).status,403);
  assert.equal((await proxyScoreboard(new Request("https://frontend.example/api/scoreboard",{method:"DELETE"}),backend,send)).status,405);
  assert.equal((await proxyScoreboard(new Request("https://frontend.example/api/scoreboard",{method:"POST",body:"text"}),backend,send)).status,415);
  assert.equal((await proxyScoreboard(new Request("https://frontend.example/api/scoreboard",{method:"POST",headers:{"content-type":"application/json"},body:"x".repeat(1025)}),backend,send)).status,413);
});
test("upstream redirects, HTML authentication gates and outages fail closed",async()=>{
  for(const send of [async()=>new Response(null,{status:302,headers:{location:"https://evil.example"}}),async()=>new Response("sign in",{headers:{"content-type":"text/html"}}),async()=>{throw new Error("offline");}]){
    assert.equal((await proxyScoreboard(new Request("https://frontend.example/api/scoreboard"),backend,send)).status,503);
  }
});
