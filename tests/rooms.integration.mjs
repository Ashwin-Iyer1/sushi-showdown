// Run with the local production Worker running: node tests/rooms.integration.mjs
// Never accepts a remote origin and never accesses the live game's data.
import assert from "node:assert/strict";
const origin="http://127.0.0.1:8788";
async function post(body,cookie){
  const response=await fetch(`${origin}/api/scoreboard`,{method:"POST",headers:{"content-type":"application/json",...(cookie?{cookie}:{})},body:JSON.stringify(body)});
  return {status:response.status,data:await response.json(),cookie:response.headers.get("set-cookie")?.split(";")[0]};
}
const host=await post({action:"createRoom",name:"Local host"});assert.equal(host.status,201);
const roomCode=host.data.room.code;
const player=await post({action:"join",roomCode,name:"Local player"});assert.equal(player.status,201);
const participantId=player.data.participantId;
const operationId=crypto.randomUUID();
const adjust={action:"adjust",roomCode,participantId,operationId,delta:1};
assert.equal((await post(adjust,player.cookie)).status,200);
const retry=await post(adjust,player.cookie);assert.equal(retry.data.participants.find(p=>p.id===participantId).count,1);
assert.equal((await post({...adjust,participantId:host.data.participantId,operationId:crypto.randomUUID()},player.cookie)).status,403);
assert.equal((await post({...adjust,operationId:crypto.randomUUID()},host.cookie)).status,200);
const link=await post({action:"participantLink",roomCode,participantId},host.cookie);assert.equal(link.status,200);
const resumed=await post({action:"enterParticipant",roomCode,participantId,token:link.data.participantToken});assert.equal(resumed.status,200);
assert.equal(resumed.data.participants.find(p=>p.id===participantId).count,2);
const hostLink=await post({action:"hostLink",roomCode},host.cookie);
assert.equal((await post({action:"enterHost",roomCode,token:hostLink.data.hostToken})).data.role,"host");
const snapshot=await fetch(`${origin}/api/scoreboard?room=${roomCode}`,{headers:{cookie:player.cookie}}).then(r=>r.json());
assert.equal(snapshot.role,"participant");assert.equal(snapshot.participantId,participantId);
const other=await post({action:"createRoom",name:"Other table"});
assert.equal((await post({...adjust,roomCode:other.data.room.code,operationId:crypto.randomUUID()},host.cookie)).status,403);
const homepage=await fetch(origin).then(r=>r.text());assert.match(homepage,/Host a competition/);assert.match(homepage,/Open the room/);
console.log("PASS: production lobby, create/join, own-score permissions, host controls, retry safety, private links, session restoration and room isolation (local data only)");
