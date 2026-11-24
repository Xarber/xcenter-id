import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {CircleAlert, ShieldCheck} from 'lucide-react';
import {DialogContext, type Dialog, type DialogAction} from './dialog-model';

export default function DialogProvider({children}: {children: ReactNode}) {
  const [request, setRequest] = useState<Dialog | null>(null);
  const next = useRef<Dialog | null>(null);
  const element = useRef<HTMLDialogElement>(null);
  const titleId = useId(), descriptionId = useId();

  useEffect(() => {
    const dialog = element.current;
    if (request && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [request]);

  function dismiss(action?: DialogAction) {
    if (!request) return;
    element.current?.close();
    next.current = null;
    setRequest(null);
    (action ?? request.actions.find(item => item.style === 'cancel'))?.onPress?.();
  }

  return <DialogContext.Provider value={(title,message,actions) => {
    if (next.current) { actions.find(item => item.style === 'cancel')?.onPress?.(); return; }
    const dialog = {title,message,actions};
    next.current = dialog;
    setRequest(dialog);
  }}>
    {children}
    {request && <dialog ref={element} className="xc-intro xc-action-dialog" aria-labelledby={titleId}
      aria-describedby={request.message ? descriptionId : undefined}
      onCancel={event => {event.preventDefault();dismiss();}}>
      <div className="xc-symbol xc-lavender">{request.actions.some(action=>action.style==='destructive')
        ? <CircleAlert size={21} aria-hidden="true"/> : <ShieldCheck size={21} aria-hidden="true"/>}</div>
      <h2 id={titleId}>{request.title}</h2>
      {request.message && <p id={descriptionId}>{request.message}</p>}
      <div className="xc-actions">
        {request.actions.map(action => <button type="button" key={action.text} autoFocus={action.style==='cancel'}
          className={'xc-button '+(action.style==='cancel'?'xc-secondary':action.style==='destructive'?'xc-danger':'xc-primary')}
          onClick={()=>dismiss(action)}>{action.text}</button>)}
      </div>
    </dialog>}
  </DialogContext.Provider>;
}
