// Home dashboard: today at a glance, exam countdown, mini owl.
import { store } from '../store.js';
import { go } from '../router.js';
import { createOwl } from '../owl.js';
import * as timer from '../focusTimer.js';
import { $, esc, ring, barRow, empty, pct, todayKey, weekDays, fmt, onAction, onChange, toast, icon, kpiCard } from '../util.js';
import { tasksOn, doneCount, taskRow, addTask, overdueCard } from '../tasks.js';
import { minutesOn, hoursLabel, syllabusPct, paperPct, daysToExam, habitTotals, streak, weekHabits, goalHoursFor } from '../stats.js';
import { dayMode, ofTheDay, MODES, SATURDAY, SUNDAY } from '../dayMode.js';
import { renderSunday } from './sunday.js';

// Weekday, Saturday (light study) and Sunday (rest) each get their own title; app.js calls this on every render.
export const title = () => MODES[dayMode(todayKey())].title;

const metric = kpiCard;

function heroHtml() {
  const { name } = store.state.profile;
  const days = daysToExam();
  const sat = dayMode(todayKey()) === SATURDAY ? MODES[SATURDAY] : null;
  const headline = sat ? ofTheDay(sat.headlines) : days == null ? 'Make room for the CA you are becoming.' : days > 0 ? `${days} days to go. You have got this.` : days === 0 ? 'It is exam day. Breathe. You prepared for this.' : 'Exam done! Time to set the next target.';
  return `<div class="hero">
    <div class="eyebrow">${sat ? sat.eyebrow : 'Welcome back'}${name ? `, ${esc(name)}` : ''}</div>
    <h3>${headline}</h3>
    <div class="muted">${sat ? sat.note : 'Plans, papers, habits and focus in one cosy place.'}</div>
    <div class="slogan">${sat ? sat.slogan : 'I think I can, I know I can.'}</div>
    ${days == null ? '<a class="btn primary mt" href="#settings">Set your exam date</a>' : ''}
  </div>`;
}

function weekStrip(today) {
  return weekDays(today, store.state.profile.weekStart).map((d) => {
    const list = tasksOn(d);
    return `<button class="calday${d === today ? ' today' : ''}" data-act="open-day" data-date="${d}">
      <span>${fmt(d, { weekday: 'short' })}</span><b>${fmt(d, { day: 'numeric' })}</b>
      <small>${list.length ? `${doneCount(list)}/${list.length}` : ''}</small></button>`;
  }).join('');
}

function owlCorner() {
  const st = timer.status();
  const running = st.running;
  const text = running ? `${timer.MODES[st.mode]} in progress: <b id="dashTimer">${timer.clock(st.remaining)}</b> left. The owl is watching.` : 'Your owl is napping. Start a focus session and it wakes up to keep you company.';
  return `<div class="minowl"><div class="owlhost${running ? ' lit' : ''}" id="dashOwl"></div>
    <div class="stack"><span class="muted">${text}</span><button class="btn primary" data-act="go" data-page="focus">${running ? 'Back to the room' : 'Start focusing'}</button></div></div>`;
}

export function render(el) {
  const s = store.state;
  const today = todayKey();
  if (dayMode(today) === SUNDAY) return renderSunday(el);
  const tt = tasksOn(today);
  const done = doneCount(tt);
  const habits = weekHabits();
  const habitsToday = habitTotals([today]);
  const mins = minutesOn(today);
  const goalHours = goalHoursFor(today);
  const goalMins = goalHours * 60;
  const syl = syllabusPct();
  const top3 = tt.filter((t) => t.top3);

  el.innerHTML = `${heroHtml()}
  <div class="grid">
    ${overdueCard()}
    ${metric(ring(pct(done, tt.length), `${pct(done, tt.length)}%`), `${done}/${tt.length}`, "Today's tasks")}
    ${metric(ring(habitsToday.pct, `${habitsToday.pct}%`, { color: '#a9d3a5' }), `${habitsToday.done}/${habits.length}`, 'Habits today')}
    ${metric(ring(pct(mins, goalMins), hoursLabel(mins), { color: '#c3b3e3' }), hoursLabel(mins), `Focus today, goal ${goalHours}h`)}
    ${metric(ring(syl, `${syl}%`, { color: '#f5d27a' }), `${syl}%`, 'Syllabus ticked')}

    <div class="card s5"><h3>Today's top 3</h3>
      <div class="list">${top3.length ? top3.map((t) => taskRow(t)).join('') : empty('Pick the three things that would make today a win.')}</div>
      <div class="addrow"><input class="field" id="quickTop3" placeholder="Add a top priority for today..." aria-label="New top priority"><button data-act="quick-top3" aria-label="Add">${icon('plus')}</button></div>
    </div>
    <div class="card s7"><div class="spread"><h3>Today's schedule</h3><button class="btn" data-act="open-day" data-date="${today}">Open daily planner</button></div>
      <div class="list">${tt.length ? tt.map((t) => taskRow(t)).join('') : empty('Nothing planned yet. Add a task from the + button above.')}</div>
    </div>

    <div class="card s4"><h3>This week</h3><div class="weekstrip">${weekStrip(today)}</div></div>
    <div class="card s4"><div class="spread"><h3>Habit check-in</h3><a class="btn" href="#habits">Tracker</a></div>
      <div class="list">${habits.length ? habits.slice(0, 6).map((h) => `<label class="item"><input type="checkbox" data-change="habit-today" data-id="${h.id}" ${h.days.includes(today) ? 'checked' : ''}><span class="grow">${esc(h.name)}</span><span class="time">${icon('flame')} ${streak(h.days)}</span></label>`).join('') : empty('Add habits in the habit tracker to check in here.')}</div>
    </div>
    <div class="card s4"><h3>Focus corner</h3>${owlCorner()}</div>

    <div class="card s12"><div class="spread"><h3>Papers</h3><a class="btn" href="#study">Revision tracker</a></div>
      <div class="papergrid">${s.papers.map((p) => barRow(`${p.short} ${p.name}`, paperPct(p), p.color)).join('')}</div>
    </div>
  </div>`;

  const owl = createOwl($('#dashOwl', el), { label: 'Study owl. Press to visit the focus room.', onPet: () => go('focus') });
  const st = timer.status();
  owl.setState(st.running ? (st.mode === 'focus' ? 'watch' : 'break') : 'sleep');
}

timer.onTimer((type, detail) => {
  const clockEl = document.getElementById('dashTimer');
  const onHome = (location.hash.slice(1) || 'home') === 'home';
  if (type === 'tick') {
    if (clockEl) clockEl.textContent = timer.clock(detail.left);
  } else if (onHome) {
    render(document.getElementById('page-home'));
  }
});

onAction('quick-top3', () => {
  const input = document.getElementById('quickTop3');
  const title = input.value.trim();
  if (!title) return;
  addTask({ title, priority: 'high', top3: true });
  toast('Added to today\'s top 3');
});
onChange('habit-today', (el) => store.update((s) => {
  const h = s.habits.find((x) => x.id === el.dataset.id);
  const today = todayKey();
  if (h) h.days = el.checked ? [...new Set([...h.days, today])] : h.days.filter((d) => d !== today);
}));
