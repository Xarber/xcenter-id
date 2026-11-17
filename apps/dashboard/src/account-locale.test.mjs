import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountMessage } from './account-locale.ts';

test('uses regional language catalogs and falls back to English', () => {
  assert.equal(accountMessage('birthday','Birthday','it-IT'),'Data di nascita');
  assert.equal(accountMessage('mail','Mail','pt-BR'),'E-mail');
  assert.equal(accountMessage('files','Files','ja-JP'),'Files');
  assert.equal(accountMessage('untranslated','Fallback','fr-FR'),'Fallback');
});
