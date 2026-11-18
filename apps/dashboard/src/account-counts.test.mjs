import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountCount} from './account-counts.mjs';

test('formats account counts without unsupported Hermes constructors',()=>{
  const plural=Object.getOwnPropertyDescriptor(Intl,'PluralRules');
  const number=Object.getOwnPropertyDescriptor(Intl,'NumberFormat');
  try {
    Object.defineProperty(Intl,'PluralRules',{value:undefined,configurable:true});
    Object.defineProperty(Intl,'NumberFormat',{value:undefined,configurable:true});
    assert.deepEqual(accountCount(2,'it-IT'),{suffix:'Other',formatted:'2'});
    assert.equal(accountCount(1,'it-IT').suffix,'One');
    assert.equal(accountCount(0,'fr-FR').suffix,'One');
  } finally {
    if(plural)Object.defineProperty(Intl,'PluralRules',plural);
    if(number)Object.defineProperty(Intl,'NumberFormat',number);
  }
});
