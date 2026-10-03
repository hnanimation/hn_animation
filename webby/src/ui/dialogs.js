function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showConfirm(message, okLabel = 'تأكيد') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <p>${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="cancel">إلغاء</button>
          <button class="ok danger">${escapeHtml(okLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = (val) => {
      overlay.remove();
      resolve(val);
    };

    overlay.querySelector('.ok').addEventListener('click', () => close(true));
    overlay.querySelector('.cancel').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close(false);
      }
    });
  });
}

export function showPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <p>${escapeHtml(message)}</p>
        <input type="text" value="${escapeHtml(defaultValue)}" />
        <div class="modal-actions">
          <button class="cancel">إلغاء</button>
          <button class="ok">موافق</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('input');
    input.id = 'wb-dialog-input';
    input.name = 'wb-dialog-input';
    input.focus();
    input.select();

    const close = (val) => {
      overlay.remove();
      resolve(val);
    };

    overlay.querySelector('.ok').addEventListener('click', () => close(input.value));
    overlay.querySelector('.cancel').addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value);
      if (e.key === 'Escape') close(null);
    });
  });
}

export function showSelect(message, options) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const opts = options
      .map(
        (opt, i) =>
          `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`
      )
      .join('');

    overlay.innerHTML = `
      <div class="modal">
        <p>${escapeHtml(message)}</p>
        <select>${opts}</select>
        <div class="modal-actions">
          <button class="cancel">إلغاء</button>
          <button class="ok">موافق</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

        const select = overlay.querySelector('select');
    select.id = 'wb-dialog-select';
    select.name = 'wb-dialog-select';
    select.focus();

    const close = (val) => {
      overlay.remove();
      resolve(val);
    };

    overlay.querySelector('.ok').addEventListener('click', () => close(select.value));
    overlay.querySelector('.cancel').addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
  });
}
/* ============ Sync Dialog ============ */

export function showSyncDialog({ summary, onExport, onImport }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const summaryHtml = summary
      ? `
        <div class="sync-summary">
          <div class="sync-stat"><strong>${summary.bookmarks}</strong><span>مواقع محفوظة</span></div>
          <div class="sync-stat"><strong>${summary.subscriptions}</strong><span>اشتراكات</span></div>
          <div class="sync-stat"><strong>${summary.api_keys}</strong><span>مفاتيح API</span></div>
          <div class="sync-stat"><strong>${summary.communities}</strong><span>مجتمعات</span></div>
        </div>
      `
      : '';

    overlay.innerHTML = `
      <div class="modal sync-modal">
        <h2 class="sync-title">مزامنة إعداداتك</h2>
        <p class="sync-hint">انسخ بياناتك إلى ملف، أو استعدها من نسخة سابقة.</p>

        ${summaryHtml}

        <button class="sync-action" id="sync-export">
          <span class="sync-action-icon">📤</span>
          <span class="sync-action-text">
            <strong>تصدير إعداداتي</strong>
            <small>ينزّل ملف webby-sync.json</small>
          </span>
        </button>

        <button class="sync-action" id="sync-import">
          <span class="sync-action-icon">📥</span>
          <span class="sync-action-text">
            <strong>استيراد من ملف</strong>
            <small>اختر ملف webby-sync.json</small>
          </span>
        </button>

        <div class="modal-actions" style="margin-top:16px;">
          <button class="cancel">إغلاق</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      resolve();
    };

    overlay.querySelector('#sync-export').addEventListener('click', async () => {
      try {
        await onExport();
        close();
      } catch (err) {
        console.error(err);
      }
    });

    overlay.querySelector('#sync-import').addEventListener('click', async () => {
      try {
        await onImport();
        close();
      } catch (err) {
        console.error(err);
      }
    });

    overlay.querySelector('.cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close();
      }
    });
  });
}
/* ============ GitLab Deploy Guide ============ */

