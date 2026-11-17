import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { openFriends } from './account-friends.mjs';
import { openFriendRecords } from './friend-records.mjs';
import { openStore } from './store.mjs';

test('friend record access follows publisher approval, ownership and the current friendship',()=>{
  const friends=openFriends(':memory:');
  const store=openStore(':memory:',randomBytes(32));
  const publishers=new Map([['maps','Maps']]);
  const records=openFriendRecords({database:':memory:',friends,store,publishers,allowed:()=>true});
  try {
    const value={label:'Fixture',latitude:1,longitude:2};
    const {id}=store.create('owner','maps','saved-place.v1',value);
    assert.equal(friends.accept('reader',friends.invite('owner').code),true);
    const [{id:friend}]=friends.list('owner');
    assert.equal(records.share('reader',{friend,source:'maps',id}),false);
    assert.equal(records.share('owner',{friend,source:'other',id}),false);
    assert.equal(records.share('owner',{friend,source:'maps',id}),true);
    assert.equal(records.list('stranger').incoming.length,0);
    const [entry]=records.list('reader').incoming;
    assert.deepEqual(entry.value,value);
    records.revoke('reader',entry.id);
    assert.equal(records.list('reader').incoming.length,1);
    publishers.delete('maps');
    assert.equal(records.list('reader').incoming.length,0);
    publishers.set('maps','Maps');
    assert.equal(friends.remove('reader',friend),true);
    assert.equal(friends.accept('reader',friends.invite('owner').code),true);
    assert.equal(records.list('reader').incoming.length,0);
    const [{id:next}]=friends.list('owner');
    assert.equal(records.share('owner',{friend:next,source:'maps',id}),true);
    records.revoke('owner',records.list('reader').incoming[0].id);
    assert.equal(records.list('reader').incoming.length,0);
  } finally { records.close();store.close();friends.close(); }
});
