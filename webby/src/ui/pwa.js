let deferredPrompt = null;

/**
 * لا تسجّل SW إذا كنا في وضع "مضمّن" داخل موقع مُصدَّر.
 * (المسار يبدأ بـ /webby/)
 */
function isEmbedded() {
  return location.pathname.includes('/webby/');
}

export function initPWA() {
  if (isEmbedded()) {
    console.log('[Webby] embedded mode — skip SW registration');
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./service-worker.js')
        .then((reg) => {
          console.log('[Webby] Service Worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Webby] SW registration failed:', err);
        });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[Webby] PWA installed');
    deferredPrompt = null;
    hideInstallButton();
  });
}

function showInstallButton() {
  if (document.getElementById('btn-install-pwa')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-install-pwa';
  btn.className = 'install-pwa-btn';
  btn.innerHTML = '📱 ثبّت التطبيق';
  btn.title = 'ثبّت Webby كتطبيق على جهازك';

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[Webby] install outcome:', outcome);
    deferredPrompt = null;
    hideInstallButton();
  });

  const topbar = document.querySelector('.topbar');
  if (topbar) {
    topbar.appendChild(btn);
  }
}

function hideInstallButton() {
  const btn = document.getElementById('btn-install-pwa');
  if (btn) btn.remove();
}