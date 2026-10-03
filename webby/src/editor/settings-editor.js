import { showSyncDialog, showConfirm } from '../ui/dialogs.js';
import { exportSync, importSyncFromFile, getSyncSummary } from '../fs/sync.js';
import { TEMPLATES } from '../core/templates.js';
import { getAllMedia, getMedia } from '../core/media.js';
import { showGitLabGuide } from '../ui/dialogs.js';

let settingsCounter = 0;
function nextSettingsId() {
  return `wb-settings-${++settingsCounter}`;
}

function newAdminId() {
  return 'admin_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function renderSettingsEditor(container, project, onChange) {
  container.innerHTML = '';
  const meta = project.meta;

  container.appendChild(
    makeField('اسم الموقع', 'text', meta.name, (val) => {
      meta.name = val;
      onChange({ preview: true });
    })
  );

  container.appendChild(
    makeField('اسم المستخدم (يظهر في البطاقات)', 'text', meta.username || '', (val) => {
      meta.username = val;
      onChange({ preview: true });
    })
  );

  container.appendChild(
    makeTextarea('وصف الموقع', meta.description || '', (val) => {
      meta.description = val;
      onChange({ preview: true });
    })
  );

  container.appendChild(
    makeField('رابط الموقع (URL) — للـ SEO', 'text', meta.link || '', (val) => {
      meta.link = val;
      onChange({ preview: true });
    })
  );

  container.appendChild(
    makeMediaSelect('اللوكو', meta.logo || '', (val) => {
      meta.logo = val;
      onChange({ preview: true });
    })
  );

  container.appendChild(
    makeMediaSelect('البانر', meta.banner || '', (val) => {
      meta.banner = val;
      onChange({ preview: true });
    })
  );

  container.appendChild(
    makeSelect(
      'اللغة',
      meta.language || 'ar',
      [
        { value: 'ar', label: 'العربية' },
        { value: 'en', label: 'English' },
        { value: 'fr', label: 'Français' },
        { value: 'es', label: 'Español' }
      ],
      (val) => {
        meta.language = val;
        onChange({ preview: true });
      }
    )
  );

  container.appendChild(
    makeSelect(
      'اتجاه النص',
      meta.direction || 'rtl',
      [
        { value: 'rtl', label: 'من اليمين لليسار (RTL)' },
        { value: 'ltr', label: 'من اليسار لليمين (LTR)' }
      ],
      (val) => {
        meta.direction = val;
        onChange({ preview: true });
      }
    )
  );

  const templateOptions = Object.values(TEMPLATES).map((t) => ({
    value: t.id,
    label: t.name
  }));

  container.appendChild(
    makeSelect('القالب', project.template, templateOptions, (val) => {
      project.template = val;
      onChange({ preview: true });
    })
  );

  /* ============ GitLab ============ */
  container.appendChild(makeGitLabSection(meta, project, onChange));

  /* ============ المديرون ============ */
  container.appendChild(makeAdminsSection(meta, onChange));

  container.appendChild(makeSyncSection(onChange));
}

/* ============ Admins UI ============ */

function makeAdminsSection(meta, onChange) {
  if (!Array.isArray(meta.admins)) meta.admins = [];

  const wrap = document.createElement('div');
  wrap.className = 'admins-section';

  const title = document.createElement('h3');
  title.textContent = 'المديرون';
  wrap.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'admins-hint';
  hint.textContent =
    'أضف أسماء المدراء وصورهم. ستظهر هذه الأسماء في قائمة عند تحرير كل بطاقة.';
  wrap.appendChild(hint);

  const list = document.createElement('div');
  list.className = 'admins-list';

  function rebuild() {
    list.innerHTML = '';

    if (meta.admins.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'admins-empty';
      empty.textContent = 'لا يوجد مديرون بعد.';
      list.appendChild(empty);
      return;
    }

    meta.admins.forEach((admin, index) => {
      const box = document.createElement('div');
      box.className = 'admin-box';

      const header = document.createElement('div');
      header.className = 'admin-header';

      const label = document.createElement('span');
      label.textContent = `مدير ${index + 1}`;
      header.appendChild(label);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'حذف';
      removeBtn.className = 'danger';
      removeBtn.addEventListener('click', () => {
        meta.admins.splice(index, 1);
        rebuild();
        onChange({ preview: true });
      });
      header.appendChild(removeBtn);

      box.appendChild(header);

      const nameWrap = document.createElement('label');
      nameWrap.className = 'field';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = 'الاسم';
      nameWrap.appendChild(nameSpan);
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.id = nextSettingsId();
      nameInput.name = nameInput.id;
      nameInput.placeholder = 'مثال: hassan';
      nameInput.value = admin.name || '';
      nameInput.addEventListener('input', () => {
        admin.name = nameInput.value;
        onChange({ preview: true });
      });
      nameWrap.appendChild(nameInput);
      box.appendChild(nameWrap);

      box.appendChild(
        makeMediaSelect('الصورة', admin.image || '', (val) => {
          admin.image = val;
          onChange({ preview: true });
        })
      );

      list.appendChild(box);
    });
  }

  rebuild();
  wrap.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ إضافة مدير';
  addBtn.className = 'add-section';
  addBtn.addEventListener('click', () => {
    meta.admins.push({ id: newAdminId(), name: '', image: '' });
    rebuild();
    onChange({ preview: true });
  });
  wrap.appendChild(addBtn);

  return wrap;
}

/* ============ Helpers ============ */

