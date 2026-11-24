// Boot: routing, header, mobile drawer, re-render on every store change.
import { $, $$, onAction, wireActions, fmt, todayKey } from './util.js';
import { store } from './store.js';
import { setRenderer } from './router.js';
import { daysToExam } from './stats.js';
import { startSync, paintSync } from './sync.js';
import * as home from './pages/dashboard.js';
import * as tracker from './pages/tracker.js';
import * as daily from './pages/daily.js';
import * as weekly from './pages/weekly.js';
import * as monthly from './pages/monthly.js';
import * as study from './pages/study.js';
import * as focus from './pages/focus.js';
import * as habits from './pages/habits.js';
import * as goals from './pages/goals.js';
import * as analytics from './pages/analytics.js';
import * as settings from './pages/settings.js';

const pages = { home, tracker, daily, weekly, monthly, study, focus, habits, goals, analytics, settings };

const QUOTES = [
  ['I think I can, I know I can.', 'One step at a time.'],
  ['Small daily progress beats last-minute panic.', 'Consistency wins.'],
  ['Revise like the exam is tomorrow.', 'R1, R2, R3.'],
  ['Discipline is choosing what you want most over what you want now.', 'Future CA.'],
  ['Every chapter you finish is one less to fear.', 'Keep ticking.'],
  ['Practice the questions, not just the theory.', 'MTPs and RTPs.'],
  ['Rest is part of the plan, not a break from it.', 'Be kind to yourself.'],
];

const currentPage = () => (pages[location.hash.slice(1)] ? location.hash.slice(1) : 'home');

function renderHeader() {
  const today = todayKey();
  $('#todayLabel').textContent = fmt(today, { weekday: 'long', day: 'numeric', month: 'long' });
  const days = daysToExam();
  const pill = $('#countdownPill');
  pill.textContent = days == null ? 'Set your exam date' : days > 0 ? `${days} days to CA Inter` : days === 0 ? 'Exam day. You have got this!' : 'Exam done. Set the next one';
  const [quote, sub] = QUOTES[new Date().getDate() % QUOTES.length];
  $('#quote').innerHTML = `"${quote}"<small>${sub}</small>`;
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
  $('#pageTitle').textContent = pages[name].title;
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

// Re-render shortly after midnight so "today" moves on its own if the tab stays open.
let lastDay = todayKey();
setInterval(() => {
  if (todayKey() !== lastDay) { lastDay = todayKey(); render(); }
}, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
