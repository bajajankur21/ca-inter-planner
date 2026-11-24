// Shared helpers: DOM, dates, escaping, icons, modal, toast and the action registry.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// ---------- dates (always LOCAL; toISOString() is UTC and shows "yesterday" in India until 05:30) ----------
const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dateKey();
export const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};
export const addDays = (key, n) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  return dateKey(new Date(y, m - 1 + n, 1)).slice(0, 7);
};
export const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const monthDays = (ym) => Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${pad(i + 1)}`);
export const weekStartOf = (key, startDay) => {
  const d = parseKey(key);
  d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7));
  return dateKey(d);
};
export const weekDays = (key, startDay) => {
  const start = weekStartOf(key, startDay);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};
/** Calendar cells for a month: leading nulls so day 1 lands under the right weekday. */
export const monthGrid = (ym, startDay) => {
  const lead = (parseKey(`${ym}-01`).getDay() - startDay + 7) % 7;
  return [...Array(lead).fill(null), ...monthDays(ym)];
};
export const weekdayLabels = (startDay, style = 'short') =>
  Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + ((startDay + i) % 7)).toLocaleDateString('en-IN', { weekday: style }));
export const fmt = (key, opts) => parseKey(key).toLocaleDateString('en-IN', opts);
export const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
export const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
export const hhmm = (h, m = 0) => `${pad(h)}:${pad(m)}`;
export const plusHour = (time) => (time ? hhmm(Math.min(23, Number(time.slice(0, 2)) + 1), Number(time.slice(3))) : '');
export const daysBetween = (fromKey, toKey) => Math.round((parseKey(toKey) - parseKey(fromKey)) / 86400000);

// ---------- icons (inline SVG, stroke style) ----------
const ICONS = {
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  pin: 'M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11zM12 8a2 2 0 1 0 0 4a2 2 0 1 0 0-4',
  check: 'M5 12l5 5L20 7',
  flame: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  moon: 'M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
};
export const icon = (name, label = '') =>
  `<svg class="i" viewBox="0 0 24 24" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}><path d="${ICONS[name]}"/></svg>`;

// ---------- small render helpers ----------
export const ring = (p, label, { color = '', big = false } = {}) =>
  `<div class="ring${big ? ' big' : ''}" style="--p:${clamp(p, 0, 100)}${color ? `;--c:${color}` : ''}" data-label="${esc(label)}" role="img" aria-label="${esc(label)}"></div>`;
export const bar = (p, color = '') =>
  `<div class="progress" role="progressbar" aria-valuenow="${clamp(p, 0, 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${clamp(p, 0, 100)}%${color ? `;background:${color}` : ''}"></i></div>`;
export const barRow = (label, p, color = '', right = `${p}%`) =>
  `<div class="barrow"><span>${esc(label)}</span>${bar(p, color)}<b>${esc(right)}</b></div>`;
export const empty = (msg) => `<div class="empty">${esc(msg)}</div>`;
export const options = (pairs, selected) =>
  pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');

/** One form control. type: text | date | time | number | select | checkbox | textarea. */
export function field({ label, name, type = 'text', value = '', choices = [], required = false, placeholder = '', attrs = '' }) {
  const req = required ? 'required' : '';
  const ph = placeholder ? `placeholder="${esc(placeholder)}"` : '';
  if (type === 'checkbox') return `<label class="check"><input type="checkbox" name="${name}" ${value ? 'checked' : ''} ${attrs}> ${esc(label)}</label>`;
  if (type === 'select') return `<label class="lbl">${esc(label)}<select class="field" name="${name}" ${attrs}>${options(choices, value)}</select></label>`;
  if (type === 'textarea') return `<label class="lbl">${esc(label)}<textarea class="field" name="${name}" ${ph} ${req} ${attrs}>${esc(value)}</textarea></label>`;
  return `<label class="lbl">${esc(label)}<input class="field" type="${type}" name="${name}" value="${esc(value)}" ${ph} ${req} ${attrs}></label>`;
}

// ---------- toast ----------
let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ---------- modal ----------
let submitHandler = null;
let returnFocus = null;
export function openModal(title, bodyHtml, onSubmit, { submitLabel = 'Save', extra = '' } = {}) {
  returnFocus = document.activeElement;
  $('#modalTitle').textContent = title;
  const form = $('#modalForm');
  form.innerHTML = `${bodyHtml}<div class="actions">${extra}<button type="button" class="btn" data-act="modal-close">Cancel</button><button class="btn primary">${esc(submitLabel)}</button></div>`;
  submitHandler = onSubmit;
  $('#modalbg').hidden = false;
  form.querySelector('input:not([type=checkbox]),select,textarea')?.focus();
}
export function closeModal() {
  $('#modalbg').hidden = true;
  submitHandler = null;
  returnFocus?.focus?.();
}

// ---------- action registry: pages register handlers, one set of document listeners dispatches ----------
const handlers = { click: {}, change: {} };
export const onAction = (name, fn) => { handlers.click[name] = fn; };
export const onChange = (name, fn) => { handlers.change[name] = fn; };

export function wireActions() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    const fn = el && handlers.click[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el) handlers.change[el.dataset.change]?.(el, e);
  });
  // Enter in an "add row" input presses its button.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modalbg').hidden) closeModal();
    if (e.key === 'Enter' && e.target.matches('.addrow input')) {
      e.preventDefault();
      e.target.closest('.addrow').querySelector('button')?.click();
    }
  });
  $('#modalbg').addEventListener('click', (e) => { if (e.target.id === 'modalbg') closeModal(); });
  $('#modalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (submitHandler && submitHandler(data, e.target) !== false) closeModal();
  });
  onAction('modal-close', closeModal);
}
