export const SITE_SCRIPT = `(function(){
  /* ===== Card / Desc modals ===== */
  var cardDialog = document.getElementById('webby-card-modal');
  var descDialog = document.getElementById('webby-desc-modal');
  var savedScrollY = 0;
  var openGen = 0;

  function escapeHtml(t){
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getScroll(){
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function lockScroll(){
    savedScrollY = getScroll();
    document.body.classList.add('webby-modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + savedScrollY + 'px';
    document.body.style.width = '100%';
  }

  function unlockScroll(){
    document.body.classList.remove('webby-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    var y = savedScrollY;
    requestAnimationFrame(function(){ window.scrollTo(0, y); });
  }

  /* ===== Card modal ===== */
  if (cardDialog) {
    var titleEl = cardDialog.querySelector('.wcm-title');
    var imgEl = cardDialog.querySelector('.wcm-image');
    var descEl = cardDialog.querySelector('.wcm-desc');
    var tagsEl = cardDialog.querySelector('.wcm-tags');
    var metaEl = cardDialog.querySelector('.wcm-meta');
    var closeBtn = cardDialog.querySelector('.wcm-close');

    var openCard = function(card){
      lockScroll();
      openGen++;
      var gen = openGen;

      var title = card.getAttribute('data-title') || '';
      var desc = card.getAttribute('data-description') || '';
      var image = card.getAttribute('data-image') || '';
      var thumbImage = card.getAttribute('data-thumb-image') || '';
      var author = card.getAttribute('data-author') || '';
      var authorImage = card.getAttribute('data-author-image') || '';
      var date = card.getAttribute('data-date') || '';
      var tags = (card.getAttribute('data-tags') || '')
        .split(',').map(function(t){ return t.trim(); }).filter(Boolean);

      titleEl.textContent = title;
      descEl.textContent = desc;

      if (image) {
        imgEl.src = thumbImage || image;
        imgEl.style.display = '';
        imgEl.classList.remove('wcm-image-loaded');
        if (thumbImage && image && thumbImage !== image) {
          var fullImg = new Image();
          fullImg.onload = function() {
            if (gen !== openGen) return;
            imgEl.src = image;
            imgEl.classList.add('wcm-image-loaded');
          };
          fullImg.src = image;
        } else {
          imgEl.classList.add('wcm-image-loaded');
        }
      } else {
        imgEl.removeAttribute('src');
        imgEl.style.display = 'none';
      }

      metaEl.innerHTML = '';
      if (author) {
        var a = document.createElement('span');
        a.className = 'card-author';
        if (authorImage) {
          var av = document.createElement('img');
          av.src = authorImage;
          av.className = 'card-author-avatar';
          av.setAttribute('draggable', 'false');
          a.appendChild(av);
        } else {
          var ph = document.createElement('span');
          ph.className = 'card-author-avatar card-author-avatar-placeholder';
          ph.textContent = author.charAt(0);
          a.appendChild(ph);
        }
        var nm = document.createElement('span');
        nm.className = 'author-name';
        nm.textContent = author;
        a.appendChild(nm);
        metaEl.appendChild(a);
      }
      if (date) {
        var d = document.createElement('span');
        d.className = 'card-date';
        d.textContent = date;
        metaEl.appendChild(d);
      }

      tagsEl.innerHTML = '';
      tags.forEach(function(t){
        var s = document.createElement('span');
        s.className = 'tag';
        s.textContent = t;
        tagsEl.appendChild(s);
      });

      var scrollArea = cardDialog.querySelector('.wcm-scroll');
      if (scrollArea) scrollArea.scrollTop = 0;

      if (typeof cardDialog.showModal === 'function') cardDialog.showModal();
      else cardDialog.setAttribute('open', '');
    };

    var closeCard = function(){
      if (typeof cardDialog.close === 'function') cardDialog.close();
      else cardDialog.removeAttribute('open');
      unlockScroll();
    };

    document.addEventListener('click', function(e){
      var card = e.target.closest && e.target.closest('[data-webby-card]');
      if (!card) return;
      if (e.target.closest('a')) return;
      e.preventDefault();
      openCard(card);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeCard);
    cardDialog.addEventListener('click', function(e){
      if (e.target === cardDialog) closeCard();
    });
    cardDialog.addEventListener('close', unlockScroll);
  }

  /* ===== Description modal ===== */
  if (descDialog) {
    var descBody = descDialog.querySelector('.wdm-body');
    var descClose = descDialog.querySelector('.wdm-close');

    var closeDesc = function(){
      if (typeof descDialog.close === 'function') descDialog.close();
      else descDialog.removeAttribute('open');
      unlockScroll();
    };

    document.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.desc-more');
      if (!btn) return;
      e.preventDefault();
      lockScroll();
      var full = btn.getAttribute('data-full-desc') || '';
      descBody.textContent = full;

      var scrollArea = descDialog.querySelector('.wcm-scroll');
      if (scrollArea) scrollArea.scrollTop = 0;

      if (typeof descDialog.showModal === 'function') descDialog.showModal();
      else descDialog.setAttribute('open', '');
    });

    if (descClose) descClose.addEventListener('click', closeDesc);
    descDialog.addEventListener('click', function(e){
      if (e.target === descDialog) closeDesc();
    });
    descDialog.addEventListener('close', unlockScroll);
  }

  /* ===== Environment detection ===== */
  var isInIframe = (function(){
    try { return window.self !== window.top; } catch(e){ return true; }
  })();
  var isWebbyApp = location.pathname.indexOf('/webby/') !== -1;

  /* ===== Lucide Icons (inline SVG) ===== */
  var ICON_SIZE = 22;
  function svgIcon(paths) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + ICON_SIZE + '" height="' + ICON_SIZE + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }

  var ICONS = {
    search: svgIcon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    earth: svgIcon('<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/>'),
    house: svgIcon('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    bookmark: svgIcon('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>'),
    'sticky-note-plus': svgIcon('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/><path d="M9 13h6"/><path d="M12 10v6"/>')
  };

  /* ===== Bottom Bar — لا يظهر داخل /webby/ ===== */
  if (!isWebbyApp) {
    injectBottomBar();
    injectBottomBarCSS();
  }

  function injectBottomBar() {
    if (document.querySelector('.site-bottom-bar')) return;

    var bar = document.createElement('nav');
    bar.className = 'site-bottom-bar';

    var buttons = [
      { action: 'search',   icon: 'search',           label: 'بحث' },
      { action: 'web',      icon: 'earth',            label: 'Web' },
      { action: 'thisweb',  icon: 'house',            label: 'هذا الموقع', active: true },
      { action: 'bookmarks',icon: 'bookmark',         label: 'مفضلة' },
      { action: 'publish',  icon: 'sticky-note-plus', label: 'نشر' }
    ];

    buttons.forEach(function(b){
      var btn = document.createElement('button');
      btn.className = 'site-bottom-btn' + (b.active ? ' active' : '');
      btn.setAttribute('data-action', b.action);
      btn.type = 'button';
      btn.innerHTML =
        '<span class="site-bottom-icon">' + (ICONS[b.icon] || '') + '</span>' +
        '<span class="site-bottom-label">' + b.label + '</span>';
      bar.appendChild(btn);
    });

    document.body.appendChild(bar);
    document.body.classList.add('has-bottom-bar');

    bar.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.site-bottom-btn');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      handleBottomBarAction(action);
    });
  }

  function handleBottomBarAction(action) {
    // في وضع المعاينة (iframe) → أرسل كل الأحداث للأب
    if (isInIframe) {
      try {
        parent.postMessage({ source: 'webby-preview', kind: 'action', value: action }, '*');
      } catch(e){ /* ignore */ }
      return;
    }

    // في موقع منشور (مستقل) → انتقال عادي
    if (action === 'thisweb') {
      var here = location.pathname.split('/').pop() || 'index.html';
      if (here !== 'index.html' && here !== '') {
        window.location.href = 'index.html';
      }
      return;
    }

    if (action === 'publish') {
      window.location.href = 'webby/index.html';
      return;
    }

    if (action === 'search' || action === 'web' || action === 'bookmarks') {
      window.location.href = 'webby/index.html?view=' + action;
      return;
    }
  }

  function injectBottomBarCSS() {
    var css = ''
      + '.site-bottom-bar{'
      +   'position:fixed;bottom:0;left:0;right:0;'
      +   'display:flex;justify-content:space-around;align-items:stretch;'
      +   'background:var(--bg);border-top:1px solid var(--muted-border);'
      +   'padding:6px 8px calc(6px + env(safe-area-inset-bottom));'
      +   'gap:4px;z-index:900;'
      + '}'
      + '.site-bottom-btn{'
      +   'flex:1;display:flex;flex-direction:column;align-items:center;'
      +   'justify-content:center;gap:2px;padding:6px 4px;'
      +   'border:none;border-radius:8px;background:transparent;'
      +   'color:var(--text);opacity:0.65;cursor:pointer;'
      +   'font:inherit;font-size:11px;transition:opacity .15s,background .15s;'
      +   'min-width:0;'
      + '}'
      + '.site-bottom-btn:hover{opacity:1;background:var(--muted);}'
      + '.site-bottom-btn.active{opacity:1;color:var(--accent);}'
      + '.site-bottom-icon{'
      +   'display:inline-flex;align-items:center;justify-content:center;'
      +   'line-height:1;'
      + '}'
      + '.site-bottom-icon svg{display:block;width:22px;height:22px;}'
      + '.site-bottom-label{'
      +   'font-size:10px;font-weight:600;white-space:nowrap;'
      +   'overflow:hidden;text-overflow:ellipsis;max-width:100%;'
      + '}'
      + 'body.has-bottom-bar{padding-bottom:72px;}'
      + '@media (max-width:520px){'
      +   'body.has-bottom-bar{padding-bottom:66px;}'
      +   '.site-bottom-icon svg{width:20px;height:20px;}'
      +   '.site-bottom-label{font-size:9px;}'
      + '}';

    var style = document.createElement('style');
    style.setAttribute('data-webby-bottom-bar', '1');
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===== PWA Install ===== */
  if ('serviceWorker' in navigator && !isWebbyApp) {
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('service-worker.js').catch(function(){});
    });
  }

  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    showInstallBtn();
  });
  window.addEventListener('appinstalled', function(){
    deferredPrompt = null;
    hideInstallBtn();
  });

  function showInstallBtn(){
    if (document.getElementById('site-install-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'site-install-btn';
    btn.className = 'site-install-btn';
    btn.textContent = '📱 ثبّت الموقع';
    btn.addEventListener('click', function(){
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(){
        deferredPrompt = null;
        hideInstallBtn();
      });
    });
    document.body.appendChild(btn);
  }

  function hideInstallBtn(){
    var b = document.getElementById('site-install-btn');
    if (b) b.remove();
  }

  /* ===== Protections ===== */
  document.addEventListener('contextmenu', function(e){
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  });
  document.addEventListener('dragstart', function(e){
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  });
  document.addEventListener('touchstart', function(e){
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  }, { passive: false });
})();`;