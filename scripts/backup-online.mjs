import {Store} from '../server/store.mjs';
import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const source=process.env.DATABASE_PATH||resolve('data/math-arena.sqlite'),target=process.argv[2];
if(!target)throw new Error('用法：node scripts/backup-online.mjs <数据库备份绝对路径>');
mkdirSync(dirname(resolve(target)),{recursive:true,mode:0o700});
const store=new Store(source);await store.backup(resolve(target));store.close();console.log('SQLite一致性备份已完成。备份包含昵称与会话凭证哈希，请勿发布。');
