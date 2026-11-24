import {useCallback,useEffect,useRef,useState} from 'react';

export const developerModeKey='xcenter.developerMode';

export function useDeveloperPanel(){
  const [revealed,setRevealed]=useState(false);
  const [open,setOpen]=useState(false);
  const taps=useRef({time:0,count:0});
  const timeout=useRef<ReturnType<typeof setTimeout>|null>(null);

  const hide=useCallback(()=>{
    if(timeout.current)clearTimeout(timeout.current);
    timeout.current=null;
    taps.current={time:0,count:0};
    setRevealed(false);
    setOpen(false);
  },[]);
  const refresh=useCallback(()=>{
    if(timeout.current)clearTimeout(timeout.current);
    timeout.current=setTimeout(hide,30_000);
  },[hide]);

  useEffect(()=>()=>{if(timeout.current)clearTimeout(timeout.current);},[]);

  return {revealed,open,hide,refresh,
    tap(){
      const time=Date.now();
      const count=time-taps.current.time<1_200?taps.current.count+1:1;
      taps.current={time,count};
      if(count>=3){
        taps.current.count=0;
        setRevealed(true);
        refresh();
      }
    },
    show(){setOpen(true);refresh();},
  };
}
