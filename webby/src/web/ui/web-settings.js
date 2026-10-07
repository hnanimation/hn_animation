import { getUserData, updateUserData } from '../../core/user-data.js';

let modalEl = null;

export function openWebSettings() {
  buildModal();
  fillValues();
  if (typeof modalEl.showModal === 'function') modalEl.showModal();
  else modalEl.setAttribute('open', '');
}

export function closeWebSettings() {
  if (!modalEl) return;
  if (typeof modalEl.close === 'function') modalEl.close();
  else modalEl.removeAttribute('open');
}

function buildModal() {
  if (modalEl) return;

  modalEl = document.createElement('dialog');
  modalEl.className = 'web-settings-modal';
  modalEl.innerHTML = `
    <div class="ws-header">
      <h3 class="ws-title">إعدادات المصادر</h3>
      <button class="ws-close" type="button" aria-label="إغلاق">✕</button>
    </div>
    <div class="ws-body">

      <div class="ws-section">
        <h4 class="ws-section-title">Pexels</h4>
        <p class="ws-hint">
          مفتاح API مجاني. احصل عليه من
          <a href="https://www.pexels.com/api/key/" target="_blank" rel="noopener">pexels.com/api/key</a>.
        </p>
        <label class="ws-field">
          <span>مفتاح Pexels</span>
          <input type="password" id="ws-pexels-key" placeholder="أدخل المفتاح" autocomplete="off" />
        </label>
      </div>

      <div class="ws-section">
        <h4 class="ws-section-title">PeerTube</h4>
        <p class="ws-hint">
          PeerTube شبكة لامركزية. اختر instance (افتراضيًا tilvids.com).
          قائمة الـ instances: <a href="https://joinpeertube.org/instances" target="_blank" rel="noopener">joinpeertube.org</a>.
        </p>
        <label class="ws-field">
          <span>عنوان Instance</span>
          <input type="text" id="ws-peertube-instance" placeholder="https://tilvids.com" autocomplete="off" />
        </label>
      </div>

    </div>
    <div class="ws-actions">
      <button type="button" class="ws-btn-cancel">إلغاء</button>
      <button type="button" class="ws-btn-save">حفظ</button>
    </div>
  `;

  document.body.appendChild(modalEl);

  modalEl.querySelector('.ws-close').addEventListener('click', closeWebSettings);
  modalEl.querySelector('.ws-btn-cancel').addEventListener('click', closeWebSettings);
  modalEl.querySelector('.ws-btn-save').addEventListener('click', saveValues);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeWebSettings();
  });
}

function fillValues() {
  const data = getUserData();
  const keys = data.api_keys || {};

  const pexelsEl = modalEl.querySelector('#ws-pexels-key');
  const peerEl = modalEl.querySelector('#ws-peertube-instance');

  pexelsEl.value = keys['pexels_key'] || '';
  peerEl.value = keys['peertube_instance'] || 'https://tilvids.com';
}

function saveValues() {
  const pexelsKey = modalEl.querySelector('#ws-pexels-key').value.trim();
  const peerInstance = modalEl.querySelector('#ws-peertube-instance').value.trim();

  const data = getUserData();
  const keys = { ...(data.api_keys || {}) };

  if (pexelsKey) keys['pexels_key'] = pexelsKey;
  else delete keys['pexels_key'];

  if (peerInstance) keys['peertube_instance'] = peerInstance;
  else keys['peertube_instance'] = 'https://tilvids.com';

  updateUserData({ api_keys: keys });

  closeWebSettings();

  // أعد تحميل المصادر المفعّلة
  window.dispatchEvent(new CustomEvent('webby:sources-changed'));
}