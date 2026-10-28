// Read-only bundle for publishing through the connected GitHub tool; excludes credentials and dependencies.
import {readFileSync,readdirSync} from 'node:fs';
const rootFiles=['.gitignore','.gitattributes','.nojekyll','index.html','README.md','QUESTION_REVIEW.md','TEST_REPORT.md','DEPLOYMENT.md','QR_CODE_README.md','deployment.json','high_school_sets_logic_v01.json','package.json','package-lock.json','qrcode.png','qrcode.svg','poster.png','poster.svg'];
const all=[...rootFiles,'.openai/hosting.json'];
for(const dir of ['scripts','tests','dist','verification'])for(const f of readdirSync(dir,{withFileTypes:true}))if(f.isFile())all.push(dir+'/'+f.name);
const entries=all.map(path=>({path,encoding:path.endsWith('.png')?'base64':'utf-8',content:readFileSync(path).toString(path.endsWith('.png')?'base64':'utf8')}));
console.log(JSON.stringify(process.argv.includes('--manifest')?entries.map(({path,encoding,content})=>({path,encoding,length:content.length})):entries));
