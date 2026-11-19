import nodemailer from 'nodemailer';

const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
})[character]);
const messageStream = nodemailer.createTransport({
  streamTransport:true, buffer:true, disableFileAccess:true, disableUrlAccess:true,
});

export function accountMessage({title, paragraphs, code, action, footer='X-Center ID · Account services'}) {
  let target;
  if(action){
    target=new URL(action.url);
    if(target.protocol!=='https:'||target.username||target.password)throw new Error('Invalid account message link');
  }
  const description=paragraphs.map(paragraph=>`<p style="margin:0 0 16px;color:#384869;font-size:16px;line-height:1.55">${escape(paragraph).replace(/\r?\n/g,'<br>')}</p>`).join('');
  const codeBlock=code?`<div style="margin:20px 0;padding:14px;border-radius:10px;background:#edf2ff;color:#214fbe;font-size:30px;letter-spacing:.17em;font-weight:bold;text-align:center">${escape(code)}</div>`:'';
  const button=target?`<p style="margin:24px 0 0"><a href="${escape(target.href)}" style="display:inline-block;background:#214fbe;color:#ffffff;border-radius:10px;padding:12px 18px;font-weight:bold;text-decoration:none">${escape(action.label)}</a></p>`:'';
  return {
    text:[title,...paragraphs,code,action&&action.label+'\n'+target.href,footer].filter(Boolean).join('\n\n'),
    html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;background:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fc"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #dbe3ef;border-radius:16px">
<tr><td style="padding:24px 24px 8px;color:#214fbe;font-size:15px;font-weight:bold">X-Center ID</td></tr>
<tr><td style="padding:4px 24px 24px"><h1 style="margin:0 0 16px;color:#17223a;font-size:24px;line-height:1.2">${escape(title)}</h1>${description}${codeBlock}${button}</td></tr></table>
<p style="margin:16px 0 0;color:#526078;font-size:13px">${escape(footer)}</p></td></tr></table></body></html>`,
  };
}

export async function localAccountMessage({from,to,subject,text,...content}) {
  const {message}=await messageStream.sendMail({
    from,to,subject,...accountMessage({title:subject,...content}),...(text===undefined?{}:{text}),headers:{'Auto-Submitted':'auto-generated'},
  });
  return message;
}