export function showGitLabGuide({ username, project }) {
  return new Promise((resolve) => {
    const user = String(username || '').trim();
    const proj = String(project || '').trim();

    if (!user || !proj) {
      resolve();
      return;
    }

    const urls = {
      newProject: 'https://gitlab.com/projects/new',
      projectHome: `https://gitlab.com/${user}/${proj}`,
      pagesSettings: `https://gitlab.com/${user}/${proj}/-/deploy/pages`,
      pagesSettingsOld: `https://gitlab.com/${user}/${proj}/-/pages`,
      webIde: `https://gitlab.com/-/ide/project/${user}/${proj}/edit/main/-/`,
      filesTree: `https://gitlab.com/${user}/${proj}/-/tree/main`,
      liveUrl: proj === `${user}.gitlab.io`
        ? `https://${user}.gitlab.io/`
        : `https://${user}.gitlab.io/${proj}/`
    };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal gitlab-guide-modal">
        <button class="gitlab-guide-close" type="button" aria-label="Close">✕</button>
        <h2 class="gitlab-guide-title">📖 دليل النشر على GitLab</h2>
        <p class="gitlab-guide-sub">
          اتبع الخطوات بالترتيب. المسارات جاهزة بمعلوماتك.
        </p>

        <ol class="gitlab-steps">
          <li class="gitlab-step">
            <div class="gitlab-step-head">
              <span class="gitlab-step-num">1</span>
              <strong>أنشئ مشروعًا جديدًا على GitLab</strong>
            </div>
            <a class="gitlab-step-link" href="${urls.newProject}" target="_blank" rel="noopener">
              ${urls.newProject}
            </a>
            <ul class="gitlab-step-notes">
              <li>اختر: <strong>Create blank project</strong></li>
              <li>Project name: <code>${proj}</code></li>
              <li>Visibility: <strong>Private</strong> (لحماية الكود)</li>
              <li>أزل علامة: Initialize repository with a README</li>
              <li>اضغط: <strong>Create project</strong></li>
            </ul>
          </li>

          <li class="gitlab-step">
            <div class="gitlab-step-head">
              <span class="gitlab-step-num">2</span>
              <strong>افتح المشروع</strong>
            </div>
            <a class="gitlab-step-link" href="${urls.projectHome}" target="_blank" rel="noopener">
              ${urls.projectHome}
            </a>
          </li>

          <li class="gitlab-step">
            <div class="gitlab-step-head">
              <span class="gitlab-step-num">3</span>
              <strong>افتح Web IDE</strong>
            </div>
            <a class="gitlab-step-link" href="${urls.webIde}" target="_blank" rel="noopener">
              ${urls.webIde}
            </a>
            <ul class="gitlab-step-notes">
              <li>سيُفتح محرر كود داخل المتصفح</li>
              <li>يعمل على الحاسوب والهاتف</li>
            </ul>
          </li>

          <li class="gitlab-step">
            <div class="gitlab-step-head">
              <span class="gitlab-step-num">4</span>
              <strong>ارفع ملفات موقعك</strong>
            </div>
            <ul class="gitlab-step-notes">
              <li>افك ضغط ملف <code>website.zip</code> الذي صدّرته من Webby</li>
              <li>اسحب <strong>محتويات</strong> المجلد إلى Web IDE</li>
              <li>أو استخدم <strong>Upload file</strong> لكل ملف</li>
              <li><strong>مهم</strong>: ملف <code>.gitlab-ci.yml</code> يُضاف تلقائيًا — احرص أن يكون في جذر المشروع</li>
            </ul>
          </li>

          <li class="gitlab-step">
            <div class="gitlab-step-head">
              <span class="gitlab-step-num">5</span>
              <strong>اعمل Commit</strong>
            </div>
            <ul class="gitlab-step-notes">
              <li>في أسفل Web IDE: اكتب رسالة مثل <code>Initial commit</code></li>
              <li>اضغط: <strong>Commit</strong> (على الفرع <code>main</code>)</li>
            </ul>
          </li>

          <li class="gitlab-step">
            <div class="gitlab-step-head">
              <span class="gitlab-step-num">6</span>
              <strong>راجع حالة النشر</strong>
            </div>
            <a class="gitlab-step-link" href="${urls.pagesSettings}" target="_blank" rel="noopener">
              ${urls.pagesSettings}
            </a>
            <ul class="gitlab-step-notes">
              <li>في الصفحة، ابحث عن حالة Pipeline (يجب أن يكون <strong>Passed</strong>)</li>
              <li>ستجد رابط موقعك بجانب <strong>Access pages</strong></li>
              <li>إذا رأيت واجهة قديمة: انتقل إلى <a href="${urls.pagesSettingsOld}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Settings &gt; Pages</a></li>
              <li>إذا فشل Pipeline، انسخ الخطأ وأرسله لنا</li>
            </ul>
          </li>
        </ol>

        <div class="gitlab-final">
          <div class="gitlab-final-label">🎉 موقعك سيكون على:</div>
          <a class="gitlab-final-url" href="${urls.liveUrl}" target="_blank" rel="noopener">
            ${urls.liveUrl}
          </a>
          <div class="gitlab-final-note">
            ⏱️ أول نشر قد يستغرق 2-5 دقائق. حدّث الصفحة بعدها.
          </div>
        </div>

        <div class="modal-actions" style="margin-top:16px;">
          <button class="cancel">إغلاق</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      resolve();
    };

    overlay.querySelector('.gitlab-guide-close').addEventListener('click', close);
    overlay.querySelector('.cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close();
      }
    });
  });
}