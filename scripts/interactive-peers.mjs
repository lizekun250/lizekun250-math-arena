// Real network peers for supervised teacher-browser QA, never a product opponent.
import {io} from 'socket.io-client';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
const base=process.argv[2],roomId=process.argv[3];if(!base||!roomId)throw new Error('Provide local base URL and test room id.');
const bank=JSON.parse(readFileSync('high_school_sets_logic_v01.json','utf8')).questions;
for(const [index,nickname] of ['自动测试甲','自动测试乙'].entries()){
 const init=await fetch(base+'/api/meta'),cookie=init.headers.get('set-cookie').split(';')[0];const joined=await fetch(base+'/api/rooms/'+roomId+'/join',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({nickname})});if(!joined.ok)throw new Error('Unable to join test room');
 const socket=io(base,{transports:['websocket'],auth:{roomId},extraHeaders:{Cookie:cookie,Origin:base}}),seen=new Set();
 socket.on('connect',()=>socket.emit('command',{action:'ready',ready:true,requestId:randomUUID()},()=>{}));
 socket.on('state',state=>{if(state.status==='playing'&&state.round.state==='answering'&&!seen.has(state.round.id)){seen.add(state.round.id);const r=state.round,q=bank.find(q=>q.id===r.question.id);setTimeout(()=>{if(socket.connected)socket.emit('command',{action:'answer',requestId:randomUUID(),matchId:state.match.id,roundId:r.id,answer:q.correct_answer},()=>{});},index===0?2000:4000);}if(state.status==='ended'||state.status==='closed')socket.disconnect();});
}
console.log('Two clearly labelled automated WebSocket peers joined and readied. Teacher browser controls the test.');
