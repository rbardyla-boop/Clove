/**
 * Minimal DOM helpers for the editor panels (no framework). `el` builds elements; `select` builds a
 * closed-option dropdown; `clear` empties a node. Keeps the UI code terse and consistent.
 */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    // Intentionally NO raw-HTML sink: el() is text-only by construction (deny-by-default UI).
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** A labelled <select> over a closed option list. onChange(value) fires on selection. */
export function dropdown(label, options, value, onChange) {
  const sel = el('select', { class: 'field-select', onChange: (e) => onChange(e.target.value) });
  for (const opt of options) {
    const o = el('option', { value: opt, text: opt });
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  }
  return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), sel]);
}

/** A bounded text input with a maxlength. onInput(value) fires on change. */
export function textField(label, value, maxLength, onInput) {
  const input = el('input', {
    type: 'text',
    class: 'field-input',
    value: value || '',
    maxlength: String(maxLength),
    onInput: (e) => onInput(e.target.value),
  });
  return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), input]);
}

export function button(label, onClick, cls = '') {
  return el('button', { class: `btn ${cls}`.trim(), onClick, type: 'button' }, [label]);
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function section(title, children) {
  return el('section', { class: 'panel-section' }, [el('h3', { class: 'panel-title', text: title }), ...[].concat(children)]);
}
