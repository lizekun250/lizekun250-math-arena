import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
const bank=JSON.parse(readFileSync('high_school_sets_logic_v01.json','utf8'));
let html=readFileSync('index.html','utf8');
html=html.replace(/(<script id="question-bank" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(bank).replace(/</g,'\\u003c')+b);
writeFileSync('index.html',html);mkdirSync('dist',{recursive:true});copyFileSync('index.html','dist/index.html');
for(const f of ['qrcode.png','qrcode.svg','poster.png','QR_CODE_README.md'])if(existsSync(f))copyFileSync(f,'dist/'+f);
console.log('Single-file HTML and static dist prepared; '+bank.questions.length+' questions embedded.');
