import { SECTION_TYPES, isCollection } from '../core/sections.js';
import { getAllMedia, getMedia } from '../core/media.js';

let fieldCounter = 0;
function nextFieldId(prefix = 'wb-field') {
  return `${prefix}-${++fieldCounter}`;
}

export function renderSectionEditor(container, section, onChange, project) {
  const def = SECTION_TYPES[section.type];
  if (!def) {
    container.innerHTML = '<p>نوع قسم غير معروف.</p>';
    return;
  }

  container.innerHTML = '';

  container.appendChild(
    makeField('العنوان', 'text', section.title, (val) => {
      section.title = val;
      section.content.title = val;
      onChange();
    })
  );

  container.appendChild(
    makeCheckbox('ظاهر في الموقع', section.visible, (val) => {
      section.visible = val;
      onChange();
    })
  );

  if (section.type === 'home' || section.type === 'about') {
    container.appendChild(
      makeTextarea('النص', section.content.body, (val) => {
        section.content.body = val;
        onChange();
      })
    );
    return;
  }

  if (section.type === 'contact') {
    container.appendChild(
      makeField('البريد الإلكتروني', 'email', section.content.email, (val) => {
        section.content.email = val;
        onChange();
      })
    );
    return;
  }

  if (isCollection(section.type)) {
    renderItemsEditor(container, section, onChange, project);
  }
}

function renderItemsEditor(container, section, onChange, project) {
  if (!Array.isArray(section.content.items)) section.content.items = [];

  const admins = project?.meta?.admins || [];

  const wrapper = document.createElement('div');
  wrapper.className = 'items-editor';

  function rebuild() {
    wrapper.innerHTML = '';

    section.content.items.forEach((item, index) => {
      const box = document.createElement('div');
      box.className = 'item-box';

      const header = document.createElement('div');
      header.className = 'item-header';

      const label = document.createElement('span');
      label.textContent = `العنصر ${index + 1}`;
      header.appendChild(label);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'حذف';
      removeBtn.className = 'danger';
      removeBtn.addEventListener('click', () => {
        section.content.items.splice(index, 1);
        rebuild();
        onChange();
      });
      header.appendChild(removeBtn);

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.id = nextFieldId('item-title');
      titleInput.name = titleInput.id;
      titleInput.placeholder = 'العنوان';
      titleInput.value = item.title || '';
      titleInput.addEventListener('input', () => {
        item.title = titleInput.value;
        onChange();
      });

      const descInput = document.createElement('textarea');
      descInput.id = nextFieldId('item-desc');
      descInput.name = descInput.id;
      descInput.placeholder = 'الوصف';
      descInput.value = item.description || '';
      descInput.addEventListener('input', () => {
        item.description = descInput.value;
        onChange();
      });

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.id = nextFieldId('item-date');
      dateInput.name = dateInput.id;
      dateInput.value = item.date || '';
      dateInput.addEventListener('input', () => {
        item.date = dateInput.value;
        onChange();
      });

      // ===== Author dropdown =====
      let authorLabel = null;
      if (admins.length > 0) {
        authorLabel = document.createElement('label');
        authorLabel.className = 'field';
        const authorSpan = document.createElement('span');
        authorSpan.textContent = 'الكاتب';
        authorLabel.appendChild(authorSpan);

        const authorSelect = document.createElement('select');
        authorSelect.id = nextFieldId('item-author');
        authorSelect.name = authorSelect.id;

        const none = document.createElement('option');
        none.value = '';
        none.textContent = '— بدون —';
        authorSelect.appendChild(none);

        admins.forEach((a) => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.name || '(بدون اسم)';
          authorSelect.appendChild(opt);
        });

        authorSelect.value = item.authorId || '';
        authorSelect.addEventListener('change', () => {
          item.authorId = authorSelect.value || '';
          rebuild();
          onChange();
        });

        authorLabel.appendChild(authorSelect);
      }

      const tagsInput = document.createElement('input');
      tagsInput.type = 'text';
      tagsInput.id = nextFieldId('item-tags');
      tagsInput.name = tagsInput.id;
      tagsInput.placeholder = 'الوسوم (مفصولة بفواصل): art, tutorial';
      tagsInput.value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
      tagsInput.addEventListener('input', () => {
        item.tags = tagsInput.value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        onChange();
      });

      const imageLabel = document.createElement('label');
      imageLabel.className = 'field';
      const imageSpan = document.createElement('span');
      imageSpan.textContent = 'الصورة';
      imageLabel.appendChild(imageSpan);

      const imageSelect = document.createElement('select');
      imageSelect.id = nextFieldId('item-image');
      imageSelect.name = imageSelect.id;
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '— بدون صورة —';
      imageSelect.appendChild(none);

      getAllMedia().forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        imageSelect.appendChild(opt);
      });

      imageSelect.value = item.image || '';
      imageSelect.addEventListener('change', () => {
        item.image = imageSelect.value || '';
        rebuild();
        onChange();
      });
      imageLabel.appendChild(imageSelect);

      if (item.image && getMedia(item.image)) {
        const preview = document.createElement('img');
        preview.src = getMedia(item.image).url;
        preview.className = 'item-image-preview';
        preview.alt = item.title || '';
        preview.width = 120;
        preview.height = 80;
        box.appendChild(preview);
      }

      box.appendChild(header);
      box.appendChild(titleInput);
      box.appendChild(descInput);
      box.appendChild(dateInput);
      if (authorLabel) box.appendChild(authorLabel);
      box.appendChild(tagsInput);
      box.appendChild(imageLabel);
      wrapper.appendChild(box);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ إضافة عنصر';
    addBtn.addEventListener('click', () => {
      section.content.items.push({
        title: '',
        description: '',
        tags: [],
        image: '',
        date: new Date().toISOString().slice(0, 10),
        authorId: ''
      });
      rebuild();
      onChange();
    });
    wrapper.appendChild(addBtn);
  }

  rebuild();
  container.appendChild(wrapper);
}

function makeField(label, type, value, onInput) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.id = nextFieldId('field');
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
  area.id = nextFieldId('textarea');
  area.name = area.id;
  area.rows = 5;
  area.value = value || '';
  area.addEventListener('input', () => onInput(area.value));
  wrap.appendChild(span);
  wrap.appendChild(area);
  return wrap;
}

function makeCheckbox(label, checked, onInput) {
  const wrap = document.createElement('label');
  wrap.className = 'field checkbox';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = nextFieldId('checkbox');
  input.name = input.id;
  input.checked = !!checked;
  input.addEventListener('change', () => onInput(input.checked));
  const span = document.createElement('span');
  span.textContent = label;
  wrap.appendChild(input);
  wrap.appendChild(span);
  return wrap;
}