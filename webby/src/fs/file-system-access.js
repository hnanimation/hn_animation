export function isFsAccessSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickFolder() {
  if (!isFsAccessSupported()) {
    throw new Error(
      'متصفحك لا يدعم الوصول المباشر إلى المجلدات. استخدم Chrome أو Edge.'
    );
  }
  return await window.showDirectoryPicker({ mode: 'readwrite' });
}

export async function writeFile(dirHandle, filename, contents) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

export async function readFileText(dirHandle, filename) {
  const fileHandle = await dirHandle.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return await file.text();
}

export async function fileExists(dirHandle, filename) {
  try {
    await dirHandle.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

export async function getOrCreateFolder(dirHandle, name) {
  return await dirHandle.getDirectoryHandle(name, { create: true });
}

export async function getFolder(dirHandle, name) {
  try {
    return await dirHandle.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

export async function listFiles(dirHandle) {
  const out = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind === 'file') out.push(name);
  }
  return out;
}

export async function removeFile(dirHandle, filename) {
  try {
    await dirHandle.removeEntry(filename);
  } catch {
    /* ignore */
  }
}