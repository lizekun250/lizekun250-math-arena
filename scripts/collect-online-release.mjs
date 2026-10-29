// Source-only manifest for connected GitHub publishing; never include data, credentials or generated test cookies.
import {readFileSync,readdirSync} from 'node:fs';
const paths=['.gitignore','.dockerignore','.env.example','Dockerfile','render.yaml','package.json','package-lock.json','README.md','ONLINE_README.md','ONLINE_DEPLOYMENT.md','ONLINE_TEST_REPORT.md','verification/online-local.json'];
for(const dir of ['server','public','deploy'])for(const f of readdirSync(dir,{withFileTypes:true}))if(f.isFile())paths.push(dir+'/'+f.name);
for(const f of readdirSync('tests'))if(/^online.*\.test\.mjs$/.test(f))paths.push('tests/'+f);
for(const name of ['backup-online.mjs','check-online.mjs','interactive-peers.mjs','publish-online-qr.mjs','collect-online-release.mjs'])paths.push('scripts/'+name);
console.log(JSON.stringify(paths.map(path=>({path,length:readFileSync(path,'utf8').length}))));
