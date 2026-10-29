import {readFileSync} from 'node:fs';
import {BANK_FIELDS as F} from './config.mjs';
export const normalize=value=>String(value).normalize('NFKC').trim().replace(/−/g,'-');
export function validateBank(data){
 const fail=message=>{throw new Error('题库加载失败：'+message);};
 if(!Array.isArray(data?.questions)||data.questions.length!==12)fail('必须包含12道题');
 const ids=new Set(),counts={single_choice:0,numeric_fill:0};
 const rational=s=>{if(!/^-?\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?$/.test(s))return NaN;const [a,b='1']=s.split('/').map(Number);return b===0?NaN:a/b;};
 const questions=data.questions.map(q=>{
  for(const field of Object.values(F))if(q[field]===undefined)fail(`${q.id||'未知题目'}缺少${field}`);
  if(typeof q.id!=='string'||ids.has(q.id))fail('题目ID为空或重复');ids.add(q.id);
  if(!(q.question_type in counts))fail(q.id+'题型无效');counts[q.question_type]++;
  if(![1,2].includes(q.difficulty_level)||!Number.isFinite(q.suggested_base_damage)||q.suggested_base_damage<=0||!Number.isFinite(q.recommended_time_sec)||q.recommended_time_sec<=0)fail(q.id+'难度/伤害/时限无效');
  if(!Array.isArray(q.options)||!Array.isArray(q.accepted_equivalent_answers)||typeof q.stem!=='string'||typeof q.explanation!=='string'||typeof q.correct_answer!=='string')fail(q.id+'字段类型错误');
  if(q.question_type==='single_choice'&&(q.options.length!==4||new Set(q.options.map(o=>o.key)).size!==4||q.options.filter(o=>o.key===q.correct_answer).length!==1||q.options.some(o=>typeof o.key!=='string'||typeof o.text!=='string')))fail(q.id+'须有四个不同选项及一个答案');
  if(q.question_type==='numeric_fill'){
   if(q.options.length!==0||!Number.isFinite(rational(q.correct_answer)))fail(q.id+'数字答案无效');
   for(const a of q.accepted_equivalent_answers)if(typeof a!=='string'||!Number.isFinite(rational(a))||rational(a)!==rational(q.correct_answer))fail(q.id+'等价答案无效');
  }
  return Object.freeze({id:q[F.id],type:q[F.type],stem:q[F.stem],options:q[F.options],answer:q[F.answer],equivalents:q[F.equivalents],explanation:q[F.explanation],level:q[F.level],difficulty:q[F.difficulty],topic:q[F.topic],base:q[F.base],limitMs:q[F.seconds]*1000});
 });
 if(counts.single_choice!==8||counts.numeric_fill!==4)fail('须为8道四选一和4道数字填空');return questions;
}
export function loadBank(path=new URL('../high_school_sets_logic_v01.json',import.meta.url)){try{return validateBank(JSON.parse(readFileSync(path,'utf8')));}catch(e){if(e.message.startsWith('题库加载失败'))throw e;throw new Error('题库加载失败：'+e.message);}}
export const publicQuestion=q=>({id:q.id,type:q.type,stem:q.stem,options:q.options.map(o=>({key:o.key,text:o.text})),difficulty:q.difficulty,topic:q.topic,base:q.base});
export function grade(q,input,combo,elapsedMs,limitMs,cfg){const correct=[q.answer,...q.equivalents].map(normalize).includes(normalize(input));const nextCombo=correct?combo+1:0;const factor=cfg.combo[Math.max(0,Math.min(nextCombo-1,cfg.combo.length-1))];const comboDamage=correct?Math.floor(q.base*factor):0;const speedBonus=correct?Math.floor(q.base*cfg.speedRate*(1-Math.min(1,Math.max(0,elapsedMs/limitMs)))):0;return {correct,combo:nextCombo,factor,comboDamage,speedBonus,damage:comboDamage+speedBonus};}
