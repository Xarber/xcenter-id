export function formatStorage(bytes,locale){
 if(!Number.isFinite(bytes)||bytes<0)return 'Unavailable';
 const units=['B','KB','MB','GB','TB'];const power=bytes?Math.min(4,Math.floor(Math.log(bytes)/Math.log(1024))):0;
 const value=bytes/1024**power;let display=power?value.toFixed(1).replace(/\.0$/,''):String(value);
 try{if(typeof Intl?.NumberFormat==='function')display=new Intl.NumberFormat(locale,{maximumFractionDigits:power?1:0}).format(value);}catch{}
 return display+' '+units[power];
}
