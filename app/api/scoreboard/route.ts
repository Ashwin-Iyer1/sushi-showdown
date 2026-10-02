import { getDb } from "@/db";
import { env } from "cloudflare:workers";
import { getVerifiedOrganizer } from "@/lib/organizer-identity";
import { EMOJIS, type Participant, type Emote } from "@/lib/scoreboard";

export const dynamic = "force-dynamic";
const columns = "id, name, count, version, created_at";
const baseHeaders = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const respond = (body: unknown, status = 200, cookie?: string) => Response.json(body, { status, headers: { ...baseHeaders, ...(cookie ? { "Set-Cookie": cookie } : {}) } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validCode = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
type Room = { id: string; code: string; host_token_hash: string; host_participant_id: string; owner_user_id?: string | null };
type Identity = { role: "host" | "participant" | "spectator"; participantId: string | null; token?: string };
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2,"0")).join("");
const hash = async (token: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map(byte => byte.toString(16).padStart(2,"0")).join("");
const sessionCookie = (code: string, token: string) => `sushi_room_${code}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
function normalizeName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return name && [...name].length <= 32 && !/[\p{Cc}\p{Cf}]/u.test(name) ? name : null;
}
async function getIdentity(db: D1Database, request: Request, room: Room): Promise<Identity> {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`sushi_room_${room.code}=`))?.split("=")[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { role: "spectator", participantId: null };
  const tokenHash = await hash(token);
  if (tokenHash === room.host_token_hash) return { role: "host", participantId: room.host_participant_id || null, token };
  const person = await db.prepare("SELECT id FROM participants WHERE room_id = ? AND participant_token_hash = ?").bind(room.id, tokenHash).first<{id:string}>();
  if (person) return {role:"participant",participantId:person.id};
  const linked=await db.prepare("SELECT p.id FROM participant_access a JOIN participants p ON p.id = a.participant_id WHERE a.token_hash = ? AND p.room_id = ?").bind(tokenHash,room.id).first<{id:string}>();
  return linked ? {role:"participant",participantId:linked.id} : {role:"spectator",participantId:null};
}
async function snapshot(db: D1Database, room: Room | null, identity?: Identity) {
  const { results } = room
    ? await db.prepare(`SELECT ${columns}, CASE WHEN participant_token_hash IS NULL AND id != ? AND NOT EXISTS (SELECT 1 FROM participant_access a WHERE a.participant_id = participants.id) THEN 1 ELSE 0 END AS claimable FROM participants WHERE room_id = ? ORDER BY count DESC, created_at ASC, id ASC`).bind(room.host_participant_id,room.id).all<Participant>()
    : await db.prepare(`SELECT ${columns} FROM participants WHERE room_id IS NULL ORDER BY count DESC, created_at ASC, id ASC`).all<Participant>();
  const serverTime = Date.now();
  const emotes = room ? (await db.prepare("SELECT e.id, e.participant_id, e.emoji, e.created_at FROM emote_events e JOIN participants p ON p.id = e.participant_id WHERE p.room_id = ? AND e.created_at > ? ORDER BY e.created_at ASC LIMIT 250").bind(room.id, serverTime - 8000).all<Emote>()).results : [];
  return { participants: results.map(p=>({...p,claimable:Boolean(p.claimable)})), emotes, serverTime, room: room ? {code:room.code} : null, role: room ? identity?.role ?? "spectator" : "legacy", participantId: identity?.participantId ?? null, isOriginalGame: room?.id === "original-competition" };
}
async function findRoom(db: D1Database, code: unknown) {
  return typeof code === "string" && validCode.test(code) ? db.prepare("SELECT id, code, host_token_hash, host_participant_id, owner_user_id FROM rooms WHERE code = ?").bind(code).first<Room>() : null;
}
async function originalRoom(db: D1Database): Promise<Room | null> {
  const existing=await db.prepare("SELECT id, code, host_token_hash, host_participant_id, owner_user_id FROM rooms WHERE id = ?").bind("original-competition").first<Room>();
  const unassigned=await db.prepare("SELECT id FROM participants WHERE room_id IS NULL LIMIT 1").first();
  if(!existing&&!unassigned)return null;
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code=existing?.code??[...crypto.getRandomValues(new Uint8Array(6))].map(v=>alphabet[v%alphabet.length]).join("");
  // A bounded transactional data migration. Participant IDs, counts and operation history stay intact.
  await db.batch([
    db.prepare("INSERT INTO rooms (id, code, host_token_hash, host_participant_id, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind("original-competition",code,"awaiting-verified-owner","",Date.now()),
    db.prepare("UPDATE participants SET room_id = ? WHERE room_id IS NULL").bind("original-competition"),
  ]);
  return db.prepare("SELECT id, code, host_token_hash, host_participant_id, owner_user_id FROM rooms WHERE id = ?").bind("original-competition").first<Room>();
}
export async function GET(request: Request) {
  try {
    const db = getDb(); const code = new URL(request.url).searchParams.get("room");
    if (!code) {
      const original=await originalRoom(db);
      return respond(await snapshot(db,original,original?await getIdentity(db,request,original):undefined));
    }
    const room = await findRoom(db, code);
    if (!room) return respond({ error: "That room wasn't found. Check the six-character code." }, 404);
    return respond(await snapshot(db, room, await getIdentity(db, request, room)));
  } catch (error) { console.error("Scoreboard read failed", error); return respond({ error: "The scoreboard couldn't connect. Please try again." }, 503); }
}
export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) return respond({ error: "Please send JSON." }, 415);
    if (request.headers.get("sec-fetch-site") === "cross-site") return respond({ error: "Please use this scoreboard to make changes." }, 403);
    const raw = await request.text();
    if (raw.length > 1024) return respond({ error: "That request is too long." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return respond({ error: "That request couldn't be read." }, 400); }
    if (!body || typeof body !== "object") return respond({ error: "Invalid request." }, 400);
    const db = getDb();
    if(body.action === "claimOriginal") {
      const user=await getVerifiedOrganizer();
      if(!user)return respond({error:"Sign in with ChatGPT to verify the original organizer."},401);
      const original=await originalRoom(db);
      if(!original)return respond({error:"No existing game was found to recover."},404);
      const allowed=original.owner_user_id?user.userId===original.owner_user_id:Boolean(env.LEGACY_OWNER_EMAIL)&&user.email.trim().toLowerCase()===env.LEGACY_OWNER_EMAIL!.trim().toLowerCase();
      if(!allowed)return respond({error:"Only the original organizer can recover this game's host controls."},403);
      let hostId=original.host_participant_id;
      if(typeof body.participantId === "string"&&body.participantId) {
        const person=await db.prepare("SELECT id, participant_token_hash FROM participants WHERE id = ? AND room_id = ?").bind(body.participantId,original.id).first<{id:string;participant_token_hash:string|null}>();
        if(!person|| (hostId&&hostId!==person.id) || (!hostId&&person.participant_token_hash))return respond({error:"Choose your unclaimed profile, or continue with host controls only."},409);
        hostId=person.id;
      }
      const token=randomToken();const tokenHash=await hash(token);
      const result=await db.prepare("UPDATE rooms SET host_token_hash = ?, owner_user_id = ?, host_participant_id = ? WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)").bind(tokenHash,user.userId,hostId,original.id,user.userId).run();
      if(!result.meta.changes)return respond({error:"This game already has a different verified organizer."},403);
      return respond(await snapshot(db,{...original,host_participant_id:hostId},{role:"host",participantId:hostId||null}),200,sessionCookie(original.code,token));
    }
    if (body.action === "createRoom") {
      const name=normalizeName(body.name);
      if (!name) return respond({error:"Use a name between 1 and 32 characters."},400);
      const token=randomToken(); const tokenHash=await hash(token); const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let room: Room | null=null;
      for (let attempt=0;attempt<5;attempt++) {
        const code=[...crypto.getRandomValues(new Uint8Array(6))].map(v=>alphabet[v%alphabet.length]).join("");
        if (await findRoom(db,code)) continue;
        room={id:crypto.randomUUID(),code,host_token_hash:tokenHash,host_participant_id:crypto.randomUUID()};
        await db.batch([
          db.prepare("INSERT INTO rooms (id, code, host_token_hash, host_participant_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(room.id,room.code,tokenHash,room.host_participant_id,Date.now()),
          db.prepare("INSERT INTO participants (id, name, name_key, room_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(room.host_participant_id,name,name.toLocaleLowerCase("en-US"),room.id,Date.now()),
        ]);
        break;
      }
      if (!room) return respond({error:"Couldn't create a room. Try again."},503);
      return respond({...await snapshot(db,room,{role:"host",participantId:room.host_participant_id}),hostToken:token},201,sessionCookie(room.code,token));
    }
    const room=await findRoom(db,body.roomCode);
    if (!room) return respond({error:"Choose a valid room. The earlier scoreboard is read-only."},400);
    if (body.action === "enterHost") {
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token) || await hash(body.token) !== room.host_token_hash) return respond({error:"This host link isn't valid for this room."},403);
      return respond(await snapshot(db,room,{role:"host",participantId:room.host_participant_id}),200,sessionCookie(room.code,body.token));
    }
    if(body.action === "enterParticipant") {
      const current=await getIdentity(db,request,room);
      if(current.role!=="spectator"&&current.participantId!==body.participantId)return respond({error:"This browser is already joined as a different profile. You can control only that profile."},409);
      if(typeof body.token!=="string"||!/^[a-f0-9]{64}$/.test(body.token)||typeof body.participantId!=="string"||!uuid.test(body.participantId))return respond({error:"This player link isn't valid."},403);
      const tokenHash=await hash(body.token);
      const linked=await db.prepare("SELECT p.id FROM participant_access a JOIN participants p ON p.id = a.participant_id WHERE a.token_hash = ? AND p.id = ? AND p.room_id = ?").bind(tokenHash,body.participantId,room.id).first<{id:string}>();
      if(!linked)return respond({error:"This player link isn't valid for this room."},403);
      return respond(await snapshot(db,room,{role:"participant",participantId:linked.id}),200,sessionCookie(room.code,body.token));
    }
    const identity=await getIdentity(db,request,room);
    if(body.action === "participantLink") {
      if(identity.role!=="host")return respond({error:"Only the host can issue private player links."},403);
      const person=await db.prepare("SELECT id FROM participants WHERE id = ? AND room_id = ?").bind(body.participantId??"",room.id).first<{id:string}>();
      if(!person||person.id===room.host_participant_id)return respond({error:"Choose another participant in this room."},400);
      const token=randomToken();
      await db.batch([
        db.prepare("INSERT INTO participant_access (token_hash, participant_id, created_at) VALUES (?, ?, ?)").bind(await hash(token),person.id,Date.now()),
        db.prepare("UPDATE participants SET version = version + 1 WHERE id = ?").bind(person.id),
      ]);
      return respond({participantToken:token,participantId:person.id});
    }
    if (body.action === "hostLink") {
      if (identity.role !== "host") return respond({error:"Only the host can access the host control link."},403);
      return respond({hostToken:identity.token});
    }
    if(body.action === "claimProfile") {
      if(identity.role!=="spectator")return respond({error:"You're already joined. You can control only your selected profile."},409);
      if(typeof body.participantId!=="string"||!uuid.test(body.participantId))return respond({error:"Choose an available profile."},400);
      const token=randomToken();
      const person=await db.prepare("UPDATE participants SET participant_token_hash = ?, version = version + 1 WHERE id = ? AND room_id = ? AND participant_token_hash IS NULL AND id != ? AND NOT EXISTS (SELECT 1 FROM participant_access a WHERE a.participant_id = participants.id) RETURNING id").bind(await hash(token),body.participantId,room.id,room.host_participant_id).first<{id:string}>();
      if(!person)return respond({error:"That profile is already joined or reserved. Choose another available profile."},409);
      return respond(await snapshot(db,room,{role:"participant",participantId:person.id}),200,sessionCookie(room.code,token));
    }
    if (body.action === "join") {
      if (identity.role !== "spectator") return respond({error:"You're already part of this room on this device."},409);
      const name=normalizeName(body.name);
      if (!name) return respond({error:"Use a name between 1 and 32 characters."},400);
      const key=name.toLocaleLowerCase("en-US");
      const id=crypto.randomUUID();const token=randomToken();const tokenHash=await hash(token);
      const inserted=await db.prepare("INSERT INTO participants (id, name, name_key, room_id, participant_token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(room_id, name_key) DO NOTHING").bind(id,name,key,room.id,tokenHash,Date.now()).run();
      if (!inserted.meta.changes) return respond({error:"That name is taken in this room. Add an initial, or use the device you joined on."},409);
      return respond(await snapshot(db,room,{role:"participant",participantId:id}),201,sessionCookie(room.code,token));
    }
    if (body.action === "emote") {
      if (identity.role === "spectator" || identity.participantId !== body.participantId) return respond({error:"You can only send reactions from your own participant profile."},403);
      if (typeof body.operationId !== "string" || !uuid.test(body.operationId) || !EMOJIS.includes(body.emoji)) return respond({error:"Choose one of the available emoji reactions."},400);
      const now=Date.now();
      const results=await db.batch([
        db.prepare("DELETE FROM emote_events WHERE created_at < ?").bind(now-60000),
        db.prepare("INSERT INTO emote_events (id, participant_id, emoji, created_at) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM emote_events WHERE participant_id = ? AND created_at > ?) ON CONFLICT(id) DO NOTHING").bind(body.operationId,identity.participantId,body.emoji,now,identity.participantId,now-2000),
        db.prepare("SELECT id FROM emote_events WHERE id = ? AND participant_id = ? AND emoji = ?").bind(body.operationId,identity.participantId,body.emoji),
      ]);
      if (!results[2].results.length) return respond({error:"Give that reaction a moment. Try again in 2 seconds."},429);
      return respond(await snapshot(db,room,identity));
    }
    if (body.action === "adjust") {
      if (identity.role === "spectator" || (identity.role === "participant" && identity.participantId !== body.participantId)) return respond({error:"You can change only your own count. The host can change everyone’s."},403);
      if (typeof body.participantId !== "string" || !uuid.test(body.participantId) || typeof body.operationId !== "string" || !uuid.test(body.operationId) || ![1,-1].includes(body.delta)) return respond({error:"Choose +1 or −1 for a participant."},400);
      const participant=await db.prepare("SELECT id FROM participants WHERE id = ? AND room_id = ?").bind(body.participantId,room.id).first();
      if (!participant) return respond({error:"That participant isn't in this room."},404);
      const {participantId,operationId,delta}=body;
      await db.batch([
        db.prepare("INSERT INTO score_operations (id, participant_id, delta) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING").bind(operationId,participantId,delta),
        db.prepare("UPDATE participants SET count = MAX(0, count + ?), version = version + 1 WHERE id = ? AND room_id = ? AND EXISTS (SELECT 1 FROM score_operations WHERE id = ? AND participant_id = ? AND delta = ? AND applied = 0)").bind(delta,participantId,room.id,operationId,participantId,delta),
        db.prepare("UPDATE score_operations SET applied = 1 WHERE id = ? AND participant_id = ? AND delta = ?").bind(operationId,participantId,delta),
      ]);
      return respond(await snapshot(db,room,identity));
    }
    return respond({error:"Choose an action."},400);
  } catch (error) { console.error("Scoreboard save failed",error);return respond({error:"Couldn't confirm the save. Please try again."},503); }
}
