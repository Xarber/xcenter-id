import {test} from 'node:test';import assert from 'node:assert/strict';import {formatStorage} from './storage-size.mjs';
test('storage scales from bytes through TB and survives missing native Intl constructors',()=>{
 for(const [value,expected] of [[0,'0 B'],[1024,'1 KB'],[1024**2,'1 MB'],[1024**3,'1 GB'],[2*1024**4,'2 TB']])assert.equal(formatStorage(value,'en'),expected);
 assert.equal(formatStorage(NaN),'Unavailable');assert.equal(formatStorage(-1),'Unavailable');
 const original=Intl.NumberFormat;try{Intl.NumberFormat=undefined;assert.equal(formatStorage(1.5*1024**3),'1.5 GB');}finally{Intl.NumberFormat=original;}
});
