// Explicit live verification. Creates only isolated QA rooms; never prints tokens.
import assert from "node:assert/strict";
const origin=process.env.PUBLIC_APP_ORIGIN;
if(!origin||new URL(origin).protocol!=="https:"||!new URL(origin).hostname.startsWith("sushi-showdown")||!new URL(origin).hostname.endsWith(".vercel.app"))throw new Error("Provide the verified Sushi Showdown production origin");
async function post(body,cookie){
  const response=await fetch(`${origin}/api/scoreboard`,{method:"POST",headers:{"content-type":"application/json",...(cookie?{cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  return {status:response.status,data,cookie:response.headers.get("set-cookie")?.split(";")[0],cookieFlags:response.headers.get("set-cookie")};
}
const homepage=await fetch(origin,{redirect:"manual"});assert.equal(homepage.status,200,"Production landing must be public without Vercel authentication");
assert.match(await homepage.text(),/Sushi Showdown/);
const host=await post({action:"createRoom",name:"QA verification host"});assert.equal(host.status,201);
assert.match(host.cookieFlags,/HttpOnly/);assert.match(host.cookieFlags,/Secure/);assert.match(host.cookieFlags,/SameSite=Lax/);
const roomCode=host.data.room.code;
const player=await post({action:"join",roomCode,name:"QA verification player"});assert.equal(player.status,201);
const id=player.data.participantId;
const operationId=crypto.randomUUID();
const adjust={action:"adjust",roomCode,participantId:id,operationId,delta:1};
assert.equal((await post(adjust,player.cookie)).status,200);
assert.equal((await post(adjust,player.cookie)).data.participants.find(p=>p.id===id).count,1);
assert.equal((await post({...adjust,participantId:host.data.participantId,operationId:crypto.randomUUID()},player.cookie)).status,403);
assert.equal((await post({...adjust,operationId:crypto.randomUUID()},host.cookie)).status,200);
const viewer=await fetch(`${origin}/api/scoreboard?room=${roomCode}`).then(r=>r.json());
assert.equal(viewer.role,"spectator");assert.equal(viewer.participants.find(p=>p.id===id).count,2);
assert.equal((await post({...adjust,operationId:crypto.randomUUID()})).status,403);
const link=await post({action:"participantLink",roomCode,participantId:id},host.cookie);assert.equal(link.status,200);
const resumed=await post({action:"enterParticipant",roomCode,participantId:id,token:link.data.participantToken});assert.equal(resumed.status,200);
assert.equal(resumed.data.participantId,id);
const emoji="\u{1F363}";
assert.equal((await post({action:"emote",roomCode,participantId:id,operationId:crypto.randomUUID(),emoji},player.cookie)).status,200);
const reactions=await fetch(`${origin}/api/scoreboard?room=${roomCode}`).then(r=>r.json());
assert.ok(reactions.emotes.some(event=>event.participant_id===id&&event.emoji===emoji));
const other=await post({action:"createRoom",name:"QA isolation host"});assert.equal(other.status,201);
assert.equal((await post({...adjust,roomCode:other.data.room.code,operationId:crypto.randomUUID()},other.cookie)).status,404);
const restored=await fetch(`${origin}/api/scoreboard?room=${roomCode}`,{headers:{cookie:player.cookie}}).then(r=>r.json());
assert.equal(restored.role,"participant");assert.equal(restored.participantId,id);assert.equal(restored.participants.find(p=>p.id===id).count,2);
console.log(JSON.stringify({passed:true,publicLanding:true,rooms:[{code:roomCode,participantIds:[host.data.participantId,id]},{code:other.data.room.code,participantIds:[other.data.participantId]}],checks:["create/join","secure room cookies","own-only controls","host controls","retry safety","cross-client persistence","private links","shared reactions","room isolation","session restoration"]}));
