// uiSelect.js
// Helper para transformar um <select> escondido em um seletor customizado
// com a mesma aparência nos modais.
export function enhanceSelect(root, selectId) {
    const sel = root.querySelector('#' + selectId);
    const wrap = root.querySelector(`.ui-select[data-for="${selectId}"]`);
    if (!sel || !wrap) return null;

    const btn = wrap.querySelector('.ui-select-btn');
    const list = wrap.querySelector('.ui-select-list');

    function open(focus = false) {
        wrap.setAttribute('aria-expanded', 'true');
        if (focus) focusCurrent();
    }

    function close() {
        wrap.setAttribute('aria-expanded', 'false');
    }

    function toggle() {
        (wrap.getAttribute('aria-expanded') === 'true') ? close() : open(true);
    }

    function pick(value, label) {
        if (!value) return;
        sel.value = value;
        btn.querySelector('.label').textContent = label;
        list.querySelectorAll('.ui-option').forEach(li => {
            li.toggleAttribute('aria-selected', li.dataset.value === value);
        });
        close();
    }

    function focusCurrent() {
        const cur =
            list.querySelector('.ui-option[aria-selected="true"]') ||
            list.querySelector('.ui-option');
        cur?.focus();
    }

    const init = sel.options[sel.selectedIndex];
    if (init) btn.querySelector('.label').textContent = init.textContent;

    btn.onclick = toggle;

    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });

    btn.onkeydown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open(true);
        }
    };

    return { pick, open, close };
}
