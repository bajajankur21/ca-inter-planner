// Main tracker: type a task once, see it everywhere. Plus mood/sleep, water and notes logs.
import { store } from '../store.js';
import { view, rerender } from '../router.js';
import { $, esc, empty, todayKey, addDays, weekDays, monthDays, fmt, fmtTime, options, icon, toast, onAction } from '../util.js';
import { PRIORITIES, TYPES, byTime, paperShort, addTask } from '../tasks.js';

export const title = 'Type it here once, see it everywhere.';

const FILTERS = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['upcoming', 'Upcoming'], ['open', 'Not done'], ['all', 'All']];

function filtered() {
  const today = todayKey();
  const week = weekDays(today, store.state.profile.weekStart);
  const month = monthDays(today.slice(0, 7));
  const rules = {
    today: (t) => t.date === today,
    week: (t) => t.date >= week[0] && t.date <= week[6],
    month: (t) => t.date >= month[0] && t.date <= month.at(-1),
    upcoming: (t) => t.date > today,
    open: (t) => !t.done,
    all: () => true,
  };
  return store.state.tasks.filter(rules[view.trackerFilter]).sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
}

const cb = (t, flag, label) => `<input type="checkbox" data-change="task-flag" data-flag="${flag}" data-id="${t.id}" ${t[flag] ? 'checked' : ''} aria-label="${label}: ${esc(t.title)}">`;

function row(t) {
  return `<tr class="prio-${t.priority}${t.done ? ' done' : ''}">
    <td>${cb(t, 'done', 'Done')}</td>
    <td>${fmt(t.date, { day: 'numeric', month: 'short' })}</td>
    <td>${fmtTime(t.from)}</td><td>${fmtTime(t.to)}</td>
    <td class="wide"><button class="linklike" data-act="task-edit" data-id="${t.id}">${esc(t.title)}</button></td>
    <td>${t.paper ? `<span class="tag">${esc(paperShort(t.paper))}</span>` : ''}</td>
    <td>${esc(t.type || '')}</td>
    <td>${cb(t, 'top3', 'Top 3')}</td>
    <td>${cb(t, 'event', 'Show on calendar')}</td>
    <td><span class="dot"></span> <select class="mini" data-change="task-flag" data-flag="priority" data-id="${t.id}" aria-label="Priority">${options(PRIORITIES, t.priority)}</select></td>
    <td><button class="icon-btn" data-act="task-del" data-id="${t.id}" aria-label="Delete ${esc(t.title)}">${icon('x')}</button></td>
  </tr>`;
}

function logs() {
  const keys = Array.from({ length: 14 }, (_, i) => addDays(todayKey(), -i));
  const days = keys.map((k) => [k, store.dayView(k)]);
  const mood = days.filter(([, d]) => d.mood || d.wake || d.bed);
  const notes = days.filter(([, d]) => d.notes || d.wins);
  const water = days.slice(0, 7).reverse();
  const target = store.state.profile.waterTarget;
  return `
  <div class="card s5"><h3>Mood &amp; sleep log</h3>
    ${mood.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Date</th><th>Wake</th><th>Bed</th><th>Mood</th></tr></thead><tbody>
      ${mood.map(([k, d]) => `<tr><td><button class="linklike" data-act="open-day" data-date="${k}">${fmt(k, { day: 'numeric', month: 'short' })}</button></td><td>${fmtTime(d.wake)}</td><td>${fmtTime(d.bed)}</td><td>${esc(d.mood)}</td></tr>`).join('')}
    </tbody></table></div>` : empty('Fill mood, wake and bed time on the daily planner.')}
  </div>
  <div class="card s4"><h3>Daily notes</h3>
    ${notes.length ? `<div class="list">${notes.map(([k, d]) => `<div class="item"><button class="linklike tag" data-act="open-day" data-date="${k}">${fmt(k, { day: 'numeric', month: 'short' })}</button><span class="grow">${esc(d.notes)}${d.wins ? `<br><small class="muted">Win: ${esc(d.wins)}</small>` : ''}</span></div>`).join('')}</div>` : empty('Notes from the daily planner show up here.')}
  </div>
  <div class="card s3"><h3>Glasses (7 days)</h3>
    <div class="waterlog">${water.map(([k, d]) => `<div class="wl"><span>${fmt(k, { weekday: 'narrow' })}</span><div class="wl-bar"><i style="height:${Math.min(100, (d.water / target) * 100)}%"></i></div><b>${d.water}</b></div>`).join('')}</div>
  </div>`;
}

export function render(el) {
  const list = filtered();
  const papers = [['', 'Paper'], ...store.state.papers.map((p) => [p.id, p.short])];
  el.innerHTML = `
  <div class="card">
    <h3>Quick add</h3>
    <form class="quickadd" id="quickAdd">
      <input class="field" type="date" name="date" value="${todayKey()}" required aria-label="Date">
      <input class="field" type="time" name="from" aria-label="From">
      <input class="field" type="time" name="to" aria-label="To">
      <input class="field qa-title" name="title" placeholder="Task, e.g. Revise GST registration" required aria-label="Task">
      <select class="field" name="paper" aria-label="Paper">${options(papers, '')}</select>
      <select class="field" name="type" aria-label="Type">${options(TYPES.map((x) => [x, x]), 'Study')}</select>
      <select class="field" name="priority" aria-label="Priority">${options(PRIORITIES, 'medium')}</select>
      <label class="check"><input type="checkbox" name="top3"> Top 3</label>
      <label class="check"><input type="checkbox" name="event"> Calendar</label>
      <button class="btn primary">${icon('plus')} Add</button>
    </form>
  </div>
  <div class="sect"><div class="seg" role="group" aria-label="Filter tasks">${FILTERS.map(([k, l]) => `<button class="${view.trackerFilter === k ? 'sel' : ''}" data-act="tracker-filter" data-k="${k}" aria-pressed="${view.trackerFilter === k}">${l}</button>`).join('')}</div>
    <span class="muted">${list.length} task${list.length === 1 ? '' : 's'}</span></div>
  <div class="card">${list.length ? `<div class="tablewrap"><table class="tbl tracker">
    <thead><tr><th>Done</th><th>Date</th><th>From</th><th>To</th><th>Task</th><th>Paper</th><th>Type</th><th>Top 3</th><th>Calendar</th><th>Priority</th><th><span class="sr-only">Delete</span></th></tr></thead>
    <tbody>${list.map(row).join('')}</tbody></table></div>` : empty('No tasks for this filter yet. Add one above.')}</div>
  <div class="grid mt">${logs()}</div>`;

  $('#quickAdd', el).addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.from && d.to && d.to < d.from) return toast('End time is before the start time.');
    addTask(d);
    toast('Added. It now shows on the daily, weekly and monthly pages.');
    $('#quickAdd input[name=title]')?.focus();
  });
}

onAction('tracker-filter', (el) => { view.trackerFilter = el.dataset.k; rerender(); });
