import {createContext, useContext} from 'react';

export type DialogAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => unknown;
};
export type Dialog = {title: string; message?: string; actions: DialogAction[]};
type OpenDialog = (title: string, message: string | undefined, actions: DialogAction[]) => void;
export const DialogContext = createContext<OpenDialog>(() => { throw new Error('Dialog provider unavailable.'); });
export const useDialog = () => useContext(DialogContext);

export function useConfirmDialog() {
  const ask = useDialog();
  return (title: string, label = 'Confirm', message?: string, destructive = true) =>
    new Promise<boolean>(resolve => ask(title, message, [
      {text:'Cancel',style:'cancel',onPress:()=>resolve(false)},
      {text:label,style:destructive?'destructive':'default',onPress:()=>resolve(true)},
    ]));
}