function makeField(label, type, value, onInput) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.id = nextSettingsId();
  input.name = input.id;
  input.value = value || '';
  input.addEventListener('input', () => onInput(input.value));
  wrap.appendChild(span);
  wrap.appendChild(input);
  return wrap;
}

function makeTextarea(label, value, onInput) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const area = document.createElement('textarea');
  area.id = nextSettingsId();
  area.name = area.id;
  area.rows = 3;
  area.value = value || '';
  area.addEventListener('input', () => onInput(area.value));
  wrap.appendChild(span);
  wrap.appendChild(area);
  return wrap;
}

function makeSelect(label, value, options, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const select = document.createElement('select');
  select.id = nextSettingsId();
  select.name = select.id;
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener('change', () => onChange(select.value));
  wrap.appendChild(span);
  wrap.appendChild(select);
  return wrap;
}

function makeMediaSelect(label, value, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'field';

  const span = document.createElement('span');
  span.textContent = label;

  const select = document.createElement('select');
  select.id = nextSettingsId();
  select.name = select.id;

  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— بدون —';
  select.appendChild(none);

  getAllMedia().forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    select.appendChild(opt);
  });
  select.value = value || '';

  const preview = document.createElement('div');
  preview.className = 'settings-media-preview-wrap';

  function updatePreview() {
    preview.innerHTML = '';
    if (!select.value) return;
    const m = getMedia(select.value);
    if (!m) return;
    const img = document.createElement('img');
    img.src = m.url;
    img.className = 'settings-media-preview';
    preview.appendChild(img);
  }

  select.addEventListener('change', () => {
    onChange(select.value || '');
    updatePreview();
  });

  wrap.appendChild(span);
  wrap.appendChild(select);
  wrap.appendChild(preview);
  updatePreview();
  return wrap;
}
function makeSyncSection(onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'sync-section';

  const title = document.createElement('h3');
  title.textContent = 'المزامنة والنسخ الاحتياطي';
  wrap.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'sync-section-hint';
  hint.textContent =
    'انسخ إعداداتك (المواقع المحفوظة، الاشتراكات، المفاتيح) إلى ملف، أو استعدها على أي جهاز آخر.';
  wrap.appendChild(hint);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sync-open-btn';
  btn.innerHTML = '<span>🔄</span> Sync';
  btn.addEventListener('click', async () => {
    const summary = getSyncSummary();

    await showSyncDialog({
      summary,
      onExport: async () => {
        exportSync();
        await showConfirm('تم تصدير الإعدادات إلى ملف.', 'حسنًا');
      },
      onImport: async () => {
        try {
          const result = await importSyncFromFile({ merge: true });
          await showConfirm(
            `تم الاستيراد: ${result.bookmarks.length} مواقع، ${result.subscriptions.length} اشتراكات.`,
            'حسنًا'
          );
          if (onChange) onChange();
        } catch (err) {
          await showConfirm('فشل الاستيراد: ' + err.message, 'حسنًا');
        }
      }
    });
  });
  wrap.appendChild(btn);

  return wrap;
}
function makeGitLabSection(meta, project, onChange) {
  if (!meta.gitlab || typeof meta.gitlab !== 'object') {
    meta.gitlab = { username: '', project: '' };
  }

  const wrap = document.createElement('div');
  wrap.className = 'gitlab-section';

  const title = document.createElement('h3');
  title.textContent = 'النشر على GitLab Pages';
  wrap.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'gitlab-hint';
  hint.textContent =
    'GitLab Pages يتيح لك نشر موقعك مع مستودع خاص (الكود محمي، الموقع عام). أدخل بياناتك لتحصل على دليل نشر بمسارات حقيقية.';
  wrap.appendChild(hint);

  // Username
  const userWrap = document.createElement('label');
  userWrap.className = 'field';
  const userSpan = document.createElement('span');
  userSpan.textContent = 'اسم المستخدم على GitLab';
  userWrap.appendChild(userSpan);
  const userInput = document.createElement('input');
  userInput.type = 'text';
  userInput.id = 'gitlab-username';
  userInput.name = 'gitlab-username';
  userInput.placeholder = 'مثال: hn_animation';
  userInput.value = meta.gitlab.username || '';
  userInput.addEventListener('input', () => {
    meta.gitlab.username = userInput.value.trim();
  });
  userWrap.appendChild(userInput);
  wrap.appendChild(userWrap);

  // Project name
  const projWrap = document.createElement('label');
  projWrap.className = 'field';
  const projSpan = document.createElement('span');
  projSpan.textContent = 'اسم المشروع على GitLab';
  projWrap.appendChild(projSpan);
  const projInput = document.createElement('input');
  projInput.type = 'text';
  projInput.id = 'gitlab-project';
  projInput.name = 'gitlab-project';
  projInput.placeholder = 'مثال: hn_animation-site';
  projInput.value = meta.gitlab.project || '';
  projInput.addEventListener('input', () => {
    meta.gitlab.project = projInput.value.trim();
  });
  projWrap.appendChild(projInput);
  wrap.appendChild(projWrap);

  // Button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gitlab-guide-btn';
  btn.innerHTML = '<span>📖</span> افتح دليل النشر';
  btn.addEventListener('click', () => {
    const username = meta.gitlab.username.trim();
    const projectName = meta.gitlab.project.trim();

    if (!username || !projectName) {
      showConfirm(
        'املأ اسم المستخدم واسم المشروع أولًا.',
        'حسنًا'
      );
      return;
    }

    showGitLabGuide({ username, project: projectName });
  });
  wrap.appendChild(btn);

  return wrap;
}