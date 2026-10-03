import { getAllMedia, getAssetFilename } from './media.js';

export function serializeProject(project) {
  return {
    schemaVersion: project.schemaVersion || 1,
    webbyVersion: '0.1.0',
    meta: project.meta,
    template: project.template,
    sections: project.sections,
    mediaIndex: getAllMedia().map((m) => ({
      id: m.id,
      name: m.name,
      ext: m.ext,
      type: m.type,
      size: m.size,
      filename: getAssetFilename(m.id)
    }))
  };
}

/* =========================================================
   Migration — إضافة الحقول الجديدة للمشاريع القديمة
   ========================================================= */

function ensureString(obj, key, defaultValue = '') {
  if (typeof obj[key] !== 'string') obj[key] = defaultValue;
}

function ensureArray(obj, key) {
  if (!Array.isArray(obj[key])) obj[key] = [];
}

function ensureBool(obj, key, defaultValue = false) {
  if (typeof obj[key] !== 'boolean') obj[key] = defaultValue;
}

function ensureNumber(obj, key, defaultValue = 0) {
  if (typeof obj[key] !== 'number' || isNaN(obj[key])) obj[key] = defaultValue;
}

function migrateMeta(meta) {
  if (!meta || typeof meta !== 'object') meta = {};

  ensureString(meta, 'name', 'مشروع');
  ensureString(meta, 'username', meta.name || 'مشروع');
  ensureString(meta, 'description', '');
  ensureString(meta, 'link', '');
  ensureString(meta, 'logo', '');
  ensureString(meta, 'banner', '');
  ensureString(meta, 'language', 'ar');
  ensureString(meta, 'direction', 'rtl');

  ensureArray(meta, 'admins');

  // المديرون: تأكد من حقولهم
  meta.admins.forEach((admin) => {
    if (!admin.id) {
      admin.id = 'admin_' + Math.random().toString(36).slice(2, 10);
    }
    ensureString(admin, 'name', '');
    ensureString(admin, 'image', '');
  });

  // Network
  if (!meta.network || typeof meta.network !== 'object') {
    meta.network = { enabled: false };
  } else {
    ensureBool(meta.network, 'enabled', false);
  }

  // GitLab
  if (!meta.gitlab || typeof meta.gitlab !== 'object') {
    meta.gitlab = { username: '', project: '' };
  } else {
    ensureString(meta.gitlab, 'username', '');
    ensureString(meta.gitlab, 'project', '');
  }

  return meta;
}

function migrateSection(section) {
  if (!section || typeof section !== 'object') return;

  ensureString(section, 'type', 'custom');
  ensureNumber(section, 'order', 0);
  ensureBool(section, 'visible', true);

  if (!section.id) {
    section.id = `${section.type}-${section.order}`;
  }

  if (!section.content || typeof section.content !== 'object') {
    section.content = {};
  }

  ensureString(section.content, 'title', section.title || section.type);
  if (!section.title) section.title = section.content.title;

  // العناصر
  const items = section.content.items;
  if (Array.isArray(items)) {
    items.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      ensureString(item, 'title', '');
      ensureString(item, 'description', '');
      ensureString(item, 'image', '');
      ensureString(item, 'date', '');
      ensureString(item, 'authorId', '');
      ensureArray(item, 'tags');
    });
  }
}

function migrateProject(project) {
  // meta
  project.meta = migrateMeta(project.meta);

  // template
  ensureString(project, 'template', 'minimal');

  // schemaVersion
  if (typeof project.schemaVersion !== 'number') {
    project.schemaVersion = 1;
  }

  // webbyVersion
  ensureString(project, 'webbyVersion', '0.1.0');

  // sections
  if (!Array.isArray(project.sections)) project.sections = [];
  project.sections.forEach(migrateSection);

  return project;
}

/* =========================================================
   Deserialize
   ========================================================= */

export function deserializeProject(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('ملف المشروع غير صالح.');
  }
  if (!data.schemaVersion) {
    throw new Error('ملف المشروع لا يحتوي على schemaVersion.');
  }
  if (data.schemaVersion > 1) {
    throw new Error(
      `إصدار المشروع (${data.schemaVersion}) غير مدعوم في هذه النسخة من Webby.`
    );
  }

  const project = {
    schemaVersion: data.schemaVersion,
    webbyVersion: data.webbyVersion || '0.1.0',
    meta: data.meta || {},
    template: data.template || 'minimal',
    sections: Array.isArray(data.sections) ? data.sections : [],
    _mediaIndex: Array.isArray(data.mediaIndex) ? data.mediaIndex : []
  };

  // ترقية الحقول الناقصة
  const migrated = migrateProject(project);

  return migrated;
}