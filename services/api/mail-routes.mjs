import { simpleParser } from 'mailparser';
import { convert } from 'html-to-text';

const inbox = '/account/inbox';
const itemPath = /^\/account\/inbox\/([0-9a-f-]{36})(?:\/(view|attachments\/([0-9]{1,4})))?$/;
const privateHeaders = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
const messageId=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

async function selection(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')) return null;
  const chunks=[];
  let size=0;
  for await (const chunk of req.iterator({destroyOnReturn:false})) {
    size+=chunk.length;
    if(size>4096){req.resume();return null;}
    chunks.push(chunk);
  }
  try {
    const {ids}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return Array.isArray(ids)&&ids.length>0&&ids.length<=100&&
      ids.every(id=>typeof id==='string'&&messageId.test(id))?[...new Set(ids)]:null;
  } catch { return null; }
}

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

export function handleMailAliases(req,res,path,accounts,mail) {
  if (!mail || !path.startsWith('/account/mail/aliases')) return false;
  const session = accounts.current(req);
  if (!session) { json(res,{error:'Sign in to manage your private addresses.'},401); return true; }
  if (req.method==='GET' && path==='/account/mail/aliases') {
    json(res,{aliases:mail.aliases(session.owner)});
    return true;
  }
  const address=/^\/account\/mail\/aliases\/([a-z0-9.-]+@(?:hme\.|mail\.)xcenter\.it)$/.exec(path)?.[1];
  if (!address || req.method!=='DELETE') json(res,{error:'Method not allowed.'},405);
  else if (!accounts.allowsMutation(req) || req.headers['x-authnjs-request']!=='account-consent') {
    json(res,{error:'Invalid origin.'},403);
  } else {
    mail.revokeAlias(session.owner,address);
    json(res,{ok:true});
  }
  return true;
}

export async function handleInbox(req, res, path, accounts, mail) {
  const match = itemPath.exec(path);
  if (!mail || (path !== inbox && !match)) return false;
  const session = accounts.current(req);
  if (!session) { json(res, {error:'Sign in to access your inbox.'},401); return true; }
  try {
    if (req.method === 'DELETE' && path === inbox) {
      const canDelete=()=>accounts.allowsMutation(req)&&req.headers['x-authnjs-request']==='account-consent';
      if (!canDelete()) json(res,{error:'Invalid origin.'},403);
      else {
        const ids=await selection(req);
        if (!ids) json(res,{error:'Select up to 100 messages.'},422);
        else if (accounts.current(req)?.owner!==session.owner || !canDelete()) json(res,{error:'Sign in again to continue.'},403);
        else json(res,{deleted:mail.removeMany(session.owner,ids)});
      }
    } else if (req.method === 'DELETE' && match && !match[2]) {
      if (!accounts.allowsMutation(req) || req.headers['x-authnjs-request'] !== 'account-consent') {
        json(res,{error:'Invalid origin.'},403);
      } else {
        mail.remove(session.owner,match[1]);
        json(res,{ok:true});
      }
    } else if (req.method !== 'GET') {
      json(res,{error:'Method not allowed.'},405);
    } else if (!match) {
      const cursors = new URL(req.url,'http://localhost').searchParams.getAll('cursor');
      const cursor = cursors.length ? /^(\d{1,15}):([0-9a-f-]{36})$/.exec(cursors[0]) : null;
      if (cursors.length > 1 || (cursors.length && !cursor)) {
        json(res,{error:'Invalid inbox page.'},400);
      } else {
        json(res,mail.page(session.owner,cursor ? {received:Number(cursor[1]),id:cursor[2]} : null));
      }
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
            badges:mail.trust?.(session.owner,match[1])??{verified:false,admin:false},
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
