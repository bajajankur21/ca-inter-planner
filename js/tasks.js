// Task domain + the task UI every page shares (row, chip, add/edit form, actions).
import { store } from './store.js';
import { esc, fmt, fmtTime, plusHour, icon, field, openModal, closeModal, onAction, onChange, toast, todayKey, uid } from './util.js';

export const PRIORITIES = [['highest', 'Highest'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
const RANK = Object.fromEntries(PRIORITIES.map(([k], i) => [k, i]));
export const TYPES = ['Study', 'Revision', 'Practice / MTP', 'Mock test', 'Class / lecture', 'Personal', 'Event'];

export const byTime = (a, b) => (a.from || '~').localeCompare(b.from || '~') || RANK[a.priority] - RANK[b.priority];
export const byPriority = (a, b) => RANK[a.priority] - RANK[b.priority] || byTime(a, b);
export const tasksOn = (key) => store.state.tasks.filter((t) => t.date === key).sort(byTime);
export const tasksIn = (from, to) => store.state.tasks.filter((t) => t.date >= from && t.date <= to).sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
export const doneCount = (list) => list.filter((t) => t.done).length;
export const paperShort = (id) => store.state.papers.find((p) => p.id === id)?.short ?? '';

const timeRange = (t) => (t.from ? `${fmtTime(t.from)}${t.to ? ` - ${fmtTime(t.to)}` : ''}` : '');
const flags = (t) =>
  `${t.top3 ? `<span class="flag" title="Top 3 priority">${icon('star', 'Top 3')}</span>` : ''}${t.event ? `<span class="flag" title="Event">${icon('pin', 'Event')}</span>` : ''}`;

export function taskRow(t, { showDate = false } = {}) {
  return `<div class="item prio-${t.priority}${t.done ? ' done' : ''}">
    <input type="checkbox" data-change="task-toggle" data-id="${t.id}" ${t.done ? 'checked' : ''} aria-label="Done: ${esc(t.title)}">
    <span class="dot" title="${t.priority} priority"></span>
    ${t.from ? `<span class="time">${timeRange(t)}</span>` : ''}
    <button class="grow linklike" data-act="task-edit" data-id="${t.id}">${esc(t.title)}</button>
    ${flags(t)}
    ${t.paper ? `<span class="tag">${esc(paperShort(t.paper))}</span>` : ''}
    ${showDate ? `<span class="tag">${fmt(t.date, { day: 'numeric', month: 'short' })}</span>` : ''}
    <button class="icon-btn" data-act="task-del" data-id="${t.id}" aria-label="Delete ${esc(t.title)}">${icon('x')}</button>
  </div>`;
}

export const taskChip = (t) =>
  `<button class="chip prio-${t.priority}${t.done ? ' done' : ''}" data-act="task-edit" data-id="${t.id}" title="${esc(`${timeRange(t)} ${t.title}`.trim())}">${t.done ? icon('check') : ''}${t.event ? icon('pin') : ''}<span>${esc(t.title)}</span></button>`;

export const addTaskBtn = (date, from = '', label = 'Add task') =>
  `<button class="icon-btn add" data-act="task-new" data-date="${date}" data-from="${from}" aria-label="${esc(label)}">${icon('plus')}</button>`;

export function openTaskForm(prefill = {}) {
  const existing = prefill.id ? store.state.tasks.find((t) => t.id === prefill.id) : null;
  const t = { date: todayKey(), from: '', to: '', title: '', priority: 'medium', type: 'Study', paper: '', top3: false, event: false, ...existing, ...prefill };
  const papers = [['', 'No paper'], ...store.state.papers.map((p) => [p.id, `${p.short} - ${p.name}`])];
  const body = `
    ${field({ label: 'Task', name: 'title', value: t.title, required: true, placeholder: 'e.g. AS 2 Inventories: illustrations 1-10' })}
    <div class="form2">
      ${field({ label: 'Date', name: 'date', type: 'date', value: t.date, required: true })}
      ${field({ label: 'Priority', name: 'priority', type: 'select', value: t.priority, choices: PRIORITIES })}
      ${field({ label: 'From', name: 'from', type: 'time', value: t.from })}
      ${field({ label: 'To', name: 'to', type: 'time', value: t.to })}
      ${field({ label: 'Type', name: 'type', type: 'select', value: t.type, choices: TYPES.map((x) => [x, x]) })}
      ${field({ label: 'Paper', name: 'paper', type: 'select', value: t.paper, choices: papers })}
    </div>
    <div class="row">
      ${field({ label: 'Top 3 priority of the day', name: 'top3', type: 'checkbox', value: t.top3 })}
      ${field({ label: 'Show as event on calendar', name: 'event', type: 'checkbox', value: t.event })}
    </div>`;
  const extra = existing ? `<button type="button" class="btn left" data-act="task-del" data-id="${existing.id}">Delete</button>` : '';
  openModal(existing ? 'Edit task' : 'New task', body, (data) => {
    const clean = normaliseTask(data);
    if (!clean.title) return false;
    if (clean.from && clean.to && clean.to < clean.from) {
      toast('End time is before the start time.');
      return false;
    }
    if (existing) store.update((s) => Object.assign(s.tasks.find((x) => x.id === existing.id), clean));
    else addTask(clean);
    const top3Count = store.state.tasks.filter((x) => x.date === clean.date && x.top3).length;
    toast(top3Count > 3 ? `Saved. That day has ${top3Count} "top 3" tasks, maybe trim it?` : existing ? 'Task updated' : 'Added. It now shows on every page.');
  }, { extra });
}

export const deleteTask = (id) => store.update((s) => { s.tasks = s.tasks.filter((x) => x.id !== id); });

/** The one place that knows what a task looks like. */
export function normaliseTask(f) {
  return {
    title: String(f.title || '').trim(), date: f.date || todayKey(), from: f.from || '', to: f.to || '',
    priority: RANK[f.priority] === undefined ? 'medium' : f.priority, type: f.type || 'Study', paper: f.paper || '',
    top3: Boolean(f.top3), event: Boolean(f.event),
  };
}

export function addTask(fields) {
  const task = { id: uid(), done: false, ...normaliseTask(fields) };
  if (task.title) store.update((s) => s.tasks.push(task));
  return task;
}

onChange('task-toggle', (el) => store.update((s) => {
  const t = s.tasks.find((x) => x.id === el.dataset.id);
  if (t) t.done = el.checked;
}));
onChange('task-flag', (el) => store.update((s) => {
  const t = s.tasks.find((x) => x.id === el.dataset.id);
  if (t) t[el.dataset.flag] = el.type === 'checkbox' ? el.checked : el.value;
}));
onAction('task-edit', (el) => openTaskForm({ id: el.dataset.id }));
onAction('task-new', (el) => {
  const { date, from } = el.dataset;
  openTaskForm({ ...(date && { date }), ...(from && { from, to: plusHour(from) }) });
});
onAction('task-del', (el) => {
  if (!confirm('Delete this task?')) return;
  if (!document.getElementById('modalbg').hidden) closeModal();
  deleteTask(el.dataset.id);
});
