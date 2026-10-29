// Run only after check-online.mjs has succeeded against a real deployed HTTPS origin.
import {readFileSync,writeFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import {Resvg} from '@resvg/resvg-js';
const live=JSON.parse(readFileSync('verification/online-live.json','utf8'));
if(!live.passed||!live.url.startsWith('https://')||/localhost|127\.0\.0\.1/.test(live.url))throw new Error('缺少已通过验证的真实公网后端；不生成冒充正式入口的二维码');
const base=new URL(live.url).origin,target=base+'/';
const pngResponse=await fetch(base+'/api/entry-qr.png'),svgResponse=await fetch(base+'/api/entry-qr.svg');
if(!pngResponse.ok||!svgResponse.ok)throw new Error('线上首页二维码下载失败');
const png=Buffer.from(await pngResponse.arrayBuffer()),svg=await svgResponse.text();
const decode=bytes=>{const p=PNG.sync.read(bytes);return jsQR(new Uint8ClampedArray(p.data),p.width,p.height)?.data;};
if(decode(png)!==target||decode(new Resvg(svg,{fitTo:{mode:'width',value:1200}}).render().asPng())!==target)throw new Error('二维码解码目标与线上入口不一致');
writeFileSync('online-entry-qrcode.png',png);writeFileSync('online-entry-qrcode.svg',svg);
const generatedAt=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'})+' UTC+08:00';
const report={url:target,generatedAt,pngDecoded:target,svgDecoded:target,physicalPhoneScan:false,mainlandDirectVerified:false};
writeFileSync('verification/online-entry-qr.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('ONLINE_QR_CODE_README.md',`# 在线1V1入口二维码\n\n实际目标：${target}\n\n生成时间：${generatedAt}\n\n仅在公网HTTP/WSS联调通过后生成；PNG与SVG已独立解码确认。实体手机扫码与大陆直连仍需实际验证，不能用海外/当前网络可达性替代。\n\n每场比赛二维码由教师创建房间后生成，目标是该域名下的/join/房间ID，不包含教师控制凭证。教师页面可直接下载PNG；首页提供入口PNG和SVG下载。\n\n此前根目录qrcode.png/qrcode.svg对应单人试玩，不能与本在线版混用。域名改变时先重新配置并部署服务，通过npm run check:online -- <实际HTTPS地址>后重新运行本脚本，并同步文档。\n`);console.log(JSON.stringify(report,null,2));
