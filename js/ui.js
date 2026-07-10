// ui.js — tiny DOM helpers shared by views. No framework.

// h('div.card#id', {onclick}, [children | strings])
export function h(tag, props = {}, children = []) {
  let el;
  const m = tag.match(/^([a-z0-9]+)/i);
  el = document.createElement(m ? m[1] : 'div');
  const idm = tag.match(/#([\w-]+)/); if (idm) el.id = idm[1];
  const classes = [...tag.matchAll(/\.([\w-]+)/g)].map(x => x[1]); if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden') { if (v) el.setAttribute(k, ''); el[k] = v; }
    else el.setAttribute(k, v);
  }
  appendChildren(el, children);
  return el;
}
function appendChildren(el, children) {
  const arr = Array.isArray(children) ? children : [children];
  for (const c of arr) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function mount(el, children) { clear(el); appendChildren(el, children); return el; }

let toastTimer = null;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

export function modal({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, danger }) {
  const backdrop = h('div.modal-backdrop', {
    onclick: (e) => { if (e.target === backdrop) close(); },
  });
  function close() { backdrop.remove(); }
  const bodyEl = typeof body === 'string' ? h('p.sub', {}, body) : body;
  const box = h('div.modal', {}, [
    h('h2', {}, title),
    bodyEl,
    h('div.modal-actions', {}, [
      h('button.btn.ghost', { onclick: close }, cancelText),
      h('button', { class: 'btn ' + (danger ? 'warn' : 'primary'), onclick: () => { close(); onConfirm && onConfirm(); } }, confirmText),
    ]),
  ]);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
  return close;
}

export function fmtHours(h) {
  if (h == null) return '0h';
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  if (whole === 0) return `${mins}m`;
  return `${whole}h ${mins}m`;
}

export function niceDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
