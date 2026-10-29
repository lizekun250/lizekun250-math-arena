import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export class Store{
 constructor(path){this.path=path;if(path!==':memory:')mkdirSync(dirname(resolve(path)),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, state TEXT NOT NULL, purge_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS rooms_expiry ON rooms(purge_at);');}
 load(){return this.db.prepare('SELECT state FROM rooms').all().map(r=>JSON.parse(r.state));}
 save(room){this.db.prepare('INSERT INTO rooms(id,state,purge_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,purge_at=excluded.purge_at').run(room.id,JSON.stringify(room),room.purgeAt);}
 remove(id){this.db.prepare('DELETE FROM rooms WHERE id=?').run(id);}
 async backup(path){await backup(this.db,path);}
 close(){this.db.close();}
}
