// uiSelect.js
// Helper para transformar um <select> escondido em um seletor customizado
// com a mesma aparência nos modais.
export function enhanceSelect(root, selectId, opts = {}) {
  const sel = root.querySelector('#' + selectId);
  const wrap = root.querySelector(`.ui-select[data-for="${selectId}"]`);
  if (!sel || !wrap) return null;

  const { searchable = true, searchPlaceholder = 'Buscar...' } = opts;

  const btn = wrap.querySelector('.ui-select-btn');
  const list = wrap.querySelector('.ui-select-list');

  let searchLi = null;
  let searchInput = null;

  const normalize = (text = '') =>
    String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  function optionNodes() {
    return Array.from(list.querySelectorAll('.ui-option')).filter(
      li => !li.classList.contains('ui-option--search')
    );
  }

  function applyFilter(value = '') {
    const query = normalize(value);
    optionNodes().forEach(li => {
      const match = normalize(li.textContent).includes(query);
      li.style.display = match ? '' : 'none';
    });
  }

  function addSearchBox() {
    if (!searchable || searchLi) return;
    searchLi = document.createElement('li');
    searchLi.className = 'ui-option ui-option--search';

    searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'ui-select-search';
    searchInput.placeholder = searchPlaceholder;
    searchInput.autocomplete = 'off';

    searchLi.appendChild(searchInput);
    list.prepend(searchLi);

    searchInput.addEventListener('input', e => applyFilter(e.target.value));
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        optionNodes()
          .find(li => li.style.display !== 'none')
          ?.focus();
      }
    });
  }

  function open(focus = false) {
    wrap.setAttribute('aria-expanded', 'true');
    if (searchInput) {
      searchInput.value = '';
      applyFilter('');
      if (focus) searchInput.focus();
      return;
    }
    if (focus) focusCurrent();
  }

  function close() {
    wrap.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    wrap.getAttribute('aria-expanded') === 'true' ? close() : open(true);
  }

  function pick(value, label) {
    if (!value) return;
    const prev = sel.value;
    sel.value = value;
    btn.querySelector('.label').textContent = label;
    optionNodes().forEach(li => {
      li.toggleAttribute('aria-selected', li.dataset.value === value);
    });
    close();

    if (prev !== value) {
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function focusCurrent() {
    const cur =
      list.querySelector('.ui-option[aria-selected="true"]:not(.ui-option--search)') ||
      optionNodes().find(li => li.style.display !== 'none') ||
      optionNodes()[0];
    cur?.focus();
  }

  function refreshOptions() {
    addSearchBox();
    list.querySelectorAll('.ui-option:not(.ui-option--search)').forEach(li => li.remove());

    Array.from(sel.options).forEach(op => {
      const li = document.createElement('li');
      li.className = 'ui-option';
      li.role = 'option';
      li.dataset.value = op.value;
      li.textContent = op.textContent;
      li.tabIndex = 0;
      if (op.selected) li.setAttribute('aria-selected', 'true');
      li.onclick = () => pick(op.value, op.textContent);
      li.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          li.click();
        }
      };
      list.appendChild(li);
    });

    if (searchLi) {
      list.prepend(searchLi);
      applyFilter(searchInput?.value || '');
    }
  }

  const init = sel.options[sel.selectedIndex];
  if (init) btn.querySelector('.label').textContent = init.textContent;

  btn.onclick = toggle;

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });

  btn.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(true);
    }
  };

  refreshOptions();

  return { pick, open, close, refreshOptions };
}
