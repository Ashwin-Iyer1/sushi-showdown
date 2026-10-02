import test from "node:test";
import assert from "node:assert/strict";
import {handleScoreboard} from "../api/scoreboard.ts";

test("API fails closed until the independent Neon database is configured and initialized",async()=>{
  const previous={DATABASE_URL:process.env.DATABASE_URL,NEON_SCHEMA_READY:process.env.NEON_SCHEMA_READY};
  try{
    delete process.env.DATABASE_URL;delete process.env.NEON_SCHEMA_READY;
    assert.equal((await handleScoreboard(new Request("https://new.example/api/scoreboard?room=ABC234"))).status,503);
    process.env.DATABASE_URL="postgresql://not-a-real-credential@not-a-real-host.example/test";
    assert.equal((await handleScoreboard(new Request("https://new.example/api/scoreboard?room=ABC234"))).status,503);
    assert.equal((await handleScoreboard(new Request("https://new.example/api/scoreboard",{method:"DELETE"}))).status,405);
  }finally{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
