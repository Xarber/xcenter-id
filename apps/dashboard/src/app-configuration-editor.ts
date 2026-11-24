import {useEffect, useRef, useState} from 'react';

export type ConfigurationReceipt = {configuration: Record<string, unknown>; revision: string};
export type ConfigurationRequest = (body?: object) => Promise<ConfigurationReceipt>;
export type ConfirmConfig = (warnAboutAccess: boolean) => Promise<boolean>;

export function useAppConfiguration(request: ConfigurationRequest, confirm: ConfirmConfig) {
  const [text, setText] = useState('');
  const [receipt, setReceipt] = useState<ConfigurationReceipt>();
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('');
  const active = useRef(true);
  const loading = useRef(request);

  function update(value: ConfigurationReceipt) {
    setReceipt(value);
    setText(JSON.stringify(value.configuration, null, 2));
  }

  useEffect(() => {
    active.current = true;
    let current = true;
    loading.current().then(result => {
      if (current) update(result);
    }).catch(error => {
      if (current) setStatus(error.message);
    }).finally(() => {
      if (current) setBusy(false);
    });
    return () => {current = false;active.current = false;};
  }, []);

  function decode() {
    try {
      const value = JSON.parse(text);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch { /* Parse failure is shown in the editor. */ }
    setStatus('Enter a valid JSON object.');
    return null;
  }

  async function save() {
    if (busy || !receipt) return;
    const configuration = decode();
    if (!configuration) return;
    const before = receipt.configuration;
    const readerTrust = (before.access as {readerTrust?:string} | undefined)?.readerTrust;
    const warnAboutAccess = configuration.access?.readerTrust === 'any' && readerTrust !== 'any'
      || JSON.stringify(configuration.storage) !== JSON.stringify(before.storage);
    setBusy(true);
    setStatus('');
    try {
      if (!await confirm(warnAboutAccess) || !active.current) return;
      const next = await request({configuration,revision:receipt.revision,confirmUnsecure:warnAboutAccess});
      if (active.current) { update(next);setStatus('Configuration saved.'); }
    } catch (error) {
      if (active.current) setStatus(error instanceof Error ? error.message : 'Could not save configuration.');
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return {text,setText,busy,status,ready:!!receipt,save,format:()=>{
    const value=decode();
    if(value){setText(JSON.stringify(value,null,2));setStatus('');}
  }};
}
