import { exportUserData, importUserData, getUserData } from '../core/user-data.js';
import { downloadBlob } from '../exporter/html-exporter.js';

export function exportSync() {
  const data = exportUserData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const ts = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `webby-sync-${ts}.json`);
}

export function readSyncFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return reject(new Error('لم يتم اختيار ملف.'));

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        resolve(data);
      } catch (err) {
        reject(new Error('تعذّر قراءة الملف: ' + err.message));
      }
    });

    document.body.appendChild(input);
    input.click();
  });
}

export async function importSyncFromFile({ merge = true } = {}) {
  const data = await readSyncFile();
  return importUserData(data, { merge });
}

export function getSyncSummary() {
  const data = getUserData();
  return {
    bookmarks: (data.bookmarks || []).length,
    subscriptions: (data.subscriptions || []).length,
    api_keys: Object.keys(data.api_keys || {}).length,
    communities: (data.communities || []).length,
    last_export: data.exported_at || null
  };
}