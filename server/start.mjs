import {createApp} from './app.mjs';
const app=createApp();
await app.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0');
console.log('数学擂台在线服务已启动：'+app.base);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
