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
export const lengthOf = (mode) => Math.round(store.state.timer[mode] * 60);

const fresh = (mode, keep = {}) => ({
  mode, running: false, endsAt: 0, remaining: lengthOf(mode), startedAt: 0, distractions: 0, hiddenAt: 0,
  cycle: keep.cycle ?? 0, paper: keep.paper ?? '', label: keep.label ?? '',
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved && MODES[saved.mode] ? saved : fresh('focus');
  } catch {
    return fresh('focus');
  }
}

let run = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(run));
const emit = (type, detail = {}) => listeners.forEach((fn) => fn(type, detail));
const secondsLeft = () => (run.running ? Math.max(0, Math.ceil((run.endsAt - Date.now()) / 1000)) : run.remaining);

export const onTimer = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const status = () => ({ ...run, remaining: secondsLeft(), total: lengthOf(run.mode) });
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

/** Durations changed in settings: refresh an untouched timer. */
export function refreshLength() {
  if (!run.running && !run.startedAt) {
    run.remaining = lengthOf(run.mode);
    save();
    emit('mode');
  }
}

/** Stop a focus session early but keep the minutes already studied. */
export function endAndSave() {
  if (run.mode !== 'focus' || !run.startedAt) return reset();
  const minutes = Math.floor((lengthOf('focus') - secondsLeft()) / 60);
  if (minutes >= 1) logSession(minutes);
  run = fresh('focus', run);
  save();
  emit('saved', { minutes });
}

function complete() {
  const { mode } = run;
  if (mode === 'focus') {
    logSession(Math.round(lengthOf('focus') / 60));
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
