export async function uploadFileBatch(
  files: readonly { name: string; read: () => Promise<string>; dispose?: () => void }[],
  upload: (name: string, content: string) => Promise<unknown>,
) {
  let uploaded = 0;
  const failed: string[] = [];
  for (const file of files) {
    try {
      await upload(file.name, await file.read());
      uploaded++;
    } catch {
      failed.push(file.name);
    } finally {
      try { file.dispose?.(); } catch { /* Upload outcome is independent of local cache cleanup. */ }
    }
  }
  return failed.length
    ? `Uploaded ${uploaded} of ${files.length}. Could not upload ${failed.join(', ')}.`
    : `Uploaded ${uploaded} ${uploaded === 1 ? 'file' : 'files'}.`;
}
