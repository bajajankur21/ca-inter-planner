// Week at a glance: hour-by-day time blocks, weekly donut, priority lists.
import { store } from '../store.js';
import { view, rerender } from '../router.js';
import { ring, barRow, empty, pct, todayKey, addDays, weekDays, fmt, hourLabel, hhmm, icon, onAction } from '../util.js';
import { tasksIn, doneCount, taskRow, taskChip, addTaskBtn, PRIORITIES, byPriority } from '../tasks.js';
import { habitTotals } from '../stats.js';

export const title = 'Visualise your week beautifully.';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5);

function grid(days, tasks) {
  const today = todayKey();
  const at = (d, h) => tasks.filter((t) => t.date === d && t.from && Math.max(5, Number(t.from.slice(0, 2))) === h);
  const head = days.map((d) => `<div class="wg-head${d === today ? ' today' : ''}"><span>${fmt(d, { weekday: 'short' })}</span><b>${fmt(d, { day: 'numeric' })}</b></div>`).join('');
  const anytime = days.map((d) => `<div class="wg-cell${d === today ? ' today' : ''}">${tasks.filter((t) => t.date === d && !t.from).map(taskChip).join('')}${addTaskBtn(d, '', `Add task on ${fmt(d, { weekday: 'long' })}`)}</div>`).join('');
  const rows = HOURS.map((h) => `<div class="wg-time">${hourLabel(h)}</div>${days.map((d) => `<div class="wg-cell${d === today ? ' today' : ''}">${at(d, h).map(taskChip).join('')}${addTaskBtn(d, hhmm(h), `Add task ${fmt(d, { weekday: 'long' })} ${hourLabel(h)}`)}</div>`).join('')}`).join('');
  return `<div class="weekgrid-wrap"><div class="weekgrid"><div class="wg-time"></div>${head}<div class="wg-time">Anytime</div>${anytime}${rows}</div></div>`;
}

export function render(el) {
  const days = weekDays(view.date, store.state.profile.weekStart);
  const tasks = tasksIn(days[0], days[6]);
  const done = doneCount(tasks);
  const top3 = tasks.filter((t) => t.top3);
  const habits = habitTotals(days.filter((d) => d <= todayKey()));

  el.innerHTML = `
  <div class="grid">
    <div class="card s3">
      <div class="datenav">
        <button class="icon-btn" data-act="week-shift" data-n="-7" aria-label="Previous week">${icon('left')}</button>
        <b class="grow center">${fmt(days[0], { day: 'numeric', month: 'short' })} - ${fmt(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}</b>
        <button class="icon-btn" data-act="week-shift" data-n="7" aria-label="Next week">${icon('right')}</button>
      </div>
      <div class="center mt">${ring(pct(done, tasks.length), `${done} / ${tasks.length}`, { big: true })}<small class="muted">Weekly task progress</small></div>
      <div class="stack mt">
        ${barRow('Tasks', pct(done, tasks.length), '#f2b8c2')}
        ${barRow('Habits', habits.pct, '#a9d3a5')}
        ${barRow('Top 3', pct(doneCount(top3), top3.length), '#f5d27a')}
      </div>
      <button class="btn mt" data-act="week-today">This week</button>
      ${PRIORITIES.map(([k, label]) => {
        const list = tasks.filter((t) => t.priority === k).sort(byPriority);
        return `<h4><span class="dot prio-${k}"></span> ${label} (${list.length})</h4><div class="list">${list.length ? list.map((t) => taskRow(t, { showDate: true })).join('') : empty('Nothing here')}</div>`;
      }).join('')}
    </div>
    <div class="card s9"><div class="spread"><h3>Weekly planner</h3>
      <div class="legend">${PRIORITIES.map(([k, l]) => `<span><i class="dot prio-${k}"></i>${l}</span>`).join('')}</div></div>
      ${grid(days, tasks)}
    </div>
  </div>`;
}

onAction('week-shift', (el) => { view.date = addDays(view.date, Number(el.dataset.n)); rerender(); });
onAction('week-today', () => { view.date = todayKey(); rerender(); });
