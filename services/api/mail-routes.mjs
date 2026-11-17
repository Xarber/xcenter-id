import { simpleParser } from 'mailparser';
import { convert } from 'html-to-text';

const inbox = '/account/inbox';
const itemPath = /^\/account\/inbox\/([0-9a-f-]{36})(?:\/(view|attachments\/([0-9]{1,4})))?$/;
const privateHeaders = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };

function json(res, value, status = 200) {
  res.writeHead(status, { ...privateHeaders, 'Content-Type':'application/json' }).end(JSON.stringify(value));
}

function download(res, filename, content) {
  res.writeHead(200, {
    ...privateHeaders,
    'Content-Type':'application/octet-stream',
    'Content-Disposition':'attachment; filename="'+filename+'"',
  }).end(content);
}

export async function handleInbox(req, res, path, accounts, mail) {
  const match = itemPath.exec(path);
  if (!mail || (path !== inbox && !match)) return false;
  const session = accounts.current(req);
  if (!session) { json(res, {error:'Sign in to access your inbox.'},401); return true; }
  try {
    if (req.method === 'DELETE' && match && !match[2]) {
      if (!accounts.allowsMutation(req) || req.headers['x-authnjs-request'] !== 'account-consent') {
        json(res,{error:'Invalid origin.'},403);
      } else {
        mail.remove(session.owner,match[1]);
        json(res,{ok:true});
      }
    } else if (req.method !== 'GET') {
      json(res,{error:'Method not allowed.'},405);
    } else if (!match) {
      json(res,{messages:mail.list(session.owner)});
    } else {
      const message = mail.retrieve(session.owner,match[1]);
      if (!message) json(res,{error:'Email not found.'},404);
      else if (!match[2]) download(res,'message.eml',message);
      else {
        const parsed = await simpleParser(message,{
          skipImageLinks:true, skipTextToHtml:true, skipHtmlToText:true,
        });
        if (match[2] === 'view') {
          json(res,{
            from:(parsed.from?.text ?? '').slice(0,500),
            subject:(parsed.subject ?? '').slice(0,500),
            text:(parsed.text ?? (parsed.html ? convert(parsed.html, {
              wordwrap:false, selectors:[{selector:'img',format:'skip'},{selector:'a',options:{ignoreHref:true}}],
            }) : '')).slice(0,150000),
            attachments:parsed.attachments.map(({filename,size},index)=>({
              index, name:(filename ?? 'Attachment').slice(0,180), size,
            })),
          });
        } else {
          const index = Number(match[3]);
          const attachment = parsed.attachments[index];
          if (!attachment) json(res,{error:'Attachment not found.'},404);
          else download(res,'attachment-'+(index+1),attachment.content);
        }
      }
    }
  } catch {
    if (!res.headersSent) json(res,{error:'This email could not be processed.'},500);
    else res.end();
  }
  return true;
}
