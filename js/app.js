// Boot: routing, header, mobile drawer, re-render on every store change.
import { $, $$, onAction, wireActions, fmt, todayKey } from './util.js';
import { store } from './store.js';
import { setRenderer } from './router.js';
import { daysToExam } from './stats.js';
import { overdueTasks } from './tasks.js';
import { dayMode, ofTheDay, MODES } from './dayMode.js';
import { startSync, paintSync } from './sync.js';
import { startAssistant } from './assistant.js';
import * as home from './pages/dashboard.js';
import * as tracker from './pages/tracker.js';
import * as reminders from './pages/reminders.js';
import * as daily from './pages/daily.js';
import * as weekly from './pages/weekly.js';
import * as monthly from './pages/monthly.js';
import * as study from './pages/study.js';
import * as focus from './pages/focus.js';
import * as habits from './pages/habits.js';
import * as skills from './pages/skills.js';
import * as goals from './pages/goals.js';
import * as analytics from './pages/analytics.js';
import * as settings from './pages/settings.js';

const pages = { home, tracker, reminders, daily, weekly, monthly, study, focus, habits, skills, goals, analytics, settings };

const currentPage = () => (pages[location.hash.slice(1)] ? location.hash.slice(1) : 'home');

function renderHeader() {
  const today = todayKey();
  const mode = dayMode(today);
  document.body.dataset.mode = mode;
  $('#todayLabel').textContent = fmt(today, { weekday: 'long', day: 'numeric', month: 'long' });
  const days = daysToExam();
  const pill = $('#countdownPill');
  pill.textContent = days == null ? 'Set your exam date' : days > 0 ? `${days} days to CA Inter` : days === 0 ? 'Exam day. You have got this!' : 'Exam done. Set the next one';
  const [quote, sub] = ofTheDay(MODES[mode].quotes);
  $('#quote').innerHTML = `"${quote}"<small>${sub}</small>`;
  const late = overdueTasks().length;
  const overdue = $('#overduePill');
  overdue.hidden = !late;
  overdue.textContent = `${late} overdue`;
  overdue.setAttribute('aria-label', `${late} overdue or pending ${late === 1 ? 'task' : 'tasks'}. Show them.`);
}

/** Remember which control had focus so a re-render does not throw keyboard users back to the top. */
function focusSignature() {
  const el = document.activeElement;
  if (!el || el === document.body || !el.closest('main')) return null;
  const attrs = ['data-act', 'data-change', 'data-id', 'data-date', 'data-k', 'data-field', 'id'];
  const sel = attrs.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join('');
  return sel ? `${el.tagName.toLowerCase()}${sel}` : null;
}

function render() {
  const name = currentPage();
  const sig = focusSignature();
  $$('.page').forEach((s) => s.classList.toggle('active', s.id === `page-${name}`));
  $$('[data-p]').forEach((a) => {
    const on = a.dataset.p === name;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const { title } = pages[name];
  $('#pageTitle').textContent = typeof title === 'function' ? title() : title; // the dashboard's title follows the day mode
  renderHeader();
  pages[name].render($(`#page-${name}`));
  paintSync();
  if (sig) document.querySelector(sig)?.focus({ preventScroll: true });
}

function toggleNav(open = !document.body.classList.contains('nav-open')) {
  document.body.classList.toggle('nav-open', open);
  $('[data-act="nav-toggle"][aria-expanded]')?.setAttribute('aria-expanded', String(open));
}

window.addEventListener('hashchange', () => {
  toggleNav(false);
  render();
  window.scrollTo(0, 0);
});
onAction('nav-toggle', () => toggleNav());
store.subscribe(render);
setRenderer(render);
wireActions();
render();
startSync();
startAssistant();

// Time moves on without any edit: re-render after midnight ("today") and when a task slips into overdue.
let lastDay = todayKey();
let lastLate = overdueTasks().length;
setInterval(() => {
  const late = overdueTasks().length;
  if (todayKey() === lastDay && late === lastLate) return;
  lastDay = todayKey();
  lastLate = late;
  render();
}, 30000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
