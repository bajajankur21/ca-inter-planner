// Habit tracker: monthly grid (up to 12 habits), KPI donuts, daily progress line, reflection.
import { store } from '../store.js';
import { view, rerender } from '../router.js';
import { esc, ring, barRow, empty, pct, todayKey, addDays, addMonths, monthDays, fmt, icon, uid, toast, onAction, onChange, plural } from '../util.js';
import { lineChart } from '../charts.js';
import { habitTotals, streak, weekHabits, sundayHabits, isSundayHabit, sundaysDone } from '../stats.js';
import { isSunday } from '../dayMode.js';

export const title = 'Small steps, strong streaks.';
const MAX_HABITS = { week: 12, sunday: 6 };
const WEEK_COLORS = ['var(--wk1)', 'var(--wk2)', 'var(--wk3)', 'var(--wk4)', 'var(--wk5)'];

const weeksOf = (days) => Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));

// Regular habits: every day, but Sunday is optional (soft "rest" cell, a tick is a bonus).
// Sunday habits: only Sunday cells; they never count as missed and can be paused.
function habitCell(h, d, today) {
  const sundayOnly = isSundayHabit(h);
  if (sundayOnly && !isSunday(d)) return '<span class="hcell off" aria-hidden="true"></span>';
  const on = h.days.includes(d);
  const rest = !sundayOnly && isSunday(d);
  const label = `${esc(h.name)} on ${fmt(d, { day: 'numeric', month: 'short' })}${rest ? ', Sunday, optional' : ''}`;
  return `<button class="hcell${on ? ' on' : ''}${d === today ? ' today' : ''}${rest ? ' rest' : ''}" data-act="habit-mark" data-id="${h.id}" data-date="${d}" ${d > today ? 'disabled' : ''} aria-pressed="${on}" aria-label="${label}">${on ? icon('check') : ''}</button>`;
}

function habitRow(h, weeks, today) {
  const sundayOnly = isSundayHabit(h);
  const name = esc(h.name);
  const badge = sundayOnly ? `<span class="tag">Sun</span> <span class="time">${plural(sundaysDone(h), 'Sunday')}</span>` : `<span class="time">${icon('flame')} ${streak(h.days)}</span>`;
  const pause = sundayOnly ? `<button class="icon-btn" data-act="habit-pause" data-id="${h.id}" aria-pressed="${Boolean(h.paused)}" aria-label="${h.paused ? 'Resume' : 'Pause'} ${name}" title="${h.paused ? 'Paused: resume' : 'Pause this Sunday habit'}">${icon(h.paused ? 'right' : 'moon')}</button>` : '';
  return `<tr class="${sundayOnly ? 'sunrow' : ''}${h.paused ? ' paused' : ''}"><th class="hname"><div class="hn">
      <button class="linklike" data-act="habit-rename" data-id="${h.id}" title="Rename">${name}</button>
      ${badge}${pause}
      <button class="icon-btn" data-act="habit-del" data-id="${h.id}" aria-label="Delete ${name}">${icon('x')}</button></div></th>
      ${weeks.map((w, i) => w.map((d) => `<td style="--wk:${WEEK_COLORS[i]}">${habitCell(h, d, today)}</td>`).join('')).join('')}</tr>`;
}

