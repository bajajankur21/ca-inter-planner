// Daily planner: time blocks, top 3, to-do, mood, sleep, water, meals, workout, notes.
import { store } from '../store.js';
import { view, rerender } from '../router.js';
import { esc, ring, empty, pct, todayKey, addDays, fmt, monthGrid, weekdayLabels, hourLabel, hhmm, icon, options, onAction, onChange } from '../util.js';
import { tasksOn, doneCount, taskRow, taskChip, addTaskBtn } from '../tasks.js';

export const title = 'Make space for what matters today.';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 5 AM .. 11 PM
export const MOODS = ['Great', 'Productive', 'Calm', 'Okay', 'Tired', 'Stressed', 'Low'];
const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['snacks', 'Snacks'], ['dinner', 'Dinner']];

const glass = (n, filled) => `<button class="glass${filled ? ' on' : ''}" data-act="water" data-n="${n}" aria-label="Glass ${n}" aria-pressed="${filled}">
  <svg viewBox="0 0 24 30" aria-hidden="true"><path class="g-water" d="M5.2 12h13.6l-1.5 15H6.7z"/><path class="g-outline" d="M3 2h18l-2.5 25h-13z"/></svg></button>`;

function miniCalendar(selected) {
  const today = todayKey();
  const ws = store.state.profile.weekStart;
  const cells = monthGrid(selected.slice(0, 7), ws).map((d) => (d
    ? `<button class="mc${d === selected ? ' sel' : ''}${d === today ? ' today' : ''}${tasksOn(d).length ? ' has' : ''}" data-act="day-pick" data-date="${d}" aria-label="${fmt(d, { day: 'numeric', month: 'long' })}">${Number(d.slice(8))}</button>`
    : '<span></span>')).join('');
  return `<div class="minical"><b>${fmt(selected, { month: 'long', year: 'numeric' })}</b>
    <div class="mcgrid">${weekdayLabels(ws, 'narrow').map((w) => `<span class="mch">${w}</span>`).join('')}${cells}</div></div>`;
}

function timeline(date, tasks) {
  const byHour = {};
  tasks.filter((t) => t.from).forEach((t) => { (byHour[Math.max(5, Number(t.from.slice(0, 2)))] ??= []).push(t); });
  return HOURS.map((h) => `<div class="slot${byHour[h] ? ' busy' : ''}">
      <span class="slot-h">${hourLabel(h)}</span>
      <div class="slot-body">${(byHour[h] || []).map(taskChip).join('')}</div>
      ${addTaskBtn(date, hhmm(h), `Add task at ${hourLabel(h)}`)}
    </div>`).join('');
}

const textField = (label, fieldName, value, placeholder, type = 'text') =>
  `<label class="lbl">${label}<input class="field" type="${type}" data-change="day-field" data-field="${fieldName}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;

export function render(el) {
  const date = view.date;
  const day = store.dayView(date);
  const tasks = tasksOn(date);
  const done = doneCount(tasks);
  const top3 = tasks.filter((t) => t.top3);
  const untimed = tasks.filter((t) => !t.from);
  const target = store.state.profile.waterTarget;

  el.innerHTML = `
  <div class="grid daily">
    <div class="card s3">
      <div class="datenav">
        <button class="icon-btn" data-act="day-shift" data-n="-1" aria-label="Previous day">${icon('left')}</button>
        <input class="field" type="date" value="${date}" data-change="day-set" aria-label="Choose day">
        <button class="icon-btn" data-act="day-shift" data-n="1" aria-label="Next day">${icon('right')}</button>
      </div>
      <p class="dayname">${fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })}${date !== todayKey() ? ' <button class="btn" data-act="day-pick" data-date="' + todayKey() + '">Today</button>' : ''}</p>
      <div class="center">${ring(pct(done, tasks.length), `${done} / ${tasks.length}`, { big: true })}<small class="muted">Daily task progress</small></div>
      <h4>Today's top 3</h4>
      <div class="list">${top3.length ? top3.map((t) => taskRow(t)).join('') : empty('Star up to three tasks as top priorities.')}</div>
      <h4>Calendar</h4>${miniCalendar(date)}
    </div>

    <div class="card s5">
      <div class="spread"><h3>Time blocks</h3><button class="btn primary" data-act="task-new" data-date="${date}">${icon('plus')} Task</button></div>
      <h4>To-do (anytime)</h4>
      <div class="list">${untimed.length ? untimed.map((t) => taskRow(t)).join('') : empty('Tasks without a time land here.')}</div>
      <h4>Schedule</h4>
      <div class="timeline">${timeline(date, tasks)}</div>
    </div>

    <div class="s4 stack">
      <div class="card"><h3>Mood &amp; affirmation</h3>
        <label class="lbl">Feeling<select class="field" data-change="day-field" data-field="mood">${options([['', 'How do you feel?'], ...MOODS.map((m) => [m, m])], day.mood)}</select></label>
        ${textField('Affirmation', 'affirmation', day.affirmation, 'I am calm, prepared and capable.')}
        <div class="form2 mt">${textField('Wake up', 'wake', day.wake, '', 'time')}${textField('Bed time', 'bed', day.bed, '', 'time')}</div>
      </div>
      <div class="card"><div class="spread"><h3>Hydration</h3><span class="muted">${day.water} / ${target} glasses</span></div>
        <div class="glasses">${Array.from({ length: Math.max(target, day.water) }, (_, i) => glass(i + 1, i < day.water)).join('')}</div>
      </div>
      <div class="card"><h3>Meal log</h3><div class="stack">${MEALS.map(([k, l]) => textField(l, `meals.${k}`, day.meals[k], 'What did you eat?')).join('')}</div></div>
      <div class="card"><h3>Workout &amp; notes</h3>
        ${textField('Workout / walk', 'workout', day.workout, 'e.g. 20 min walk, yoga')}
        <label class="lbl mt">Notes<textarea class="field" data-change="day-field" data-field="notes" placeholder="Thoughts, doubts to ask, ideas...">${esc(day.notes)}</textarea></label>
        <label class="lbl mt">Wins of the day<textarea class="field" data-change="day-field" data-field="wins" placeholder="What went well today?">${esc(day.wins)}</textarea></label>
      </div>
    </div>
  </div>`;
}

const setDate = (date) => { if (date) { view.date = date; rerender(); } };
onAction('day-shift', (el) => setDate(addDays(view.date, Number(el.dataset.n))));
onAction('day-pick', (el) => setDate(el.dataset.date));
onChange('day-set', (el) => setDate(el.value));
onChange('day-field', (el) => store.update((s) => {
  const rec = store.dayRecord(s, view.date);
  const [key, sub] = el.dataset.field.split('.');
  if (sub) rec[key][sub] = el.value;
  else rec[key] = el.value;
}, { silent: true }));
onAction('water', (el) => store.update((s) => {
  const rec = store.dayRecord(s, view.date);
  const n = Number(el.dataset.n);
  rec.water = rec.water === n ? n - 1 : n;
}));
