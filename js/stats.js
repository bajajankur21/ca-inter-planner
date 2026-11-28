// Derived numbers used by several pages. Pure reads of the store; no rendering here.
import { store } from './store.js';
import { todayKey, dateKey, daysBetween, addDays, pct } from './util.js';
import { dayMode, isSunday, SATURDAY, SUNDAY } from './dayMode.js';

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

/** Study goal for a day: the usual goal Mon-Fri, the light goal on Saturday, nothing on Sunday. */
export function goalHoursFor(key) {
  const { dailyGoalHours, saturdayGoalHours } = store.state.profile;
  return { [SATURDAY]: saturdayGoalHours, [SUNDAY]: 0 }[dayMode(key)] ?? dailyGoalHours;
}

// ---------- habits ----------
// Two sets: regular habits (schedule 'week', the default, also what every older habit is) run Monday to Saturday;
// Sunday habits (schedule 'sunday') only exist on Sundays. Sunday is a rest day for regular habits, and a skipped or
// paused Sunday habit is never a missed day, so neither can lower a percentage or break a streak.
export const isSundayHabit = (h) => h.schedule === 'sunday';
export const weekHabits = () => store.state.habits.filter((h) => !isSundayHabit(h));
export const sundayHabits = () => store.state.habits.filter(isSundayHabit);
export const sundaysDone = (h) => h.days.filter(isSunday).length;

/** Done check-ins and possible check-ins of regular habits for the given day keys (Sundays never count). */
export function habitTotals(keys) {
  const habits = weekHabits();
  const counted = keys.filter((k) => !isSunday(k));
  const done = sum(habits, (h) => counted.filter((k) => h.days.includes(k)).length);
  return { done, total: habits.length * counted.length, pct: pct(done, habits.length * counted.length) };
}

/** Days in a row up to today (or yesterday, if today is not done yet). An unticked Sunday is skipped, not a break. */
export function streak(days) {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  for (let key = dateKey(d); set.has(key) || isSunday(key); key = dateKey(d)) {
    if (set.has(key)) n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ---------- skill sprints ----------
/** Days a skill was practised: ticked by hand, or a task for that skill finished (on the day it was finished). */
export function skillDays(skill) {
  const finished = store.state.tasks.filter((t) => t.skill === skill.id && t.done).map((t) => (t.doneAt ? dateKey(new Date(t.doneAt)) : t.date));
  return [...new Set([...skill.days, ...finished])].sort();
}

/** Longest run in sorted unique day keys; like streak(), an unticked Sunday in between does not break it. */
export function bestStreak(days) {
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    const next = i && addDays(days[i - 1], 1);
    const continues = i && (next === d || (isSunday(next) && addDays(next, 1) === d));
    run = continues ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Where a sprint stands today: day number, days practised inside the sprint window, finished or not. */
export function sprintProgress(skill, days = skillDays(skill)) {
  const today = todayKey();
  const end = addDays(skill.start, skill.length - 1);
  const day = Math.min(skill.length, daysBetween(skill.start, today) + 1);
  const practised = days.filter((d) => d >= skill.start && d <= end).length;
  return { day, end, practised, pct: pct(practised, skill.length), finished: today > end };
}

// ---------- goals ----------
export const goalPct = (g) => (g.steps?.length ? pct(g.steps.filter((s) => s.done).length, g.steps.length) : g.done ? 100 : 0);
export const isAchieved = (g) => g.done || (g.steps?.length > 0 && g.steps.every((s) => s.done));
