import {randomBytes,randomInt,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {DEFAULTS} from './config.mjs';
import {grade,publicQuestion} from './bank.mjs';
export class ArenaError extends Error{constructor(code,message,status=400){super(message);this.code=code;this.status=status;}}
const reject=(code,msg,status)=>{throw new ArenaError(code,msg,status);};
export const digest=s=>createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export class Arena{
 constructor({bank,store,cfg={},now=Date.now,pick=n=>randomInt(n)}){this.bank=bank;this.byId=new Map(bank.map(q=>[q.id,q]));this.store=store;this.cfg={...DEFAULTS,...cfg};this.now=now;this.pick=pick;this.rooms=new Map();this.connections=new Map();this.onChange=()=>{};
  for(const r of store.load()){if(r.purgeAt<=now()){store.remove(r.id);continue;}if(r.status==='playing'){this.finish(r,'interrupted',now());r.result.winner=null;r.result.interrupted=true;store.save(r);}this.rooms.set(r.id,r);}
 }
 create(sid){this.tick();if(this.rooms.size>=this.cfg.maxRooms)reject('CAPACITY','服务暂时繁忙，请稍后创建',503);const now=this.now(),id=randomBytes(9).toString('base64url'),key=randomBytes(32).toString('base64url');const r={id,status:'waiting_players',createdAt:now,expiresAt:now+this.cfg.roomTtlMs,purgeAt:now+this.cfg.waitingTtlMs,teacherHash:digest(sid),controlHash:digest(key),controlUsed:false,players:[],match:null,archived:[],round:null,history:[],revision:1,receipts:[]};this.store.save(r);this.rooms.set(id,r);return {roomId:id,key,expiresAt:r.expiresAt};}
 get(id){const r=this.rooms.get(id);if(!r)reject('NOT_FOUND','房间不存在或已过期',404);return r;}
 actor(r,sid){const h=digest(sid);if(equal(r.teacherHash,h))return {role:'teacher',id:'teacher'};const p=r.players.find(p=>equal(p.sessionHash,h));return p?{role:'student',id:p.id}:null;}
 mutate(id,fn){const before=this.get(id),r=structuredClone(before);const result=fn(r);r.revision++;this.store.save(r);this.rooms.set(id,r);this.onChange(id);return result;}
 claim(id,sid,key){this.tick();const old=this.get(id);if(this.actor(old,sid)?.role==='teacher')return;if(typeof key!=='string'||key.length>100||old.controlUsed||this.now()>=old.expiresAt||!equal(old.controlHash,digest(key)))reject('BAD_CONTROL','教师管理凭证无效、已使用或已过期',403);this.mutate(id,r=>{r.teacherHash=digest(sid);r.controlUsed=true;r.controlHash='';});}
 join(id,sid,nickname){this.tick();const old=this.get(id),existing=this.actor(old,sid);if(existing){if(existing.role==='teacher')reject('TEACHER_DEVICE','本浏览器已是教师身份。学生请使用另一浏览器或设备。',409);return existing.id;}
  if(!['waiting_players','waiting_ready'].includes(old.status)||this.now()>=old.expiresAt)reject('NOT_JOINABLE','比赛已开始、结束或关闭，不能加入',409);if(old.players.length>=2)reject('ROOM_FULL','房间已满，仅允许两名正式参赛者',409);
  const name=String(nickname??'').normalize('NFKC').trim();if(name.length<1||Array.from(name).length>20||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/u.test(name))reject('BAD_NAME','昵称需为1～20个字符，不能含控制符或尖括号');
  return this.mutate(id,r=>{const p={id:randomUUID(),sessionHash:digest(sid),nickname:name,ready:false,hp:this.cfg.hp,combo:0,maxCombo:0};r.players.push(p);r.status=r.players.length===2?'waiting_ready':'waiting_players';return p.id;});
 }
 connected(id,actorId,socketId,on){const key=id+':'+actorId;let sockets=this.connections.get(key);if(!sockets){sockets=new Set();this.connections.set(key,sockets);}if(on)sockets.add(socketId);else sockets.delete(socketId);if(!sockets.size)this.connections.delete(key);this.onChange(id);}
 isConnected(id,actorId){return (this.connections.get(id+':'+actorId)?.size||0)>0;}
 request(id,sid,body){this.tick();if(!body||typeof body!=='object'||Array.isArray(body))reject('BAD_REQUEST','请求格式无效');const {action,requestId}=body;if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(requestId))reject('BAD_REQUEST','缺少有效的操作编号');
  const permitted={ready:['action','requestId','ready'],answer:['action','requestId','matchId','roundId','answer'],start:['action','requestId'],end:['action','requestId','matchId'],restart:['action','requestId','matchId'],close:['action','requestId']};
  if(!permitted[action]||Object.keys(body).some(k=>!permitted[action].includes(k)))reject('BAD_REQUEST','请求包含不允许的字段');const old=this.get(id),actor=this.actor(old,sid);if(!actor)reject('UNAUTHORIZED','请先加入房间',403);const fingerprint=digest(JSON.stringify(body)),receipt=old.receipts.find(x=>x.actor===actor.id&&x.id===requestId);if(receipt){if(receipt.hash!==fingerprint)reject('REPLAY','操作编号已用于其他请求',409);return {duplicate:true};}
  if(['start','end','restart','close'].includes(action)&&actor.role!=='teacher')reject('FORBIDDEN','只有教师可以管理比赛',403);
  if(['ready','answer'].includes(action)&&actor.role!=='student')reject('FORBIDDEN','仅参赛学生可执行该操作',403);
  if(this.now()>=old.expiresAt&&!['answer','end','close'].includes(action))reject('EXPIRED','房间有效期已结束',410);
  this.mutate(id,r=>{
   const p=r.players.find(x=>x.id===actor.id),now=this.now();
   if(action==='ready'){if(!['waiting_players','waiting_ready'].includes(r.status)||typeof body.ready!=='boolean')reject('BAD_STATE','当前不能更改准备状态',409);p.ready=body.ready;}
   if(action==='start'){if(r.status!=='waiting_ready'||r.players.length!==2||!r.players.every(p=>p.ready&&this.isConnected(id,p.id)))reject('NOT_READY','请等待两名学生连接并准备',409);this.start(r,now);}
   if(action==='answer'){
    if(r.status!=='playing'||r.match.id!==body.matchId||r.round.id!==body.roundId||r.round.state!=='answering')reject('STALE_ROUND','本题已结算或已进入其他回合，请同步最新状态',409);
    if(now>=r.round.deadline)reject('LATE','本题已截止，不能补交',409);if(r.round.submissions[p.id])reject('ALREADY_SUBMITTED','本题已提交，答案已锁定',409);
    if(typeof body.answer!=='string'||body.answer.length<1||body.answer.length>80||!body.answer.trim())reject('BAD_ANSWER','请输入有效答案');
    const q=this.byId.get(r.round.questionId);if(q.type==='single_choice'&&!q.options.some(o=>o.key===body.answer))reject('BAD_ANSWER','选项无效');r.round.submissions[p.id]={answer:body.answer,receivedAt:now};if(r.players.every(p=>r.round.submissions[p.id]))this.settle(r,now);
   }
   if(action==='end'){if(r.status!=='playing'||r.match.id!==body.matchId)reject('BAD_STATE','比赛已经结束或编号已过期',409);if(r.round.state==='answering')this.settle(r,now,'teacher');this.finish(r,'teacher',now);}
   if(action==='restart'){if(!['ended','interrupted'].includes(r.status)||r.match?.id!==body.matchId)reject('BAD_STATE','请先结束当前比赛，再重新开始',409);r.archived.push({match:r.match,result:r.result,history:r.history});r.archived=r.archived.slice(-3);r.match=null;r.round=null;r.history=[];r.result=null;r.status=r.players.length===2?'waiting_ready':'waiting_players';r.purgeAt=Math.min(r.expiresAt,now+this.cfg.waitingTtlMs);for(const p of r.players){p.ready=false;p.hp=this.cfg.hp;p.combo=0;p.maxCombo=0;}}
   if(action==='close'){if(r.status==='closed')reject('BAD_STATE','房间已关闭',409);if(r.status==='playing'){if(r.round.state==='answering')this.settle(r,now,'teacher');this.finish(r,'closed',now);}r.status='closed';r.purgeAt=now+this.cfg.resultTtlMs;}
   r.receipts.push({actor:actor.id,id:requestId,hash:fingerprint});r.receipts=r.receipts.slice(-512);
  });return {duplicate:false};
 }
 start(r,now){r.match={id:randomUUID(),startedAt:now,deadline:now+this.cfg.matchMs,difficulty:1};r.status='playing';r.history=[];r.result=null;r.purgeAt=r.match.deadline+this.cfg.resultTtlMs;for(const p of r.players){p.hp=this.cfg.hp;p.combo=0;p.maxCombo=0;}this.nextRound(r,now);}
 nextRound(r,now){if(r.history.length&&r.history.length%this.cfg.evaluateEvery===0){const recent=r.history.slice(-this.cfg.difficultyWindow),correct=recent.reduce((s,h)=>s+h.players.filter(p=>p.correct).length,0),rate=correct/(recent.length*2);if(rate>=this.cfg.promoteRate)r.match.difficulty=2;else if(rate<=this.cfg.demoteRate)r.match.difficulty=1;}
  const recent=r.history.slice(-this.cfg.recentQuestions).map(h=>h.question.id);let pool=this.bank.filter(q=>q.level===r.match.difficulty&&!recent.includes(q.id));if(!pool.length)pool=this.bank.filter(q=>q.level===r.match.difficulty&&q.id!==recent.at(-1));if(!pool.length)pool=this.bank.filter(q=>q.level===r.match.difficulty);const q=pool[this.pick(pool.length)];r.round={id:randomUUID(),number:r.history.length+1,state:'answering',questionId:q.id,startedAt:now,deadline:Math.min(now+q.limitMs,r.match.deadline),submissions:{},settlement:null};}
 settle(r,at,missingReason='timeout'){if(r.round.state!=='answering')return;const round=r.round,q=this.byId.get(round.questionId),timeLimit=round.deadline-round.startedAt;
  const outcomes=r.players.map(p=>{const s=round.submissions[p.id],previousCombo=p.combo;const h=s?grade(q,s.answer,p.combo,s.receivedAt-round.startedAt,timeLimit,this.cfg):{correct:false,combo:0,factor:1,comboDamage:0,speedBonus:0,damage:0};p.combo=h.combo;p.maxCombo=Math.max(p.maxCombo,p.combo);return {id:p.id,nickname:p.nickname,answer:s?.answer??null,receivedAt:s?.receivedAt??null,elapsedMs:s?Math.max(0,s.receivedAt-round.startedAt):timeLimit,timeout:!s&&missingReason==='timeout',missingReason:s?null:missingReason,previousCombo,...h};});
  for(let i=0;i<2;i++)r.players[i].hp=Math.max(0,r.players[i].hp-outcomes[1-i].damage);
  round.state='settled';round.settledAt=at;round.nextAt=Math.min(at+this.cfg.feedbackMs,r.match.deadline);round.settlement={roundId:round.id,number:round.number,question:{...publicQuestion(q),answer:q.answer,explanation:q.explanation},players:outcomes,hp:r.players.map(p=>({id:p.id,hp:p.hp})),settledAt:at};r.history.push(round.settlement);
 }
 finish(r,reason,at){r.status=reason==='interrupted'?'interrupted':'ended';r.match={...r.match,endedAt:at};const [a,b]=r.players;const winner=reason==='interrupted'?null:a.hp===b.hp?'draw':a.hp>b.hp?a.id:b.id;r.result={reason,winner,endedAt:at,players:r.players.map(p=>{const answers=r.history.map(h=>h.players.find(x=>x.id===p.id));const correct=answers.filter(a=>a?.correct).length;return {id:p.id,nickname:p.nickname,hp:p.hp,answered:answers.filter(a=>a?.answer!==null).length,total:answers.length,correct,accuracy:answers.length?correct/answers.length:0,maxCombo:p.maxCombo,damage:answers.reduce((s,a)=>s+(a?.damage||0),0)};})};r.purgeAt=at+this.cfg.resultTtlMs;}
 tick(){const now=this.now();for(const old of [...this.rooms.values()]){
  if(now>=old.purgeAt){this.store.remove(old.id);this.rooms.delete(old.id);this.onChange(old.id);continue;}
  if(['waiting_players','waiting_ready'].includes(old.status)&&now>=old.expiresAt){this.mutate(old.id,r=>{r.status='closed';r.purgeAt=now+this.cfg.resultTtlMs;});continue;}
  if(old.status!=='playing')continue;const r=structuredClone(old);let changed=false;
  if(now>=r.match.deadline){if(r.round.state==='answering')this.settle(r,r.match.deadline);this.finish(r,'time',r.match.deadline);changed=true;}
  else if(r.round.state==='answering'&&now>=r.round.deadline){this.settle(r,r.round.deadline);changed=true;}
  else if(r.round.state==='settled'&&now>=r.round.nextAt){this.nextRound(r,now);changed=true;}
  if(changed){r.revision++;this.store.save(r);this.rooms.set(r.id,r);this.onChange(r.id);}
 }}
 snapshot(id,sid){const r=this.get(id),me=this.actor(r,sid);const state={roomId:r.id,status:r.status,revision:r.revision,serverNow:this.now(),createdAt:r.createdAt,expiresAt:r.expiresAt,me,config:{hp:this.cfg.hp,matchMs:this.cfg.matchMs,evaluateEvery:this.cfg.evaluateEvery,feedbackMs:this.cfg.feedbackMs},teacherConnected:this.isConnected(id,'teacher'),players:r.players.map(p=>({id:p.id,nickname:p.nickname,ready:p.ready,connected:this.isConnected(id,p.id),hp:p.hp,combo:p.combo,factor:this.cfg.combo[Math.max(0,Math.min(p.combo-1,this.cfg.combo.length-1))],maxCombo:p.maxCombo,submitted:r.round?.state==='answering'?!!r.round.submissions[p.id]:r.round?.settlement?.players.some(x=>x.id===p.id&&x.answer!==null)||false}))};
  if(!me)return {...state,players:state.players.map(({id,nickname,ready,connected})=>({id,nickname,ready,connected})),joinable:['waiting_players','waiting_ready'].includes(r.status)&&r.players.length<2&&this.now()<r.expiresAt};
  state.match=r.match?{id:r.match.id,startedAt:r.match.startedAt,deadline:r.match.deadline,difficulty:r.match.difficulty,endedAt:r.match.endedAt}:null;
  if(r.round){const q=this.byId.get(r.round.questionId);state.round={id:r.round.id,number:r.round.number,state:r.round.state,startedAt:r.round.startedAt,deadline:r.round.deadline,question:publicQuestion(q),ownAnswer:me.role==='student'?r.round.submissions[me.id]?.answer??null:null,nextAt:r.round.nextAt,settlement:r.round.state==='settled'?r.round.settlement:null};}
  if(['ended','interrupted','closed'].includes(r.status)){state.result=r.result??null;state.history=r.history;}return state;
 }
}