function kpis(days, today) {
  const elapsed = days.filter((d) => d <= today);
  const month = habitTotals(days);
  const soFar = habitTotals(elapsed);
  const inMonth = today.startsWith(days[0].slice(0, 7));
  const todayT = habitTotals(inMonth ? [today] : []);
  const last7 = habitTotals(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
  const card = (r, label) => `<div class="card s2 center kpi">${r}<small>${label}</small></div>`;
  return [
    card(ring(soFar.pct, `${soFar.pct}%`, { color: '#f2b8c2' }), 'Monthly momentum'),
    card(ring(todayT.pct, !inMonth ? '-' : isSunday(today) ? 'Rest' : `${todayT.pct}%`, { color: '#f5d27a' }), 'Current day'),
    card(ring(last7.pct, `${last7.pct}%`, { color: '#a9d3a5' }), 'Last 7 days'),
    card(ring(month.pct, `${month.pct}%`, { color: '#c3b3e3' }), 'Monthly progress'),
    card(ring(100, String(month.done), { color: '#f4bf9a' }), 'Total completed'),
    card(ring(month.total ? 100 - month.pct : 0, String(month.total - month.done), { color: '#9cc6e4' }), 'Remaining'),
  ].join('');
}

function habitGrid(days, today) {
  const weeks = weeksOf(days);
  const head = weeks.map((w, i) => `<th colspan="${w.length}" class="wkband" style="--wk:${WEEK_COLORS[i]}">Week ${i + 1}</th>`).join('');
  const dayHead = weeks.map((w, i) => w.map((d) => `<th class="hd" style="--wk:${WEEK_COLORS[i]}"><span>${fmt(d, { weekday: 'narrow' })}</span>${Number(d.slice(8))}</th>`).join('')).join('');
  const rows = [...weekHabits(), ...sundayHabits()].map((h) => habitRow(h, weeks, today)).join('');
  const weekPct = weeks.map((w, i) => `<td colspan="${w.length}" class="wkpct" style="--wk:${WEEK_COLORS[i]}">${habitTotals(w.filter((d) => d <= today)).pct}%</td>`).join('');
  return `<div class="tablewrap"><table class="habitgrid">
    <thead><tr><th></th>${head}</tr><tr><th class="hname">Daily habits</th>${dayHead}</tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><th class="hname">Weekly progress</th>${weekPct}</tr></tfoot></table></div>`;
}

export function render(el) {
  const s = store.state;
  const ym = view.habitMonth;
  const days = monthDays(ym);
  const today = todayKey();
  const notes = s.habitNotes[ym] || {};
  const daily = days.map((d) => (d > today || isSunday(d) ? null : habitTotals([d]).pct)); // Sunday is a rest day: a gap, not a dip
  const workDays = days.filter((d) => !isSunday(d));
  const top = weekHabits().map((h) => ({ h, n: workDays.filter((d) => h.days.includes(d)).length })).sort((a, b) => b.n - a.n);

  el.innerHTML = `
  <div class="sect">
    <div class="datenav">
      <button class="icon-btn" data-act="habit-month" data-n="-1" aria-label="Previous month">${icon('left')}</button>
      <h3>${fmt(`${ym}-01`, { month: 'long', year: 'numeric' })}</h3>
      <button class="icon-btn" data-act="habit-month" data-n="1" aria-label="Next month">${icon('right')}</button>
    </div>
    <div class="addrow habit-add"><input class="field" id="newHabit" placeholder="New habit, e.g. 6 hours study" aria-label="New habit">
      <select class="field" id="newHabitWhen" aria-label="When"><option value="week">Every day (Sunday optional)</option><option value="sunday">Sundays only</option></select>
      <button data-act="habit-add">${icon('plus')} Habit</button></div>
  </div>
  ${s.habits.length ? `
  <div class="grid">${kpis(days, today)}</div>
  <div class="grid mt">
    <div class="card s9"><h3>Daily progress</h3>${lineChart(daily, days.map((d) => String(Number(d.slice(8)))))}</div>
    <div class="card s3"><h3>Top habits</h3><div class="stack">${top.slice(0, 6).map(({ h, n }) => barRow(h.name, pct(n, workDays.length), '#f2b8c2', String(n))).join('')}</div></div>
    <div class="card s12">${habitGrid(days, today)}</div>
  </div>` : empty('Add your first habit above: study hours, revision, water, sleep by 11, no phone after 10...')}
  <div class="grid mt">
    <div class="card s6"><h3>Habit reflection</h3><textarea class="field" data-change="habit-note" data-field="reflection" placeholder="What helped? What got in the way?">${esc(notes.reflection)}</textarea></div>
    <div class="card s6"><h3>What I learned this month</h3><textarea class="field" data-change="habit-note" data-field="learned" placeholder="One lesson to carry into next month">${esc(notes.learned)}</textarea></div>
  </div>`;
}

const findHabit = (s, id) => s.habits.find((h) => h.id === id);

/** Add a regular ('week') or Sunday-only habit. Shared with the Sunday dashboard. Returns false when that set is full. */
export function addHabit(name, schedule = 'week') {
  const count = (schedule === 'sunday' ? sundayHabits() : weekHabits()).length;
  if (count >= MAX_HABITS[schedule]) {
    toast(`Up to ${MAX_HABITS[schedule]} ${schedule === 'sunday' ? 'Sunday ' : ''}habits keeps it doable. Remove one first.`);
    return false;
  }
  store.update((s) => s.habits.push({ id: uid(), name, days: [], ...(schedule === 'sunday' && { schedule }) }));
  return true;
}

onAction('habit-month', (el) => { view.habitMonth = addMonths(view.habitMonth, Number(el.dataset.n)); rerender(); });
onAction('habit-add', () => {
  const name = document.getElementById('newHabit').value.trim();
  if (name) addHabit(name, document.getElementById('newHabitWhen').value);
});
// Sunday habits only: a paused one is hidden from the Sunday check-in and never counts.
onAction('habit-pause', (el) => store.update((s) => {
  const h = findHabit(s, el.dataset.id);
  if (h && isSundayHabit(h)) h.paused = !h.paused;
}));
onAction('habit-mark', (el) => store.update((s) => {
  const h = findHabit(s, el.dataset.id);
  const d = el.dataset.date;
  h.days = h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d];
}));
onAction('habit-rename', (el) => {
  const h = findHabit(store.state, el.dataset.id);
  const name = prompt('Rename habit', h.name)?.trim();
  if (name) store.update((s) => { findHabit(s, h.id).name = name; });
});
onAction('habit-del', (el) => {
  if (!confirm('Delete this habit and all its check-ins?')) return;
  store.update((s) => { s.habits = s.habits.filter((h) => h.id !== el.dataset.id); });
});
onChange('habit-note', (el) => store.update((s) => {
  s.habitNotes[view.habitMonth] = { ...s.habitNotes[view.habitMonth], [el.dataset.field]: el.value };
}, { silent: true }));
