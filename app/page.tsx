"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Minus, Trophy, RefreshCw, Users, WifiOff, Check, Copy, Crown, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { EMOJIS, mergeParticipants, type Emote, type Participant, type Snapshot } from "@/lib/scoreboard";

type Action = { action:string; [key:string]: unknown };
type Tool = { name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:any)=>unknown };
export default function Home() {
  const [view,setView]=useState<"landing"|"room"|"legacy">("landing");
  const [roomCode,setRoomCode]=useState("");
  const [joinCode,setJoinCode]=useState("");
  const [name,setName]=useState("");
  const [hostName,setHostName]=useState("");
  const [participants,setParticipants]=useState<Participant[]>([]);
  const [role,setRole]=useState<Snapshot["role"]>("spectator");
  const [myId,setMyId]=useState<string|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [isOriginalGame,setIsOriginalGame]=useState(false);
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [retryAction,setRetryAction]=useState<Action|null>(null);
  const [activeEmotes,setActiveEmotes]=useState<(Emote&{shownAt:number})[]>([]);
  const [emoteCooldown,setEmoteCooldown]=useState(false);
  const eventBaseline=useRef<number|null>(null);
  const seenEvents=useRef(new Map<string,number>());
  const saving=useRef(false);
  const activeRoom=useRef("");
  const readEpoch=useRef(0);
  const initialized=useRef(false);
  const myIdRef=useRef<string|null>(null);
  const apply=useCallback((data:Snapshot)=>{
    setParticipants(current=>mergeParticipants(current,data.participants));
    setRole(data.role);setIsOriginalGame(Boolean(data.isOriginalGame));setMyId(data.participantId);myIdRef.current=data.participantId;
    if(eventBaseline.current===null)eventBaseline.current=data.serverTime;
    else{
      const fresh=data.emotes.filter(event=>event.created_at>eventBaseline.current!&&!seenEvents.current.has(event.id));
      if(fresh.length)setActiveEmotes(current=>[...current,...fresh.map(event=>({...event,shownAt:Date.now()}))]);
    }
    for(const event of data.emotes)seenEvents.current.set(event.id,event.created_at);
    for(const[id,time]of seenEvents.current)if(time<data.serverTime-15000)seenEvents.current.delete(id);
    setLoaded(true);setConnected(true);
  },[]);
  const resetRoom=useCallback((code:string)=>{
    activeRoom.current=code;readEpoch.current++;setParticipants([]);setActiveEmotes([]);setLoaded(false);setMyId(null);myIdRef.current=null;setRole("spectator");eventBaseline.current=null;seenEvents.current.clear();setRoomCode(code);setView(code?"room":"legacy");setError("");setRetryAction(null);
  },[]);
  const refresh=useCallback(async(code=activeRoom.current)=>{
    const epoch=readEpoch.current;
    try{
      const res=await fetch(`/api/scoreboard${code?`?room=${encodeURIComponent(code)}`:""}`,{cache:"no-store",signal:AbortSignal.timeout(10000)});
      const data=await res.json() as Snapshot&{error?:string};
      if(!res.ok)throw new Error(data.error||"Couldn't load this room.");
      if(epoch===readEpoch.current&&code===activeRoom.current)apply(data);
      return data;
    }catch(err){if(epoch===readEpoch.current){setConnected(false);if(!initialized.current)setError(err instanceof Error?err.message:"Couldn't connect.");}throw err;}
  },[apply]);
  const request=useCallback(async(action:Action)=>{
    const res=await fetch("/api/scoreboard",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action),signal:AbortSignal.timeout(12000)});
    const data=await res.json() as Snapshot&{error?:string;hostToken?:string;participantToken?:string};
    if(!res.ok)throw Object.assign(new Error(data.error||"Couldn't confirm the save."),{retryable:res.status>=500});
    return data;
  },[]);
  useEffect(()=>{
    const url=new URL(window.location.href);const code=(url.searchParams.get("room")||"").toUpperCase();
    if(code){
      resetRoom(code);const token=new URLSearchParams(url.hash.slice(1)).get("host");
      const playerToken=new URLSearchParams(url.hash.slice(1)).get("player");
      const playerId=new URLSearchParams(url.hash.slice(1)).get("participant");
      if(token||playerToken){
        window.history.replaceState({},"",`${url.pathname}?room=${encodeURIComponent(code)}`);
        void request(token?{action:"enterHost",roomCode:code,token}:{action:"enterParticipant",roomCode:code,token:playerToken,participantId:playerId}).then(data=>apply(data)).catch(err=>setError(err.message));
      }else void refresh(code).catch(err=>setError(err.message));
    }else if(url.searchParams.get("new")!=="1"){
      void refresh("").then(data=>{if(data.room&&data.isOriginalGame){resetRoom(data.room.code);window.history.replaceState({},"",`?room=${data.room.code}`);apply(data);}}).catch(err=>setError(err.message));
    }
    initialized.current=true;
  },[apply,refresh,request,resetRoom]);
  useEffect(()=>{
    if(view==="landing")return;
    const poll=setInterval(()=>{if(document.visibilityState==="visible")void refresh().catch(()=>{});},2000);
    const expire=setInterval(()=>setActiveEmotes(current=>current.filter(event=>Date.now()-event.shownAt<3600)),500);
    const resume=()=>{if(document.visibilityState==="visible")void refresh().catch(()=>{});};
    document.addEventListener("visibilitychange",resume);window.addEventListener("online",resume);window.addEventListener("focus",resume);
    return()=>{clearInterval(poll);clearInterval(expire);document.removeEventListener("visibilitychange",resume);window.removeEventListener("online",resume);window.removeEventListener("focus",resume);};
  },[view,refresh]);
  const save=useCallback(async(action:Action)=>{
    if(saving.current)throw new Error("Wait for the current save to finish.");
    saving.current=true;setBusy(true);setError("");setNotice("");readEpoch.current++;
    try{
      const data=await request(action);
      if(action.action==="createRoom"||action.action==="join"){
        const code=data.room!.code;
        if(activeRoom.current!==code||action.action==="createRoom")resetRoom(code);
        window.history.replaceState({},"",`?room=${encodeURIComponent(code)}`);setRoomCode(code);setView("room");setName("");
      }
      apply(data);setRetryAction(null);
      if(action.action==="createRoom")setNotice("Room created. Share the player link, and save your private host link.");
      else if(action.action==="join"||action.action==="claimProfile")setNotice("You're in! You can update your own count and send reactions.");
      else if(action.action==="emote"){setNotice(`${action.emoji} sent`);setEmoteCooldown(true);setTimeout(()=>setEmoteCooldown(false),2000);}
      else setNotice("Count saved.");
      return{room:data.room,role:data.role,participantId:data.participantId,participants:data.participants};
    }catch(err){
      const canRetry=["adjust","emote"].includes(action.action)&&(err as {retryable?:boolean}).retryable!==false;
      setRetryAction(canRetry?action:null);setError(err instanceof Error?err.message:"Couldn't connect. Please try again.");throw err;
    }finally{saving.current=false;setBusy(false);}
  },[apply,request,resetRoom]);
  const copy=async(host=false,participantId?:string)=>{
    try{
      let link=`${window.location.origin}/?room=${roomCode}`;
      if(host){const result=await request({action:"hostLink",roomCode});link+=`#host=${result.hostToken}`;}
      if(participantId){const result=await request({action:"participantLink",roomCode,participantId});link+=`#player=${result.participantToken}&participant=${participantId}`;}
      await navigator.clipboard.writeText(link);setNotice(participantId?"Private player link copied. Share it only with that participant; it controls their existing profile.":host?"Private host link copied. Keep it to yourself; it grants control of this room.":"Player link copied. Send it to your table.");
    }catch{setError("Couldn't copy the link. Use the room code to invite players.");}
  };
  useEffect(()=>{
    const context=(document as Document&{modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>unknown}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const toolList:Tool[]=[
      {name:"read_sushi_scoreboard",title:"Read this room",description:"Read the current room's scoreboard and this browser's role. Does not reveal credentials.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async()=>{const data=await refresh();return{room:data.room,role:data.role,participants:data.participants};}},
      {name:"claim_sushi_profile",title:"Join an available profile",description:"Join this room as an available existing participant. First chooser claims the profile; this browser then controls only that profile.",inputSchema:{type:"object",properties:{participantId:{type:"string"}},required:["participantId"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input)=>{if(!input||typeof input.participantId!=="string")throw new Error("A participant ID is required.");return save({action:"claimProfile",roomCode:activeRoom.current,participantId:input.participantId});}},
      {name:"adjust_sushi_count",title:"Adjust a sushi count",description:"Change your own count by one, or any participant's count if this browser is the room host. Server authorization is enforced.",inputSchema:{type:"object",properties:{participantId:{type:"string"},delta:{type:"integer",enum:[-1,1]}},required:["participantId","delta"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input)=>{if(!input||typeof input.participantId!=="string"||![-1,1].includes(input.delta))throw new Error("A participant ID and delta of -1 or 1 are required.");return save({action:"adjust",roomCode:activeRoom.current,...input,operationId:crypto.randomUUID()});}},
      {name:"send_sushi_emote",title:"Send your reaction",description:"Send a short-lived reaction above your own avatar in this room.",inputSchema:{type:"object",properties:{emoji:{type:"string",enum:[...EMOJIS]}},required:["emoji"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input)=>{if(!input||!EMOJIS.includes(input.emoji)||!myIdRef.current)throw new Error("Join a room and choose a supported emoji.");return save({action:"emote",roomCode:activeRoom.current,participantId:myIdRef.current,emoji:input.emoji,operationId:crypto.randomUUID()});}},
    ];
    for(const tool of toolList){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(console.error);}catch(err){console.error(err);}}
    return()=>lifecycle.abort();
  },[refresh,save]);
  const me=participants.find(p=>p.id===myId);
  const total=participants.reduce((sum,p)=>sum+p.count,0);
  const leaders=participants.length&&participants[0].count>0?participants.filter(p=>p.count===participants[0].count).map(p=>p.id):[];
  const disabled=busy||retryAction!==null;
  const errorBox=error&&<div className="error-box" role="alert"><span>{error}</span>{retryAction&&<Button variant="outline" disabled={busy} onClick={()=>void save(retryAction).catch(()=>{})}>Retry save</Button>}</div>;
  return <main className="scoreboard-shell">
    <header className="masthead"><a className="wordmark" href="/?new=1" aria-label="Create or join another Sushi Showdown room"><span className="wordmark-icon" aria-hidden="true">S.</span><span>SUSHI<br/>SHOWDOWN</span></a>{view!=="landing"&&<div className="sync-badge" role="status">{connected?<><span className="live-dot"/>Live & synced</>:<><WifiOff size={15}/>Connecting</>}</div>}</header>
    <div className="title-row"><div><p className="eyebrow">THE SUSHI EATING COMPETITION</p><h1>{view==="room"?`Table ${roomCode}`:view==="legacy"?"The earlier scoreboard.":"Every piece counts."}</h1></div><p className="small-note">One table.<br/>One shared scoreboard.</p></div>
    {view==="landing"?<>
      <div className="landing-panels"><section className="join-panel"><span className="section-marker">01 / START A TABLE</span><h2>Host a competition</h2><p>Create a room and invite your table. You can adjust everyone's counts.</p><form onSubmit={e=>{e.preventDefault();void save({action:"createRoom",name:hostName}).catch(()=>{});}}><label htmlFor="host-name">Your name</label><Input id="host-name" className="name-input" value={hostName} onChange={e=>setHostName(e.target.value)} placeholder="Your name or nickname" maxLength={32} autoComplete="given-name" required/><Button type="submit" className="join-button" disabled={busy||!hostName.trim()}><Crown size={19}/>Create a room</Button></form><p className="helper">You'll get a player link and a private host control link.</p></section>
      <section className="join-panel"><span className="section-marker">02 / PULL UP A SEAT</span><h2>Join your table</h2><p>Enter the room code from your host. Each player controls their own count.</p><form onSubmit={e=>{e.preventDefault();void save({action:"join",roomCode:joinCode.toUpperCase(),name}).catch(()=>{});}}><label htmlFor="room-code">Room code</label><Input id="room-code" className="name-input code-input" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,6))} placeholder="ABC234" maxLength={6} autoComplete="off" required/><label htmlFor="join-name" className="room-name-label">Your name</label><Input id="join-name" className="name-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name or nickname" maxLength={32} autoComplete="given-name" required/><Button type="submit" className="join-button" disabled={busy||joinCode.length!==6||!name.trim()}><Plus size={19}/>Join the room</Button></form></section></div>
      {errorBox}<p className="landing-note">No accounts or sign-in. Your browser remembers your place at the table.</p><a className="legacy-link" href="/">Return to the current game</a>
    </>:<>
      {isOriginalGame&&<div className="legacy-notice"><LockKeyhole size={19}/><span>Your current game's names and counts are preserved. {role==="host"?"Share the player link so people can choose an available profile. Private links also work for existing players.":<>Existing players: choose an available profile below. <a href="/recover">Organizer: recover host controls</a></>}</span></div>}
      <section className="stats" aria-label="Competition totals"><div className="total-card"><div><p className="stat-label">SUSHI EATEN</p><p className="total-number">{loaded?total.toLocaleString():"—"}<span>pieces</span></p></div><img className="sushi-photo" src="/sushi.jpg" alt="Two salmon nigiri on a black plate" width="160" height="160"/></div><div className="people-card"><Users size={24} strokeWidth={1.6}/><span className="people-number">{loaded?participants.length:"—"}</span><span className="people-label">{participants.length===1?"participant":"participants"}</span></div></section>
      <div className={`workspace ${view==="legacy"?"legacy-workspace":""}`}>
        {view==="room"&&<aside className="join-panel"><span className="section-marker">YOUR TABLE</span>{role==="spectator"?<><h2>Pick your profile</h2><p>Choose an available name. Once joined, you can control only that profile.</p>{loaded&&participants.length>0&&<div className="profile-picker" aria-label="Choose an available participant profile">{participants.map(p=><Button key={p.id} variant="outline" className="profile-option" disabled={disabled||!p.claimable} onClick={()=>void save({action:"claimProfile",roomCode,participantId:p.id}).catch(()=>{})}><span className="profile-option-name">{p.name}</span><span>{p.claimable?`${p.count} sushi · Join`:"Already joined"}</span></Button>)}</div>}<p className="new-profile-label">Not on the board? Add yourself.</p><form onSubmit={e=>{e.preventDefault();void save({action:"join",roomCode,name}).catch(()=>{});}}><label htmlFor="participant-name">Your name</label><Input id="participant-name" className="name-input" placeholder="e.g. Alex" maxLength={32} autoComplete="given-name" value={name} onChange={e=>setName(e.target.value)} required/><Button className="join-button" disabled={disabled||!name.trim()} type="submit"><Plus size={19}/>Join this room</Button></form><p className="helper">Already joined profiles stay protected. Use your original browser, or ask the host for your private player link.</p></>:<><div className="identity-card"><span className="participant-avatar identity-avatar">{me?.name.split(/\s+/).map(word=>[...word][0]).slice(0,2).join("").toUpperCase()}</span><div><h2>{me?.name||(role==="host"?"Host controls":"You're at the table")}</h2><p>{role==="host"?<><Crown size={14}/>Room host</>:"Participant"}</p></div></div><p>{role==="host"?"You can update everyone's count. Players can only update their own.":"Use +1 to count each piece. Only you and the host can update your score."}</p><div className="reaction-picker"><span className="reaction-label">Send a reaction</span><div className="reaction-options" role="group" aria-label="Your emoji reactions">{EMOJIS.map(emoji=><Button key={emoji} variant="outline" className="emoji-button" aria-label={`Send ${emoji} reaction`} disabled={disabled||emoteCooldown||!myId} onClick={()=>void save({action:"emote",roomCode,participantId:myId,emoji,operationId:crypto.randomUUID()}).catch(()=>{})}>{emoji}</Button>)}</div><p>It floats above your avatar for everyone.</p></div></>}
        <div className="invite-panel"><span className="public-label">ROOM CODE</span><strong className="room-code">{roomCode}</strong><Button variant="outline" className="copy-link" onClick={()=>void copy()}><Copy size={16}/>Copy player link</Button>{role==="host"&&<><Button variant="ghost" className="host-link" onClick={()=>void copy(true)}><LockKeyhole size={15}/>Copy private host link</Button><p className="host-warning">Save your host link somewhere safe. Anyone who has it can control this room.</p></>}</div><div className="public-note"><span className="public-label">SHARED WITH YOUR TABLE</span><p>Anyone with the room code can view names and counts. Use a nickname if you prefer. Each browser keeps its own room identity.</p></div></aside>}
        <section className="board-panel" aria-labelledby="board-title"><div className="board-heading"><div><span className="section-marker">THE STANDINGS</span><h2 id="board-title">Leaderboard</h2></div><Trophy className="trophy" size={27} strokeWidth={1.5}/></div>{!connected&&<div className="connection-note">{loaded?"Showing the last saved counts. Reconnecting…":"Connecting to the scoreboard…"}<Button variant="ghost" className="retry-button" aria-label="Refresh scoreboard" onClick={()=>void refresh().catch(err=>setError(err.message))}><RefreshCw size={16}/></Button></div>}{errorBox}
        {loaded&&participants.length===0?<Empty className="empty-board"><EmptyHeader><span className="empty-number" aria-hidden="true">0</span><EmptyTitle>The table is yours.</EmptyTitle><EmptyDescription>{view==="legacy"?"No earlier participants to show.":"Share the room code to fill the table."}</EmptyDescription></EmptyHeader></Empty>:!loaded?<div className="loading-board" aria-label="Loading scoreboard"><Skeleton className="loading-row"/><Skeleton className="loading-row"/></div>:<ol className="participants">{participants.map(p=>{const rank=participants.findIndex(x=>x.count===p.count)+1;const canAdjust=role==="host"||(role==="participant"&&p.id===myId);return <li key={p.id} className={`participant ${myId===p.id?"selected":""} ${leaders.includes(p.id)?"leader":""}`}><span className="rank" aria-label={`Rank ${rank}`}>{String(rank).padStart(2,"0")}</span><div className="participant-identity"><div className="avatar-wrap"><span className={`participant-avatar static-avatar ${myId===p.id?"my-avatar":""}`}>{p.name.split(/\s+/).map(word=>[...word][0]).slice(0,2).join("").toUpperCase()}</span>{activeEmotes.filter(event=>event.participant_id===p.id).map(event=><span key={event.id} className="floating-emote" role="img" aria-label={`${p.name} reacts ${event.emoji}`}>{event.emoji}</span>)}</div><div className="participant-name"><span>{p.name}</span>{leaders.includes(p.id)?<small>LEADING{myId===p.id?" · YOU":""}</small>:myId===p.id?<small>YOU</small>:null}{role==="host"&&p.id!==myId&&<button className="player-link-button" onClick={()=>void copy(false,p.id)} aria-label={`Copy private player link for ${p.name}`}>Copy player link</button>}</div></div><div className={`score-controls ${!canAdjust?"read-only-score":""}`}>{canAdjust&&<Button className="count-button subtract" variant="outline" aria-label={`Subtract one sushi from ${p.name}`} disabled={p.count===0||disabled} onClick={()=>void save({action:"adjust",roomCode,participantId:p.id,delta:-1,operationId:crypto.randomUUID()}).catch(()=>{})}><Minus size={20}/></Button>}<div className="participant-count" aria-label={`${p.count} sushi`}>{p.count.toLocaleString()}<span>sushi</span></div>{canAdjust&&<Button className="count-button add" aria-label={`Add one sushi to ${p.name}`} disabled={disabled} onClick={()=>void save({action:"adjust",roomCode,participantId:p.id,delta:1,operationId:crypto.randomUUID()}).catch(()=>{})}><Plus size={23}/></Button>}</div></li>;})}</ol>}
        <div className="board-footer"><span>{busy?"Saving to the table…":"Updates automatically every 2 seconds"}</span><span>{view==="legacy"?"Read-only archive":role==="host"?"Host controls enabled":"Your count, your controls"}</span></div></section>
      </div>
    </>}
    <p className="saved-notice" role="status" aria-live="polite">{notice&&<><Check size={16}/>{notice}</>}</p><footer className="page-footer"><span>SUSHI SHOWDOWN</span><span>Good company. Friendly competition.</span></footer>
  </main>;
}
