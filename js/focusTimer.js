// Pomodoro engine. Counts down to a timestamp (not interval ticks), so it stays accurate
// in background tabs, keeps running while you use other pages and survives a refresh.
import { store } from './store.js';
import { dateKey, uid } from './util.js';
import { chime } from './sound.js';

const KEY = 'ca-inter-hq-timer';
const BASE_TITLE = 'CA INTER HQ';
const AWAY_GRACE_MS = 4000;
const listeners = new Set();

export const MODES = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const lengthOf = (mode) => Math.round(store.state.timer[mode] * 60);

/** Allowed values for store.state.timer: minutes for the three modes, sessions for longEvery. Settings and the focus room share them. */
export const LIMITS = {
  focus: { label: 'Focus (minutes)', min: 5, max: 180 },
  short: { label: 'Short break (minutes)', min: 1, max: 60 },
  long: { label: 'Long break (minutes)', min: 5, max: 90 },
  longEvery: { label: 'Long break after (sessions)', min: 2, max: 8 },
};

// Each session remembers its own length, so changing settings mid-session (here or synced from another device)
// never changes how many minutes that session logs.
const fresh = (mode, keep = {}) => ({
  mode, running: false, endsAt: 0, total: lengthOf(mode), remaining: lengthOf(mode), startedAt: 0, distractions: 0, hiddenAt: 0,
  cycle: keep.cycle ?? 0, paper: keep.paper ?? '', label: keep.label ?? '',
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || !MODES[saved.mode]) return fresh('focus');
    saved.total ??= lengthOf(saved.mode); // saved by a version before per-session lengths
    return saved;
  } catch {
    return fresh('focus');
  }
}

let run = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(run));
const emit = (type, detail = {}) => listeners.forEach((fn) => fn(type, detail));
const secondsLeft = () => (run.running ? Math.max(0, Math.ceil((run.endsAt - Date.now()) / 1000)) : run.remaining);

export const onTimer = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const status = () => ({ ...run, remaining: secondsLeft() });
export const clock = (secs) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

function logSession(minutes) {
  store.update((s) => s.sessions.push({
    id: uid(), date: dateKey(new Date(run.startedAt || Date.now())), minutes,
    paper: run.paper, label: run.label.trim(), distractions: run.distractions, ts: Date.now(),
  }));
}

function notify(body) {
  chime();
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('CA INTER HQ', { body, icon: 'icons/owl.svg' });
  }
}

export function start() {
  if (run.running) return;
  if (!run.startedAt) Object.assign(run, { startedAt: Date.now(), distractions: 0 });
  Object.assign(run, { running: true, endsAt: Date.now() + run.remaining * 1000 });
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  save();
  emit('start');
}

export function pause() {
  if (!run.running) return;
  Object.assign(run, { remaining: secondsLeft(), running: false });
  save();
  emit('pause');
}

export function reset() {
  run = fresh(run.mode, run);
  save();
  emit('reset');
}

export function setMode(mode) {
  if (run.running || !MODES[mode]) return false;
  run = fresh(mode, run);
  save();
  emit('mode');
  return true;
}

export function setStudy(patch) {
  Object.assign(run, patch);
  save();
}

/**
 * Change session lengths, e.g. { focus: 50, short: 5 }. Returns an error message, or '' when saved.
 * A timer that has not started picks up the new length at once; a started one keeps its length until it ends.
 */
export function setLengths(patch) {
  for (const [key, value] of Object.entries(patch)) {
    const limit = LIMITS[key];
    if (!limit) return `Unknown setting: ${key}`;
    if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
      return `${limit.label}: pick a whole number from ${limit.min} to ${limit.max}.`;
    }
  }
  store.update((s) => Object.assign(s.timer, patch));
  return '';
}

/** Lengths changed (on any device): refresh a timer that has not started yet. */
function refreshLength() {
  if (run.running || run.startedAt || run.total === lengthOf(run.mode)) return;
  run.total = run.remaining = lengthOf(run.mode);
  save();
  emit('mode');
}
store.subscribe(refreshLength);

/** Stop a focus session early but keep the minutes already studied. */
export function endAndSave() {
  if (run.mode !== 'focus' || !run.startedAt) return reset();
  const minutes = Math.floor((run.total - secondsLeft()) / 60);
  if (minutes >= 1) logSession(minutes);
  run = fresh('focus', run);
  save();
  emit('saved', { minutes });
}

function complete() {
  const { mode } = run;
  if (mode === 'focus') {
    logSession(Math.round(run.total / 60));
    const cycle = run.cycle + 1;
    const next = cycle % store.state.timer.longEvery === 0 ? 'long' : 'short';
    run = fresh(next, { ...run, cycle });
    notify('Focus session complete. Time for a break!');
    emit('complete', { mode, next });
  } else {
    run = fresh('focus', { ...run, cycle: mode === 'long' ? 0 : run.cycle });
    notify('Break is over. Ready for the next session?');
    emit('complete', { mode, next: 'focus' });
  }
  save();
}

// ---------- heartbeat + tab title ----------
let lastShown = -1;
function beat() {
  if (!run.running) {
    if (document.title !== BASE_TITLE) document.title = BASE_TITLE;
    return;
  }
  const left = secondsLeft();
  if (left <= 0) return complete();
  if (left === lastShown) return;
  lastShown = left;
  document.title = document.hidden && run.mode === 'focus' ? `Come back! ${clock(left)} | ${BASE_TITLE}` : `${clock(left)} ${MODES[run.mode]} | ${BASE_TITLE}`;
  emit('tick', { left });
}
setInterval(beat, 250);

// The owl notices when the planner tab is hidden mid-focus. It cannot see other apps.
document.addEventListener('visibilitychange', () => {
  if (!run.running || run.mode !== 'focus') return;
  if (document.hidden) {
    run.hiddenAt = Date.now();
  } else if (run.hiddenAt) {
    const away = Date.now() - run.hiddenAt;
    run.hiddenAt = 0;
    if (away > AWAY_GRACE_MS) {
      run.distractions += 1;
      emit('away', { seconds: Math.round(away / 1000) });
    }
  }
  save();
});

// A session that ended while the tab was closed still counts.
if (run.running && secondsLeft() <= 0) queueMicrotask(complete);
