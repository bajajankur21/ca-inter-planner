// Sunday dashboard: a rest day with its own content, in the same design language as the weekday dashboard.
// No study target, a separate set of Sunday habits, a look back at the week and a peek at the next one.
import { store } from '../store.js';
import { createOwl } from '../owl.js';
import { $, esc, ring, barRow, empty, pct, todayKey, addDays, fmt, icon, onAction, toast, kpiCard, plural } from '../util.js';
import { tasksOn, tasksIn, doneCount, taskRow, addTask, overdueCard } from '../tasks.js';
import { minutesOn, hoursLabel, habitTotals, sundayHabits, sundaysDone, goalHoursFor } from '../stats.js';
import { MODES, SUNDAY, ofTheDay } from '../dayMode.js';
import { addHabit } from './habits.js';

const M = MODES[SUNDAY];
const IDEAS_SHOWN = 4;
const lastDays = (today, n) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));

function heroHtml() {
  const { name } = store.state.profile;
  return `<div class="hero">
    <div class="eyebrow">${M.eyebrow}${name ? `, ${esc(name)}` : ''}</div>
    <h3>${ofTheDay(M.headlines)}</h3>
    <div class="muted">${M.note}</div>
    <div class="slogan">${M.slogan}</div>
  </div>`;
}

function habitItem(h, today) {
  const name = esc(h.name);
  const pause = `<button class="icon-btn" data-act="habit-pause" data-id="${h.id}" aria-pressed="${Boolean(h.paused)}" aria-label="${h.paused ? 'Resume' : 'Pause'} ${name}">${icon(h.paused ? 'right' : 'moon')}</button>`;
  if (h.paused) return `<div class="item muted-item"><span class="grow">${name}</span><span class="tag">Paused</span>${pause}</div>`;
  return `<label class="item"><input type="checkbox" data-change="habit-today" data-id="${h.id}" ${h.days.includes(today) ? 'checked' : ''}>
    <span class="grow">${name}</span><span class="time">${plural(sundaysDone(h), 'Sunday')}</span>${pause}</label>`;
}

/** The last 7 days, computed once for the donuts and the review card. */
function weekStats(today) {
  const week = lastDays(today, 7);
  const tasks = tasksIn(week[0], today);
  const minutes = week.reduce((acc, d) => acc + minutesOn(d), 0);
  const goal = week.reduce((acc, d) => acc + goalHoursFor(d) * 60, 0);
  return { tasks: tasks.length, done: doneCount(tasks), minutes, focusPct: pct(minutes, goal), habits: habitTotals(week) };
}

function weekReview(wk) {
  return `<div class="stack">
    ${barRow('Tasks done', pct(wk.done, wk.tasks), '#f2b8c2', `${wk.done}/${wk.tasks}`)}
    ${barRow('Weekday habits', wk.habits.pct, '#a9d3a5', `${wk.habits.pct}%`)}
    ${barRow('Focus vs goal', wk.focusPct, '#c3b3e3', hoursLabel(wk.minutes))}
  </div><p class="muted">${wk.done ? `${plural(wk.done, 'task')} finished in the last 7 days. Be proud of that.` : 'A fresh week starts tomorrow.'}</p>`;
}

function weekAhead(today) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  return `<div class="weekstrip">${days.map((d) => {
    const n = tasksOn(d).length;
    return `<button class="calday" data-act="open-day" data-date="${d}"><span>${fmt(d, { weekday: 'short' })}</span><b>${fmt(d, { day: 'numeric' })}</b><small>${n || ''}</small></button>`;
  }).join('')}</div>
  <div class="row mt"><button class="btn" data-act="task-new" data-date="${days[0]}">${icon('plus')} Plan ${fmt(days[0], { weekday: 'long' })}</button></div>`;
}

function ideasHtml() {
  const start = new Date().getDate() % M.ideas.length;
  const picks = Array.from({ length: IDEAS_SHOWN }, (_, i) => M.ideas[(start + i) % M.ideas.length]);
  return `<div class="list">${picks.map((idea) => `<div class="item"><span class="grow">${esc(idea)}</span></div>`).join('')}</div>`;
}

export function renderSunday(el) {
  const today = todayKey();
  const tasks = tasksOn(today);
  const all = sundayHabits();
  const active = all.filter((h) => !h.paused);
  const ticked = active.filter((h) => h.days.includes(today)).length;
  const wk = weekStats(today);

  el.innerHTML = `${heroHtml()}
  <div class="grid sunday">
    ${overdueCard()}
    ${kpiCard(ring(100, 'Rest', { color: '#a9d3a5' }), '0h', 'Study target today')}
    ${kpiCard(ring(pct(ticked, active.length), `${pct(ticked, active.length)}%`, { color: '#f5d27a' }), `${ticked}/${active.length}`, 'Sunday habits')}
    ${kpiCard(ring(pct(wk.done, wk.tasks), `${pct(wk.done, wk.tasks)}%`), `${wk.done}/${wk.tasks}`, 'Tasks done this week')}
    ${kpiCard(ring(wk.focusPct, hoursLabel(wk.minutes), { color: '#c3b3e3' }), hoursLabel(wk.minutes), 'Focus this week')}

    <div class="card s5"><h3>Only if it matters</h3>
      <p class="muted">Important revision, urgent backlog or something that truly cannot wait. Everything else can move to Monday.</p>
      <div class="list">${tasks.length ? tasks.map((t) => taskRow(t, { reschedule: !t.done })).join('') : empty('Nothing planned. That is the plan.')}</div>
      <div class="addrow"><input class="field" id="sundayTask" placeholder="Add an important revision or urgent task..." aria-label="New important task"><button data-act="sunday-task" aria-label="Add">${icon('plus')}</button></div>
    </div>
    <div class="card s7"><h3>Sunday habits</h3>
      <p class="muted">Your weekday habits and streaks are resting today. Skipping a Sunday habit is fine too: it never counts as missed.</p>
      <div class="list">${all.length ? all.map((h) => habitItem(h, today)).join('') : empty('Add a few gentle Sunday habits: long walk, call family, plan the week, early night.')}</div>
      <div class="addrow"><input class="field" id="sundayHabit" placeholder="Add a Sunday habit..." aria-label="New Sunday habit"><button data-act="sunday-habit-add" aria-label="Add Sunday habit">${icon('plus')}</button></div>
    </div>

    <div class="card s4"><h3>Your week in review</h3>${weekReview(wk)}</div>
    <div class="card s4"><h3>The week ahead</h3>${weekAhead(today)}</div>
    <div class="card s4"><h3>Recharge ideas</h3>${ideasHtml()}
      <div class="minowl mt"><div class="owlhost" id="sunOwl"></div><span class="muted">Your owl is off duty today too.</span></div></div>
  </div>`;

  const owl = createOwl($('#sunOwl', el), { label: 'Sleeping owl. It is resting today.', onPet: () => toast('Shh... the owl is resting today.') });
  owl.setState('sleep');
}

onAction('sunday-task', () => {
  const title = $('#sundayTask')?.value.trim();
  if (!title) return;
  addTask({ title, priority: 'highest', type: 'Revision' });
  toast('Added. Keep it short, then get back to resting.');
});
onAction('sunday-habit-add', () => {
  const name = $('#sundayHabit')?.value.trim();
  if (name && addHabit(name, 'sunday')) toast('Sunday habit added. It only shows up on Sundays.');
});
