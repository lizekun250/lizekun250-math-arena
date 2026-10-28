import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const html=readFileSync('index.html','utf8');
const script=id=>html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1];
const ctx={};runInNewContext(script('arena-core'),ctx);const {Game,damage,multiplier,isCorrect}=ctx.ArenaCore;
const bank=JSON.parse(script('question-bank')).questions,cfg=JSON.parse(script('game-config'));
function fixture(overrides={}){let time=1000;const game=new Game(bank,{...cfg,shuffle:false,...overrides},()=>time);game.start();game.show();return {game,set:t=>time=t,add:t=>time+=t};}
test('题库结构为8选择+4填空，ID唯一，原文件保持原样',()=>{assert.equal(bank.length,12);assert.equal(new Set(bank.map(q=>q.id)).size,12);assert.equal(bank.filter(q=>q.question_type==='single_choice').length,8);assert.equal(bank.filter(q=>q.question_type==='numeric_fill').length,4);assert.equal(createHash('sha256').update(readFileSync('high_school_sets_logic_v01.json')).digest('hex'),'0e0b6759853d85f01524dfa1ba6e399a8843a1c77cb9ecff48029feec08df2be');for(const q of bank){for(const key of ['id','stem','options','correct_answer','accepted_equivalent_answers','explanation','difficulty','suggested_base_damage','recommended_time_sec'])assert.ok(key in q);assert.ok(q.recommended_time_sec>0&&q.suggested_base_damage>0);if(q.question_type==='single_choice'){assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(o=>o.key)).size,4);assert.equal(q.options.filter(o=>o.key===q.correct_answer).length,1);}}});
test('12题数学独立复核：计算得到唯一正确答案与全部配置等价形式',()=>{
 const sorted=s=>[...new Set(s)].sort((a,b)=>a-b);const intersection=(a,b)=>sorted(a.filter(x=>b.includes(x)));
 const setFromOption=s=>sorted(s.replace(/[{}]/g,'').split(',').map(Number));
 const finite=(id,expected)=>{const q=bank.find(q=>q.id===id);const keys=q.options.filter(o=>JSON.stringify(setFromOption(o.text))===JSON.stringify(expected)).map(o=>o.key);assert.deepEqual(keys,[q.correct_answer],id);};
 finite('SL001',[-1,0,1,2]);finite('SL003',intersection([1,2,3],[2,3,4]));finite('SL004',[1,2,3,4,5,6].filter(x=>![2,4,6].includes(x)));
 // Universal subset property: also test empty A, A={0}, A containing the empty set.
 const empty=Symbol('empty');const samples=[[],[0],[empty],[1,2]];
 const truths=[a=>a.includes(empty),a=>[].every(x=>a.includes(x)),a=>a.length===0,a=>false];
 const valid=truths.map((p,i)=>samples.every(p)?'ABCD'[i]:null).filter(Boolean);assert.deepEqual(valid,[bank[1].correct_answer]);
 const value=s=>{const parts=s.split('/').map(Number);return parts.length===1?parts[0]:parts[0]/parts[1];};
 const numericExpected={SL005:sorted([1,2,3,4,3,4,5]).length,SL006:1,SL007:2**3,SL012:1/2};
 for(const [id,expected] of Object.entries(numericExpected)){const q=bank.find(q=>q.id===id);assert.equal(value(q.correct_answer),expected,id);for(const a of q.accepted_equivalent_answers)assert.equal(value(a),expected,id);}
 // {a,2}={1,2} iff a=1. a=2 reduces to a singleton; other a produces an extra element.
 for(const a of [-2,0,1,2,3,.5])assert.equal(JSON.stringify(sorted([a,2]))===JSON.stringify([1,2]),a===1);
 // p=>q and q=>p are checked on both roots plus non-roots.
 const xs=[-3,-2,-1,0,1,2,3];const implies=(p,q)=>xs.every(x=>!p(x)||q(x));const p=x=>x===2,q=x=>x*x===4;
 assert.equal(implies(p,q),true);assert.equal(implies(q,p),false);assert.equal(bank[7].correct_answer,'B');assert.equal(bank[8].correct_answer,'B');
 const P=true,Q=false;const vals=[P&&Q,P||Q,(!P)&&Q,(!P)||Q];assert.deepEqual(vals.map((v,i)=>v?'ABCD'[i]:null).filter(Boolean),[bank[9].correct_answer]);
 // Negation syntactically switches universal to existential and > to <=.
 const neg=bank[10].options.filter(o=>o.text.startsWith('存在实数 x')&&o.text.includes('≤ 0'));assert.equal(neg.length,1);assert.equal(neg[0].key,bank[10].correct_answer);
});
test('首题×1.00，后续递增且第5题后封顶×1.40',()=>{const {game}=fixture({opponentHp:1000});const factors=[];for(let i=0;i<8;i++){const h=game.submit(game.question.correct_answer);factors.push(h.factor);if(i<7){assert.ok(game.next());game.show();}}assert.deepEqual(factors,[1,1.1,1.2,1.3,1.4,1.4,1.4,1.4]);assert.equal(multiplier(0,cfg),1);});
test('基础20、倍率1.30、速度2：最终28，速度不乘连击',()=>{const d=damage(20,4,3000,10000,cfg);assert.equal(d.comboDamage,26);assert.equal(d.speedBonus,2);assert.equal(d.total,28);});
test('速度单调递减，最大15%，按floor取整，比例clamp',()=>{let previous=Infinity;for(let t=0;t<=12000;t+=100){const d=damage(20,5,t,10000,cfg);assert.ok(d.speedBonus<=previous);assert.ok(d.speedBonus>=0&&d.speedBonus<=3);assert.equal(d.speedBonus,Math.floor(20*.15*(1-Math.min(t/10000,1))));previous=d.speedBonus;}assert.equal(damage(20,1,-200,10000,cfg).speedBonus,3);assert.equal(damage(20,1,20000,10000,cfg).speedBonus,0);});
test('答错归零、无伤害/奖励，下一次答对重新×1.00',()=>{const {game}=fixture();game.submit('A');game.next();game.show();const hp=game.hp;const h=game.submit('A');assert.equal(h.correct,false);assert.equal(game.combo,0);assert.equal(h.total,0);assert.equal(h.speedBonus,0);assert.equal(game.hp,hp);game.next();game.show();assert.equal(game.submit('B').factor,1);});
test('超时含精确deadline，不会因为后台不运行tick获得额外时间',()=>{const f=fixture();f.game.submit('A');f.game.next();f.game.show();f.add(12000);const hp=f.game.hp;const h=f.game.submit('B');assert.equal(h.timeout,true);assert.equal(h.total,0);assert.equal(h.speedBonus,0);assert.equal(f.game.combo,0);assert.equal(f.game.hp,hp);const late=fixture();late.add(90000);assert.equal(late.game.tick().timeout,true);assert.equal(late.game.history.length,1);assert.equal(late.game.submit('A'),null);});
test('deadline前1ms可答，deadline及之后算超时',()=>{for(const [ms,ok] of [[11999,true],[12000,false],[12001,false]]){const f=fixture();f.add(ms);const h=f.game.submit('A');assert.equal(h.correct,ok);}});
test('填空仅接受已列形式，拒绝近似、表达式和未配置的精确形式',()=>{const q=bank[11];for(const a of ['0.5','0.50','1/2','2/4',' 1/2 ','０.５０'])assert.equal(isCorrect(q,a),true,a);for(const a of ['0.4999999','0.5001','1/2+0','3/6','0.500','NaN','Infinity',''])assert.equal(isCorrect(q,a),false,a);});
test('重复提交不会重复扣血或记题；重复next也不跳题',()=>{const {game}=fixture();const h=game.submit('A');const hp=game.hp;assert.ok(h.total>0);assert.equal(game.submit('A'),null);assert.equal(game.hp,hp);assert.equal(game.history.length,1);assert.equal(game.next(),true);assert.equal(game.next(),false);assert.equal(game.index,1);});
test('HP零结束且不为负，所有提交与next失效',()=>{const {game}=fixture({opponentHp:1});game.submit('A');assert.equal(game.hp,0);assert.equal(game.phase,'ended');assert.equal(game.reason,'victory');assert.equal(game.next(),false);assert.equal(game.submit('A'),null);});
test('全部题目结束；每道选择/填空通过实际引擎验证',()=>{const {game}=fixture({opponentHp:1000});for(let i=0;i<12;i++){const q=game.question;assert.equal(game.submit(q.correct_answer).correct,true,q.id);if(i<11){assert.equal(game.next(),true);game.show();}}assert.equal(game.phase,'ended');assert.equal(game.reason,'questions');assert.equal(game.history.length,12);});
test('总局时限在答题或解析期均生效，后台长时间后立即结束',()=>{let f=fixture({sessionSeconds:5});f.add(5000);assert.equal(f.game.submit('A').timeout,true);assert.equal(f.game.reason,'session');f=fixture({sessionSeconds:5});f.game.submit('A');f.add(6000);f.game.tick();assert.equal(f.game.phase,'ended');assert.equal(f.game.reason,'session');assert.equal(f.game.next(),false);});
test('重新开始清空状态、重新设置时间、HP、连击与题目',()=>{const f=fixture();f.game.submit('A');f.add(3000);f.game.start();assert.equal(f.game.phase,'ready');assert.equal(f.game.hp,100);assert.equal(f.game.combo,0);assert.equal(f.game.maxCombo,0);assert.equal(f.game.history.length,0);assert.equal(f.game.index,0);assert.equal(f.game.last,null);assert.equal(f.game.reason,null);assert.equal(f.game.startedAt,4000);assert.equal(f.game.sessionDeadline,304000);});
test('洗牌保留全部12题且不修改源题库；show前不可提交',()=>{const original=bank.map(q=>q.id).join(',');let time=1;const game=new Game(bank,cfg,()=>time,()=>0);game.start();assert.equal(new Set(game.questions.map(q=>q.id)).size,12);assert.notEqual(game.questions.map(q=>q.id).join(','),original);assert.equal(bank.map(q=>q.id).join(','),original);assert.equal(game.submit('A'),null);time=50;game.show();assert.equal(game.questionStartedAt,50);});
test('HTML核心无网络依赖：无外部脚本/样式/字体/API',()=>{assert.doesNotMatch(html,/<script[^>]+src=/i);assert.doesNotMatch(html,/<link[^>]+(?:stylesheet|preload)/i);assert.doesNotMatch(html,/@import|@font-face|\bfetch\(|\bXMLHttpRequest\b|\bWebSocket\b/);assert.doesNotMatch(script('arena-ui'),/localStorage|sessionStorage/);});
