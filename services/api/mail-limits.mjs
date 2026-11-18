import {DatabaseSync} from 'node:sqlite';
export function openMailLimits(path,{daily=200,monthly=1000}={}){
 const db=new DatabaseSync(path);db.exec(`PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS external_mail_limits(owner TEXT PRIMARY KEY,daily INTEGER,monthly INTEGER) STRICT;
 CREATE TABLE IF NOT EXISTS external_mail_global(created INTEGER NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS external_mail_usage(owner TEXT NOT NULL,period TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(owner,period)) STRICT;`);
 const dates=()=>{const date=new Date().toISOString().slice(0,10);return [date,date.slice(0,7)];};
 const caps=owner=>db.prepare('SELECT daily,monthly FROM external_mail_limits WHERE owner=?').get(owner)??{daily:10,monthly:100};
 const count=(owner,period)=>db.prepare('SELECT count FROM external_mail_usage WHERE owner=? AND period=?').get(owner,period)?.count??0;
 return {
  view(owner){const [day,month]=dates();return {...caps(owner),usedToday:count(owner,day),usedMonth:count(owner,month)};},
  set(owner,limits){
   if(!['daily','monthly'].every(k=>limits[k]===null||Number.isSafeInteger(limits[k])&&limits[k]>=0&&limits[k]<=1000000))throw new Error('Use a whole number or no limit.');
   db.prepare('INSERT INTO external_mail_limits VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET daily=excluded.daily,monthly=excluded.monthly').run(owner,limits.daily,limits.monthly);
  },
  reserve(owner){
   if(owner==='~global')return false;
   db.exec('BEGIN IMMEDIATE');
   try{
    const [day,month]=dates(),limits=caps(owner);
    for(const [period,field,globalMax] of [[day,'daily',daily],[month,'monthly',monthly]]){
     if(limits[field]!==null&&count(owner,period)>=limits[field]){db.exec('ROLLBACK');return false;}
    }
    const current=Date.now();
    db.prepare('DELETE FROM external_mail_global WHERE created<=?').run(current-31*86400_000);
    if(db.prepare('SELECT count(*) AS n FROM external_mail_global WHERE created>?').get(current-86400_000).n>=daily||db.prepare('SELECT count(*) AS n FROM external_mail_global').get().n>=monthly){db.exec('ROLLBACK');return false;}
    db.prepare('INSERT INTO external_mail_global VALUES(?)').run(current);
    for(const target of [owner])for(const period of [day,month])db.prepare('INSERT INTO external_mail_usage VALUES(?,?,1) ON CONFLICT(owner,period) DO UPDATE SET count=count+1').run(target,period);
    db.prepare('DELETE FROM external_mail_usage WHERE period<?').run(month);
    db.exec('COMMIT');return true;
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  close(){db.close();},
 };
}
