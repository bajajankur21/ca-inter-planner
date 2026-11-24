// Analytics: study hours, focus by paper, habit consistency, task completion.
import { store } from '../store.js';
import { esc, barRow, empty, pct, todayKey, addDays, monthDays, fmt } from '../util.js';
import { barChart, lineChart } from '../charts.js';
import { minutesOn, minutesForPaper, hoursLabel, syllabusPct, habitTotals } from '../stats.js';
import { tasksOn, doneCount } from '../tasks.js';

export const title = 'Look how far the little steps go.';

const summaryCard = (value, label) => `<div class="card s3"><strong class="bignum">${esc(value)}</strong><div class="muted">${esc(label)}</div></div>`;

export function render(el) {
  const s = store.state;
  const today = todayKey();
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const hours = last14.map((d) => ({ label: fmt(d, { day: 'numeric' }), value: Math.round((minutesOn(d) / 60) * 10) / 10, highlight: d === today }));
  const totalMin = s.sessions.reduce((a, x) => a + x.minutes, 0);
  const studyDays = new Set(s.sessions.map((x) => x.date)).size;
  const best = Object.entries(s.sessions.reduce((m, x) => ({ ...m, [x.date]: (m[x.date] || 0) + x.minutes }), {})).sort((a, b) => b[1] - a[1])[0];
  const caught = s.sessions.reduce((a, x) => a + (x.distractions || 0), 0);
  const paperMax = Math.max(1, ...s.papers.map((p) => minutesForPaper(p.id)));
  const ym = today.slice(0, 7);
  const monthSoFar = monthDays(ym).filter((d) => d <= today);
  const taskPcts = last14.map((d) => { const l = tasksOn(d); return l.length ? pct(doneCount(l), l.length) : null; });

  el.innerHTML = `
  <div class="grid">
    ${summaryCard(hoursLabel(totalMin), 'Total focused')}
    ${summaryCard(String(s.sessions.length), 'Focus sessions')}
    ${summaryCard(studyDays ? hoursLabel(Math.round(totalMin / studyDays)) : '0m', 'Average per study day')}
    ${summaryCard(best ? `${hoursLabel(best[1])}` : '-', best ? `Best day, ${fmt(best[0], { day: 'numeric', month: 'short' })}` : 'Best day')}
  </div>
  <div class="grid mt">
    <div class="card s8"><h3>Study hours, last 14 days</h3>${totalMin ? barChart(hours, { unit: 'h' }) : empty('Finish a focus session to start your chart.')}</div>
    <div class="card s4"><h3>Focus by paper</h3><div class="stack">${s.papers.map((p) => barRow(p.short, pct(minutesForPaper(p.id), paperMax), p.color, hoursLabel(minutesForPaper(p.id)))).join('')}</div>
      <p class="muted">Pick a paper in the focus room to fill this in.</p></div>
    <div class="card s6"><h3>Habit consistency this month</h3>${s.habits.length ? `<div class="stack">${s.habits.map((h) => {
      const n = monthSoFar.filter((d) => h.days.includes(d)).length;
      return barRow(h.name, pct(n, monthSoFar.length), '#a9d3a5', `${n}/${monthSoFar.length}`);
    }).join('')}</div><p class="muted">Overall ${habitTotals(monthSoFar).pct}% this month.</p>` : empty('Add habits to see consistency.')}</div>
    <div class="card s6"><h3>Tasks done per day (%)</h3>${taskPcts.some((v) => v != null) ? lineChart(taskPcts, last14.map((d) => fmt(d, { day: 'numeric' }))) : empty('Plan tasks to see your completion trend.')}
      <p class="muted">Syllabus ticked: ${syllabusPct()}%. Distractions the owl caught: ${caught}.</p></div>
  </div>`;
}
