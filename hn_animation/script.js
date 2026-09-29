(function(){
  var cardDialog = document.getElementById('webby-card-modal');
  var descDialog = document.getElementById('webby-desc-modal');
  var savedScrollY = 0;

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
  }

  function unlockScroll(){
    document.body.classList.remove('webby-modal-open');
    var y = savedScrollY;
    requestAnimationFrame(function(){
      window.scrollTo(0, y);
    });
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

      var title = card.getAttribute('data-title') || '';
      var desc = card.getAttribute('data-description') || '';
      var image = card.getAttribute('data-image') || '';
      var author = card.getAttribute('data-author') || '';
      var date = card.getAttribute('data-date') || '';
      var tags = (card.getAttribute('data-tags') || '')
        .split(',').map(function(t){ return t.trim(); }).filter(Boolean);

      titleEl.textContent = title;
      descEl.textContent = desc;

      if (image) {
        imgEl.src = image;
        imgEl.style.display = '';
      } else {
        imgEl.removeAttribute('src');
        imgEl.style.display = 'none';
      }

      metaEl.innerHTML = '';
      if (author) {
        var a = document.createElement('span');
        a.className = 'card-author';
        a.innerHTML = 'by: <span class="author-name">' + escapeHtml(author) + '</span>';
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

  /* ===== Protections ===== */
  document.addEventListener('contextmenu', function(e){
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  });
  document.addEventListener('dragstart', function(e){
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  });
})();