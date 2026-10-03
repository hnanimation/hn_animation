import { serializeProject, deserializeProject } from '../core/project-serializer.js';
import {
  getAllMedia,
  getMedia,
  addMediaWithId,
  clearAllMedia
} from '../core/media.js';
import { downloadBlob } from '../exporter/html-exporter.js';
import {
  writeFile,
  readFileText,
  fileExists,
  getOrCreateFolder,
  getFolder,
  listFiles,
  removeFile
} from './file-system-access.js';

const PROJECT_FILE = 'webby-project.json';
const MEDIA_FOLDER = 'media';

function safeFileName(name) {
  return (
    String(name)
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .slice(0, 40) || 'project'
  );
}

/* ============ الحفظ ============ */

export async function saveProjectAsBundle(project) {
  if (!window.JSZip) throw new Error('JSZip غير محمّل.');

  const zip = new window.JSZip();
  const data = serializeProject(project);
  zip.file(PROJECT_FILE, JSON.stringify(data, null, 2));

  const mediaFolder = zip.folder(MEDIA_FOLDER);
  getAllMedia().forEach((m) => {
    const entry = data.mediaIndex.find((x) => x.id === m.id);
    const filename = entry?.filename;
    if (filename) mediaFolder.file(filename, m.blob);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName = safeFileName(project.meta?.name || 'project');
  downloadBlob(blob, `${safeName}.webby`);
}

export function saveProjectAsJson(project) {
  const data = serializeProject(project);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const safeName = safeFileName(project.meta?.name || 'project');
  downloadBlob(blob, `${safeName}.json`);
}

/* ============ الفتح ============ */

export async function openProjectFromFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.webby') || name.endsWith('.zip')) {
    return openProjectFromBundle(file);
  }
  if (name.endsWith('.json')) {
    return openProjectFromJson(file);
  }
  throw new Error('صيغة غير مدعومة. اختر ملف .webby أو .json');
}

async function openProjectFromBundle(file) {
  const zip = await window.JSZip.loadAsync(file);

  let projectFile = null;
  let projectPath = null;
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const name = relativePath.split('/').pop();
    if (name === PROJECT_FILE && !projectFile) {
      projectFile = entry;
      projectPath = relativePath;
    }
  });

  if (!projectFile) {
    throw new Error(`لم يتم العثور على ${PROJECT_FILE} داخل الحزمة.`);
  }

  console.log('[Webby] found project file at:', projectPath);

  const jsonText = await projectFile.async('text');
  const data = JSON.parse(jsonText);
  const project = deserializeProject(data);

  clearAllMedia();

  const mediaIndex = Array.isArray(project._mediaIndex)
    ? project._mediaIndex
    : [];

  const byFilename = new Map();
  mediaIndex.forEach((entry) => {
    if (entry?.filename) byFilename.set(entry.filename, entry);
  });

  const found = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const name = relativePath.split('/').pop();
    const index = byFilename.get(name);
    if (index) found.push({ entry, index });
  });

  console.log('[Webby] media files found:', found.length);

  // ضغط الوسائط القديمة عند التحميل
  let compressedCount = 0;
  for (const { entry, index } of found) {
    try {
      const blob = await entry.async('blob');
      const typedBlob = new Blob([blob], {
        type: index.type || 'application/octet-stream'
      });
      await addMediaWithId(index.id, typedBlob, {
        name: index.name,
        ext: index.ext,
        type: index.type
      });

      const m = getMedia(index.id);
      if (m?.wasCompressed) compressedCount++;
    } catch (err) {
      console.warn('[Webby] failed to load media:', index, err);
    }
  }

  if (compressedCount > 0) {
    console.log(
      `[Webby] compressed ${compressedCount} old media (will be saved on next Save)`
    );
  }

  delete project._mediaIndex;
  return project;
}

async function openProjectFromJson(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const project = deserializeProject(data);
  clearAllMedia();
  delete project._mediaIndex;
  return project;
}

/* ============ الحفظ والفتح من مجلد ============ */

export async function saveProjectToFolder(project, dirHandle) {
  const data = serializeProject(project);
  await writeFile(dirHandle, PROJECT_FILE, JSON.stringify(data, null, 2));

  const mediaDir = await getOrCreateFolder(dirHandle, MEDIA_FOLDER);

  const oldFiles = await listFiles(mediaDir);
  for (const name of oldFiles) {
    if (/^asset_.+\.\w+$/i.test(name)) {
      await removeFile(mediaDir, name);
    }
  }

  for (const m of getAllMedia()) {
    const entry = data.mediaIndex.find((x) => x.id === m.id);
    if (!entry || !entry.filename) continue;
    await writeFile(mediaDir, entry.filename, m.blob);
  }

  return true;
}

async function findProjectDir(dirHandle, depth = 1) {
  if (await fileExists(dirHandle, PROJECT_FILE)) return dirHandle;
  if (depth <= 0) return null;

  for await (const [, entry] of dirHandle.entries()) {
    if (entry.kind !== 'directory') continue;
    const found = await findProjectDir(entry, depth - 1);
    if (found) return found;
  }
  return null;
}

export async function openProjectFromFolder(dirHandle) {
  const projectDir = await findProjectDir(dirHandle, 1);
  if (!projectDir) {
    throw new Error(
      `هذا المجلد لا يحتوي على ${PROJECT_FILE}. اختر مجلد مشروع Webby.`
    );
  }

  const text = await readFileText(projectDir, PROJECT_FILE);
  const data = JSON.parse(text);
  const project = deserializeProject(data);

  clearAllMedia();

  let mediaDir = await getFolder(projectDir, MEDIA_FOLDER);
  if (!mediaDir) mediaDir = await getFolder(projectDir, 'assets');

  const mediaIndex = Array.isArray(project._mediaIndex)
    ? project._mediaIndex
    : [];

  if (mediaDir) {
    const files = await listFiles(mediaDir);
    let compressedCount = 0;

    for (const name of files) {
      const index = mediaIndex.find((m) => m.filename === name);
      if (!index) continue;
      try {
        const fileHandle = await mediaDir.getFileHandle(name);
        const f = await fileHandle.getFile();
        const buffer = await f.arrayBuffer();
        const typedBlob = new Blob([buffer], {
          type: index.type || 'application/octet-stream'
        });
        await addMediaWithId(index.id, typedBlob, {
          name: index.name,
          ext: index.ext,
          type: index.type
        });

        const m = getMedia(index.id);
        if (m?.wasCompressed) compressedCount++;
      } catch (err) {
        console.warn('[Webby] failed to load media:', name, err);
      }
    }

    if (compressedCount > 0) {
      console.log(
        `[Webby] compressed ${compressedCount} old media (will be saved on next Save)`
      );
    }
  }

  delete project._mediaIndex;
  return project;
}