const entities = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
const escape = text => text.replace(/[&<>"']/g, character=>entities[character]);
const maxAttachmentBytes = 256*1024;

export function composeContent(text, input) {
  const html = input.formatted === true ? escape(text)
    .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g,'<em>$1</em>')
    .replace(/\r?\n/g,'<br>') : undefined;
  if (input.attachment === undefined) return {text,html};
  const {name,content} = input.attachment ?? {};
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || /[\\/\p{Cc}\p{Cf}]/u.test(name) ||
      typeof content !== 'string' || content.length > Math.ceil(maxAttachmentBytes/3)*4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) return null;
  const bytes = Buffer.from(content,'base64');
  if (!bytes.length || bytes.length > maxAttachmentBytes || bytes.toString('base64') !== content) return null;
  return {text,html,attachments:[{filename:name,content:bytes,contentType:'application/octet-stream'}]};
}
