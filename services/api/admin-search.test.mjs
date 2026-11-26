import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminSearch } from './admin-search.mjs';

test('only a confirmed administrator can search and page grouped results',async()=>{
  const users=Array.from({length:25},(_,index)=>({id:String(index),title:'Fixture'}));
  let status=403;
  let searched=0;
  const search=createAdminSearch({
    accounts:{
      adminStatus:(req,write)=>write&&!req.headers.origin?403:status,
      current:()=>({hash:'synthetic-session'}),
      searchAdminUsers:query=>{assert.equal(query,'fixture');searched++;return users;},
      searchAdminUsernameChanges:()=>[],
    },
    registry:{searchAdminApps:()=>[],searchAdminDevelopers:()=>[]},
    mail:{searchSupport:()=>[{id:'ticket',title:'Fixture'}]},
    volumes:()=>[],
  });
  async function get(query){
    let result;
    const res={writeHead(code){return {end(body){result={code,body:JSON.parse(body)};}};}};
    await search({method:'GET',headers:{}},res,new URL('https://example.test/admin-search?'+query));
    return result;
  }
  assert.equal((await get('q=fixture')).code,403);
  assert.equal(searched,0);
  status=200;
  assert.equal((await get('q=fixture&size=0')).code,422);
  const {body:{groups}}=await get('q=%20Fixture%20&size=10');
  assert.equal(groups.users.total,25);
  assert.equal(groups.users.items.length,10);
  assert.equal(groups.support.items[0].id,'ticket');
  const {body:{groups:next}}=await get('q=fixture&size=10&section=users&page=99');
  assert.deepEqual(Object.keys(next),['users']);
  assert.equal(next.users.page,3);
  assert.deepEqual(next.users.items.map(item=>item.id),['20','21','22','23','24']);
});
