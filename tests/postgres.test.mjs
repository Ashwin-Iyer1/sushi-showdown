import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {createPostgresDatabase,postgresSql} from "../db/postgres.ts";
import {createScoreboardHandlers} from "../lib/scoreboard-api.ts";
import {EMOJIS} from "../lib/scoreboard.ts";

test("PostgreSQL enforces room cookies, private links, counters and retry history",async()=>{
  const pg=new PGlite();
  try{
    await pg.exec(await readFile(new URL("../db/postgres-schema.sql",import.meta.url),"utf8"));
    const db=createPostgresDatabase(queries=>pg.transaction(async tx=>{
      const results=[];
      for(const query of queries){const result=await tx.query(query.sql,query.params);results.push({rows:result.rows,rowCount:result.affectedRows??result.rows.length});}
      return results;
    }));
    const api=createScoreboardHandlers({getDb:()=>db,getVerifiedOrganizer:async()=>null});
    const hash=async value=>Buffer.from(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))).toString("hex");
    const hostToken="a".repeat(64),playerToken="b".repeat(64),privateToken="c".repeat(64);
    const hostId=crypto.randomUUID(),playerId=crypto.randomUUID(),availableId=crypto.randomUUID(),oldOperation=crypto.randomUUID();
    await pg.query("INSERT INTO rooms VALUES ($1,$2,$3,$4,$5,$6)",["test-competition","ABC234",await hash(hostToken),hostId,"existing-owner",1234567890123]);
    for(const [id,name,count,token] of [[hostId,"Original host",17,null],[playerId,"Original player",29,await hash(playerToken)],[availableId,"Unclaimed profile",8,null]]){
      await pg.query("INSERT INTO participants (id,name,name_key,room_id,participant_token_hash,count,version,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",[id,name,name.toLowerCase(),"test-competition",token,count,5,1234567890123]);
    }
    await pg.query("INSERT INTO participant_access VALUES ($1,$2,$3)",[await hash(privateToken),playerId,1234567890123]);
    await pg.query("INSERT INTO score_operations VALUES ($1,$2,1,1)",[oldOperation,playerId]);
    async function post(body,cookie){
      const response=await api.POST(new Request("https://new.example/api/scoreboard",{method:"POST",headers:{"content-type":"application/json",...(cookie?{cookie}:{})},body:JSON.stringify(body)}));
      return {status:response.status,data:await response.json(),cookie:response.headers.get("set-cookie")?.split(";")[0]};
    }
    const hostCookie=`sushi_room_ABC234=${hostToken}`,playerCookie=`sushi_room_ABC234=${playerToken}`;
    const snapshot=await api.GET(new Request("https://old.example/api/scoreboard?room=ABC234",{headers:{cookie:playerCookie}})).then(r=>r.json());
    assert.equal(snapshot.role,"participant");assert.equal(snapshot.participantId,playerId);assert.equal(snapshot.participants.find(p=>p.id===playerId).count,29);

    assert.equal((await post({action:"enterHost",roomCode:"ABC234",token:hostToken})).data.role,"host");
    assert.equal((await post({action:"enterParticipant",roomCode:"ABC234",participantId:playerId,token:privateToken})).data.participantId,playerId);
    const adjust={action:"adjust",roomCode:"ABC234",participantId:playerId,delta:1,operationId:oldOperation};
    const retry=await post(adjust,playerCookie);assert.equal(retry.status,200);assert.equal(retry.data.participants.find(p=>p.id===playerId).count,29);
    assert.equal((await post({...adjust,participantId:hostId,operationId:crypto.randomUUID()},playerCookie)).status,403);
    const hostAdjust=await post({...adjust,operationId:crypto.randomUUID()},hostCookie);assert.equal(hostAdjust.status,200);assert.equal(hostAdjust.data.participants.find(p=>p.id===playerId).count,30);
    const newId=crypto.randomUUID();
    const simultaneous=await Promise.all(Array.from({length:12},()=>post({...adjust,operationId:newId},playerCookie)));
    for(const result of simultaneous){assert.equal(result.status,200);}
    assert.equal((await db.prepare("SELECT count FROM participants WHERE id = ?").bind(playerId).first()).count,31);
    const claims=await Promise.all(Array.from({length:12},()=>post({action:"claimProfile",roomCode:"ABC234",participantId:availableId})));
    assert.equal(claims.filter(result=>result.status===200).length,1);assert.equal(claims.filter(result=>result.status===409).length,11);
    assert.equal((await post({action:"emote",roomCode:"ABC234",participantId:hostId,operationId:crypto.randomUUID(),emoji:EMOJIS[0]},playerCookie)).status,403);
    assert.equal((await post({action:"emote",roomCode:"ABC234",participantId:playerId,operationId:crypto.randomUUID(),emoji:EMOJIS[0]},playerCookie)).status,200);
    const other=await post({action:"createRoom",name:"Other host"});assert.equal(other.status,201);
    assert.equal((await post({...adjust,roomCode:other.data.room.code,operationId:crypto.randomUUID()},other.cookie)).status,404);
    const joined=await post({action:"join",roomCode:other.data.room.code,name:"New player"});assert.equal(joined.status,201);
    assert.equal((await post({action:"join",roomCode:other.data.room.code,name:"New player"})).status,409);
    for(let index=0;index<35;index++)assert.equal((await post({...adjust,delta:-1,operationId:crypto.randomUUID()},playerCookie)).status,200);
    assert.equal((await db.prepare("SELECT count FROM participants WHERE id = ?").bind(playerId).first()).count,0);
    assert.equal((await post({action:"claimOriginal"})).status,400);
  }finally{await pg.close();}
});
test("Postgres adapter retries serialization failures without replaying completed work",async()=>{
  let attempts=0;
  const db=createPostgresDatabase(async queries=>{
    attempts++;if(attempts<3)throw Object.assign(new Error("serialization"),{code:"40001"});
    assert.equal(queries[0].sql,"SELECT count FROM participants WHERE id = $1");
    assert.deepEqual(queries[0].params,["existing-id"]);
    return [{rows:[{count:"29",version:"5",created_at:"1234567890123"}],rowCount:1}];
  });
  const result=await db.prepare("SELECT count FROM participants WHERE id = ?").bind("existing-id").first();
  assert.equal(attempts,3);assert.equal(result.count,29);assert.equal(result.created_at,1234567890123);
  assert.equal(postgresSql("UPDATE participants SET count = MAX(0, count + ?) WHERE id = ?"),"UPDATE participants SET count = GREATEST(0, count + $1) WHERE id = $2");
});

