import express from 'express';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Server} from 'socket.io';
import QRCode from 'qrcode';
import {Arena,ArenaError} from './arena.mjs';
import {loadBank} from './bank.mjs';
import {Store} from './store.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const COOKIE='arena_session';
export function sessionFromCookie(header=''){const value=header.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return /^[A-Za-z0-9_-]{43}$/.test(value||'')?value:null;}
class Limiter{
 constructor(){this.buckets=new Map();}
 take(key,limit,ms){const now=Date.now();let b=this.buckets.get(key);if(!b||now>=b.until){b={count:0,until:now+ms};this.buckets.set(key,b);}if(++b.count>limit)throw new ArenaError('RATE_LIMIT','操作太频繁，请稍后重试',429);if(this.buckets.size>2000)for(const [k,v] of this.buckets)if(now>=v.until)this.buckets.delete(k);}
}
export function createApp({bank=loadBank(),database=process.env.DATABASE_PATH||resolve(root,'data/math-arena.sqlite'),cfg={},publicBase=process.env.PUBLIC_BASE_URL||process.env.RENDER_EXTERNAL_URL||'',production=process.env.NODE_ENV==='production',now=Date.now,pick,trustProxy=process.env.TRUST_PROXY==='true'}={}){
 if(publicBase){const u=new URL(publicBase);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('PUBLIC_BASE_URL须为不含路径、凭证、查询或片段的网址');if(production&&u.protocol!=='https:')throw new Error('生产环境PUBLIC_BASE_URL必须使用HTTPS');publicBase=u.origin;}
 if(production&&!publicBase)throw new Error('生产环境缺少PUBLIC_BASE_URL；请先配置实际HTTPS域名');
 const store=new Store(database),arena=new Arena({bank,store,cfg,now,pick}),app=express(),server=createServer(app),limits=new Limiter();let base=publicBase;
 const originAllowed=origin=>!origin||origin===base;
 app.disable('x-powered-by');if(trustProxy)app.set('trust proxy',1);
 app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});if(production)res.set('Strict-Transport-Security','max-age=31536000');if(!['GET','HEAD'].includes(req.method)&&!originAllowed(req.headers.origin))return res.status(403).json({ok:false,error:'ORIGIN',message:'只允许同源请求'});next();});
 app.use(express.json({limit:'4kb',strict:true}));
 app.use('/api',(req,res,next)=>{let sid=sessionFromCookie(req.headers.cookie);if(!sid){sid=randomBytes(32).toString('base64url');res.cookie(COOKIE,sid,{httpOnly:true,secure:production,sameSite:'lax',maxAge:48*60*60_000,path:'/'});}req.sid=sid;next();});
 const attempt=fn=>(req,res,next)=>{try{Promise.resolve(fn(req,res)).catch(next);}catch(e){next(e);}};
 app.get('/healthz',(req,res)=>res.json({ok:true,service:'math-arena-online',version:'0.2.0'}));
 app.get('/api/meta',(req,res)=>res.json({ok:true,version:'0.2.0',publicBaseUrl:base,publicDeployment:production,bank:{count:bank.length,singleChoice:8,numericFill:4},rules:{hp:arena.cfg.hp,matchSeconds:arena.cfg.matchMs/1000,combo:arena.cfg.combo,speedRate:arena.cfg.speedRate,evaluateEvery:arena.cfg.evaluateEvery},notice:production?'公网联调入口；网络与手机扫码请按实际测试结果判断。':'本地联调服务，链接与二维码不是正式公网入口。'}));
 app.get('/api/entry-qr.:format',attempt(async(req,res)=>{limits.take('entry-qr:'+req.ip,30,60_000);if(!production)throw new ArenaError('NOT_DEPLOYED','尚未配置已部署的HTTPS入口，不生成正式首页二维码',409);if(!['png','svg'].includes(req.params.format))throw new ArenaError('BAD_FORMAT','仅支持PNG或SVG');res.type(req.params.format==='png'?'image/png':'image/svg+xml');if(req.query.download==='1')res.set('Content-Disposition',`attachment; filename="math-arena-entry.${req.params.format}"`);const options={errorCorrectionLevel:'H',margin:4,scale:16};res.send(req.params.format==='png'?await QRCode.toBuffer(base+'/',options):await QRCode.toString(base+'/',{...options,type:'svg'}));}));
 app.post('/api/rooms',attempt((req,res)=>{limits.take('create:'+req.ip,3,60_000);if(!req.body||Object.keys(req.body).length)throw new ArenaError('BAD_REQUEST','创建请求不接受自定义比赛参数');const created=arena.create(req.sid);res.status(201).json({ok:true,roomId:created.roomId,expiresAt:created.expiresAt,studentUrl:`${base}/join/${created.roomId}`,teacherUrl:`${base}/teacher/${created.roomId}#key=${created.key}`,publicDeployment:production});}));
 app.get('/api/rooms/:id',attempt((req,res)=>{limits.take('read:'+req.ip,240,60_000);arena.tick();res.json({ok:true,state:arena.snapshot(req.params.id,req.sid)});}));
 app.post('/api/rooms/:id/join',attempt((req,res)=>{limits.take('join:'+req.ip,20,60_000);if(!req.body||Object.keys(req.body).some(k=>k!=='nickname'))throw new ArenaError('BAD_REQUEST','加入请求格式无效');arena.join(req.params.id,req.sid,req.body.nickname);res.json({ok:true,state:arena.snapshot(req.params.id,req.sid)});}));
 app.post('/api/rooms/:id/claim',attempt((req,res)=>{limits.take('claim:'+req.ip,8,60_000);if(!req.body||Object.keys(req.body).some(k=>k!=='token'))throw new ArenaError('BAD_REQUEST','管理凭证格式无效');arena.claim(req.params.id,req.sid,req.body.token);res.json({ok:true,state:arena.snapshot(req.params.id,req.sid)});}));
 app.get('/api/rooms/:id/qr.:format',attempt(async(req,res)=>{limits.take('qr:'+req.ip,30,60_000);arena.tick();const room=arena.get(req.params.id);if(arena.actor(room,req.sid)?.role!=='teacher')throw new ArenaError('FORBIDDEN','只有教师可以获取分享二维码',403);if(!['png','svg'].includes(req.params.format))throw new ArenaError('BAD_FORMAT','仅支持PNG或SVG');const url=`${base}/join/${room.id}`;res.type(req.params.format==='png'?'image/png':'image/svg+xml');if(req.query.download==='1')res.set('Content-Disposition',`attachment; filename="math-arena-${room.id}.${req.params.format}"`);const options={errorCorrectionLevel:'H',margin:4,scale:10};res.send(req.params.format==='png'?await QRCode.toBuffer(url,options):await QRCode.toString(url,{...options,type:'svg'}));}));
 // Only this directory is public. Source, answer bank, SQLite, backups and legacy trial are never static routes.
 app.use(express.static(resolve(root,'public'),{index:false,dotfiles:'deny',fallthrough:true,setHeaders:res=>res.set('Cache-Control','no-store')}));
 app.get(['/',/^\/join\/[A-Za-z0-9_-]{12}$/, /^\/teacher\/[A-Za-z0-9_-]{12}$/],(req,res)=>res.sendFile(resolve(root,'public/index.html')));
 app.use((req,res)=>res.status(404).json({ok:false,error:'NOT_FOUND',message:'页面或接口不存在'}));
 app.use((err,req,res,next)=>{if(res.headersSent)return next(err);const status=err instanceof ArenaError?err.status:err.type==='entity.too.large'?413:err instanceof SyntaxError?400:500;res.status(status).json({ok:false,error:err instanceof ArenaError?err.code:'REQUEST_FAILED',message:status>=500?'服务暂时异常，请稍后重试':err instanceof ArenaError?err.message:'请求格式无效或过大'});});
 const io=new Server(server,{serveClient:true,maxHttpBufferSize:4096,pingInterval:5000,pingTimeout:8000,connectTimeout:10_000,allowRequest:(req,cb)=>cb(null,originAllowed(req.headers.origin))});
 io.use((socket,next)=>{try{limits.take('connect:'+socket.request.socket.remoteAddress,60,60_000);const sid=sessionFromCookie(socket.request.headers.cookie),id=socket.handshake.auth?.roomId;arena.tick();if(!sid||typeof id!=='string'||!arena.actor(arena.get(id),sid))throw new ArenaError('UNAUTHORIZED','身份无效，请重新打开房间链接',403);socket.data={sid,roomId:id,actor:arena.actor(arena.get(id),sid)};next();}catch(e){next(new Error(e instanceof ArenaError?e.message:'连接暂不可用'));}});
 arena.onChange=id=>{for(const s of io.of('/').sockets.values())if(s.data.roomId===id){try{s.emit('state',arena.snapshot(id,s.data.sid));}catch(e){s.emit('room_error',{message:e.message});}}};
 io.on('connection',socket=>{const {roomId,sid,actor}=socket.data;arena.connected(roomId,actor.id,socket.id,true);socket.emit('state',arena.snapshot(roomId,sid));socket.on('sync',(ack)=>{if(typeof ack!=='function')return;try{limits.take('sync:'+sid,40,10_000);arena.tick();ack({ok:true,state:arena.snapshot(roomId,sid)});}catch(e){ack({ok:false,error:e.code||'SYNC_FAILED',message:e instanceof ArenaError?e.message:'同步失败'});}});socket.on('command',(body,ack)=>{if(typeof ack!=='function')return;try{limits.take('command:'+sid,30,10_000);const receipt=arena.request(roomId,sid,body);ack({ok:true,...receipt,state:arena.snapshot(roomId,sid)});}catch(e){ack({ok:false,error:e.code||'COMMAND_FAILED',message:e instanceof ArenaError?e.message:'服务暂时异常，请重试同步'});}});socket.on('disconnect',()=>arena.connected(roomId,actor.id,socket.id,false));});
 const ticker=setInterval(()=>{try{arena.tick();}catch{for(const s of io.of('/').sockets.values())s.emit('room_error',{message:'服务器保存状态失败，比赛暂不可用，请联系教师。'});}},50);ticker.unref();
 return {app,server,io,arena,store,get base(){return base;},async listen(port=0,host='127.0.0.1'){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});if(!base)base=`http://127.0.0.1:${server.address().port}`;return base;},async close(){clearInterval(ticker);await new Promise(r=>io.close(r));store.close();}};
}
