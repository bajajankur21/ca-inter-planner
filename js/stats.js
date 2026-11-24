// Derived numbers used by several pages. Pure reads of the store; no rendering here.
import { store } from './store.js';
import { todayKey, dateKey, daysBetween, pct } from './util.js';

export const STAGES = [['read', 'Read'], ['r1', 'R1'], ['r2', 'R2'], ['r3', 'R3'], ['mtp', 'MTP / Qs']];

const sum = (list, fn) => list.reduce((acc, x) => acc + fn(x), 0);

// ---------- focus ----------
export const sessionsOn = (key) => store.state.sessions.filter((s) => s.date === key);
export const minutesOn = (key) => sum(sessionsOn(key), (s) => s.minutes);
export const minutesForPaper = (paperId) => sum(store.state.sessions.filter((s) => s.paper === paperId), (s) => s.minutes);
export const hoursLabel = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60 ? `${min % 60}m` : ''}`.trim() : `${min}m`);

// ---------- syllabus ----------
const marksDone = (chapter) => STAGES.filter(([k]) => chapter.marks?.[k]).length;
export const paperPct = (paper) => pct(sum(paper.chapters, marksDone), paper.chapters.length * STAGES.length);
export function syllabusPct() {
  const { papers } = store.state;
  return pct(sum(papers, (p) => sum(p.chapters, marksDone)), sum(papers, (p) => p.chapters.length) * STAGES.length);
}
export const stagePct = (paper, stage) => pct(paper.chapters.filter((c) => c.marks?.[stage]).length, paper.chapters.length);

export function daysToExam() {
  const { examDate } = store.state.profile;
  return examDate ? daysBetween(todayKey(), examDate) : null;
}

// ---------- habits ----------
/** Done check-ins and possible check-ins for the given day keys. */
export function habitTotals(keys) {
  const { habits } = store.state;
  const done = sum(habits, (h) => keys.filter((k) => h.days.includes(k)).length);
  return { done, total: habits.length * keys.length, pct: pct(done, habits.length * keys.length) };
}

export function streak(days) {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dateKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ---------- goals ----------
export const goalPct = (g) => (g.steps?.length ? pct(g.steps.filter((s) => s.done).length, g.steps.length) : g.done ? 100 : 0);
export const isAchieved = (g) => g.done || (g.steps?.length > 0 && g.steps.every((s) => s.done));
