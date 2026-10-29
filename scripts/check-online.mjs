import {io} from 'socket.io-client';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
const base=new URL(process.argv[2]||'http://127.0.0.1:3000').origin;
const local=['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname);
const bank=JSON.parse(readFileSync('high_school_sets_logic_v01.json','utf8')).questions;
const report={url:base,verifiedAt:new Date().toISOString(),scope:local?'Local real HTTP/WebSocket clients on one computer':'Public HTTPS/WSS from current execution network only',twoPhysicalDevices:false,twoDifferentNetworks:false,mainlandDirectVerified:false,checks:[]};
const sockets=[];
function client(){let cookie='';return {get cookie(){return cookie;},async req(path,body){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const bytes=Buffer.from(await r.arrayBuffer());let data;try{data=JSON.parse(bytes.toString());}catch{}return {status:r.status,data,bytes};}};}
const assert=(ok,message)=>{if(!ok)throw new Error(message);report.checks.push(message);};
const wait=async fn=>{const end=Date.now()+15000;while(!fn()){if(Date.now()>end)throw new Error('等待状态超时');await new Promise(r=>setTimeout(r,50));}};
const command=(socket,action,extra={})=>socket.timeout(10000).emitWithAck('command',{action,requestId:randomUUID(),...extra});
try{
 const teacher=client(),a=client(),b=client(),meta=(await teacher.req('/api/meta')).data;
 assert(meta?.ok&&meta.version==='0.2.0','Online backend health and version');
 if(!local)assert(meta.publicDeployment&&meta.publicBaseUrl===base,'Public deployment origin matches actual HTTPS target');
 const c=await teacher.req('/api/rooms',{});assert(c.status===201,'Teacher creates room');const rid=c.data.roomId;
 for(const [peer,nickname] of [[a,'自动核验甲'],[b,'自动核验乙']])assert((await peer.req('/api/rooms/'+rid+'/join',{nickname})).status===200,'Independent student joins');
 async function connect(peer){const s=io(base,{autoConnect:false,forceNew:true,transports:['websocket'],auth:{roomId:rid},extraHeaders:{Cookie:peer.cookie,Origin:base},reconnection:false,timeout:15000});s.state=null;s.on('state',state=>s.state=state);sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);s.connect();});await wait(()=>s.state);return s;}
 const ts=await connect(teacher),as=await connect(a),bs=await connect(b);assert(as.io.engine.transport.name==='websocket'&&bs.io.engine.transport.name==='websocket','Actual WebSocket transport connected for both students');
 await Promise.all([command(as,'ready',{ready:true}),command(bs,'ready',{ready:true})]);assert((await command(ts,'start')).ok,'Teacher starts authoritative match');await wait(()=>as.state.status==='playing'&&bs.state.status==='playing');
 assert(as.state.round.id===bs.state.round.id&&as.state.round.deadline===bs.state.round.deadline,'Both students receive identical round and deadline');
 const q=bank.find(q=>q.id===as.state.round.question.id),body={matchId:as.state.match.id,roundId:as.state.round.id,answer:q.correct_answer};
 assert((await command(as,'answer',body)).ok,'First student submits');await wait(()=>bs.state.players.some(p=>p.submitted));assert(bs.state.round.ownAnswer===null&&bs.state.round.settlement===null&&bs.state.players.every(p=>p.hp===100),'Opponent answer and solution remain hidden; no early HP changes');
 as.disconnect();const resumed=await connect(a);assert(resumed.state.round.id===body.roundId&&resumed.state.players.find(p=>p.id===resumed.state.me.id).submitted,'Reconnect restores same identity and submitted lock');
 assert((await command(bs,'answer',body)).ok,'Second student submits');await wait(()=>resumed.state.round.state==='settled'&&bs.state.round.state==='settled');assert(JSON.stringify(resumed.state.round.settlement)===JSON.stringify(bs.state.round.settlement),'Both receive identical simultaneous settlement');assert(resumed.state.players.every(p=>p.hp<100),'Both students attack through server-computed damage');
 const qr=await teacher.req('/api/rooms/'+rid+'/qr.png?download=1'),png=PNG.sync.read(qr.bytes),decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data;
 assert(qr.status===200&&decoded===c.data.studentUrl&&!decoded.includes('#'),'Downloaded room QR exactly matches student URL without teacher credential');
 assert((await command(ts,'end',{matchId:body.matchId})).ok,'Teacher ends match');await wait(()=>resumed.state.status==='ended'&&bs.state.status==='ended');assert(JSON.stringify(resumed.state.result)===JSON.stringify(bs.state.result),'Final result agrees for both students');
 await command(ts,'close');report.passed=true;report.roomQrDecodedCorrectly=true;report.roomClosedAfterTest=true;
}catch(e){report.passed=false;report.error=String(e.message);process.exitCode=1;}finally{for(const s of sockets)s.disconnect();mkdirSync('verification',{recursive:true});const path='verification/online-'+(local?'local':'live')+'.json';writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
