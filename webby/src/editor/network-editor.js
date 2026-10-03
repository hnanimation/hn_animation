export function renderNetworkEditor(container, project, onChange) {
  container.innerHTML = '';

  const info = document.createElement('p');
  info.className = 'network-info';
  info.textContent =
    'قسم الشبكة سيعرض لاحقًا محتوى من المواقع المرتبطة بك عبر بروتوكولات مفتوحة (RSS، JSON Feed، وغيرها).';
  container.appendChild(info);

  if (!project.meta.network) {
    project.meta.network = { enabled: false };
  }

  const wrap = document.createElement('label');
  wrap.className = 'field checkbox';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = 'wb-network-enabled';
  input.name = 'wb-network-enabled';
  input.checked = !!project.meta.network.enabled;
  input.addEventListener('change', () => {
    project.meta.network.enabled = input.checked;
    onChange();
  });

  const span = document.createElement('span');
  span.textContent = 'إظهار قسم الشبكة في الموقع';

  wrap.appendChild(input);
  wrap.appendChild(span);
  container.appendChild(wrap);

  if (project.meta.network.enabled) {
    const preview = document.createElement('div');
    preview.className = 'network-preview';
    preview.innerHTML = `
      <h3>الشبكة</h3>
      <p class="lead">قريبًا...</p>
      <p class="network-desc">سيعرض هذا القسم محتوى من المواقع المرتبطة بك.</p>
    `;
    container.appendChild(preview);
  }
}