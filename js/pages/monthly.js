// Month at a glance: calendar with tasks, monthly progress, upcoming events.
import { store } from '../store.js';
import { view, rerender } from '../router.js';
import { ring, barRow, empty, pct, todayKey, addDays, addMonths, monthDays, monthGrid, weekdayLabels, fmt, icon, onAction } from '../util.js';
import { tasksIn, tasksOn, doneCount, taskRow, taskChip, addTaskBtn } from '../tasks.js';
import { habitTotals, syllabusPct, isAchieved } from '../stats.js';

export const title = 'A full overview of every month.';
const MAX_CHIPS = 3;

function calendar(ym) {
  const today = todayKey();
  const ws = store.state.profile.weekStart;
  const cells = monthGrid(ym, ws).map((d) => {
    if (!d) return '<div class="mcell blank"></div>';
    const list = tasksOn(d).sort((a, b) => Number(b.event) - Number(a.event));
    const more = list.length - MAX_CHIPS;
    return `<div class="mcell${d === today ? ' today' : ''}">
      <div class="spread"><button class="mday" data-act="open-day" data-date="${d}" aria-label="Open ${fmt(d, { day: 'numeric', month: 'long' })}">${Number(d.slice(8))}</button>${addTaskBtn(d, '', `Add task on ${fmt(d, { day: 'numeric', month: 'long' })}`)}</div>
      ${list.slice(0, MAX_CHIPS).map(taskChip).join('')}
      ${more > 0 ? `<button class="more" data-act="open-day" data-date="${d}">+${more} more</button>` : ''}
    </div>`;
  }).join('');
  return `<div class="monthgrid">${weekdayLabels(ws).map((w) => `<div class="mhead">${w}</div>`).join('')}${cells}</div>`;
}

export function render(el) {
  const ym = view.month;
  const days = monthDays(ym);
  const tasks = tasksIn(days[0], days.at(-1));
  const done = doneCount(tasks);
  const today = todayKey();
  const habits = habitTotals(days.filter((d) => d <= today));
  const yearGoals = store.state.goals.filter((g) => (g.month || '').startsWith(ym.slice(0, 4)));
  const upcoming = tasksIn(today, addDays(today, 30)).filter((t) => t.event && !t.done);

  el.innerHTML = `
  <div class="grid">
    <div class="card s3">
      <div class="datenav">
        <button class="icon-btn" data-act="month-shift" data-n="-1" aria-label="Previous month">${icon('left')}</button>
        <b class="grow center">${fmt(`${ym}-01`, { month: 'long', year: 'numeric' })}</b>
        <button class="icon-btn" data-act="month-shift" data-n="1" aria-label="Next month">${icon('right')}</button>
      </div>
      <div class="center mt">${ring(pct(done, tasks.length), `${done} / ${tasks.length}`, { big: true })}<small class="muted">Monthly task progress</small></div>
      <h4>Progress</h4>
      <div class="stack">
        ${barRow('Monthly tasks', pct(done, tasks.length), '#f2b8c2')}
        ${barRow('Habits', habits.pct, '#a9d3a5')}
        ${barRow('Yearly goals', pct(yearGoals.filter(isAchieved).length, yearGoals.length), '#c3b3e3')}
        ${barRow('Syllabus', syllabusPct(), '#f5d27a')}
      </div>
      <button class="btn mt" data-act="month-today">This month</button>
      <h4>Upcoming events (30 days)</h4>
      <div class="list">${upcoming.length ? upcoming.map((t) => taskRow(t, { showDate: true })).join('') : empty('Tick "show as event" on a task (mock tests, classes, exam dates) to see it here.')}</div>
    </div>
    <div class="card s9"><h3>${fmt(`${ym}-01`, { month: 'long', year: 'numeric' })}</h3>${calendar(ym)}</div>
  </div>`;
}

onAction('month-shift', (el) => { view.month = addMonths(view.month, Number(el.dataset.n)); rerender(); });
onAction('month-today', () => { view.month = todayKey().slice(0, 7); rerender(); });
