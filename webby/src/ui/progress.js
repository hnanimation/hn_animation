export function showProgress(message) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay progress-overlay';
  overlay.innerHTML = `
    <div class="modal progress-modal">
      <p class="progress-message">${message}</p>
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <p class="progress-counter"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const msgEl = overlay.querySelector('.progress-message');
  const fillEl = overlay.querySelector('.progress-fill');
  const counterEl = overlay.querySelector('.progress-counter');

  return {
    update(text, current, total) {
      if (text) msgEl.textContent = text;
      if (total != null && total > 0) {
        const pct = Math.round((current / total) * 100);
        fillEl.style.width = pct + '%';
        counterEl.textContent = `${current} / ${total}`;
      } else if (total === 0) {
        fillEl.style.width = '100%';
        counterEl.textContent = '';
      }
    },
    close() {
      overlay.remove();
    }
  };
}