// The study assistant: reminds about timed tasks while the planner is open (any tab, even in the background).
// 5 minutes before, at the start, and a check-in at the end. Rules for *when* live in schedule.js.
import { store } from './store.js';
import { dueReminders, isQuiet, MINUTE } from './schedule.js';
import { setDone, updateTask, openReschedule } from './tasks.js';
import { $, esc, fmtTime, icon, onAction, toast } from './util.js';
import { remind as remindSound } from './sound.js';

const CHECK_MS = 15 * 1000;
const LOG_MAX = 150;
export const SNOOZES = [5, 10, 15];
export const KIND_LABELS = { pre: 'Starting in 5 minutes', start: 'Starting now', end: 'Check-in', snooze: 'Snoozed reminder' };

// Several lines per kind, never the same one twice in a row.
const MESSAGES = {
  pre: [
    (t) => `Psst! Your ${t} is waiting for you! Just 5 minutes left. Get ready!`,
    (t) => `Heads up! ${t} starts in 5 minutes. Water bottle, pen, book. Ready?`,
    (t) => `5 minute warning: ${t} is up next. Wrap up what you are doing.`,
    (t) => `Your future CA self says: ${t} in 5 minutes. Let us be ready for it.`,
  ],
  start: [
    (t) => `It's GO TIME! Your ${t} starts NOW. Let's get it done!`,
    (t) => `${t} starts now. Phone face down, focus up!`,
    (t) => `Showtime! ${t} begins right now. You have got this.`,
    (t) => `The clock is ticking: ${t} starts now. One focused block at a time.`,
  ],
  end: [
    (t) => `Hey! Your scheduled time for ${t} is over. Did you complete your task?`,
    (t) => `Time is up for ${t}. Did you finish it?`,
    (t) => `${t}: the scheduled time is over. Done, or still going?`,
  ],
};
const lastLine = {};
function message(kind, title) {
  const lines = MESSAGES[kind];
  let i = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && i === lastLine[kind]) i = (i + 1) % lines.length;
  lastLine[kind] = i;
  return lines[i](title);
}

/** The kind whose words and buttons a reminder uses (a snoozed check-in is still a check-in). */
const baseKind = (e) => (e.kind === 'snooze' ? e.of || 'start' : e.kind);
const isCheckin = (e) => baseKind(e) === 'end';
const findTask = (id) => store.state.tasks.find((t) => t.id === id);

// ---------- engine ----------
function entry(r, status, now) {
  const task = findTask(r.taskId);
  const kind = r.kind === 'snooze' ? r.of || 'start' : r.kind;
  const text = message(kind, task.title);
  return { key: r.key, taskId: r.taskId, kind: r.kind, of: r.of || '', title: task.title, at: now, status, response: '',
    message: r.kind === 'snooze' ? `Snoozed reminder: ${text}` : text };
}

export function checkReminders(now = Date.now()) {
  const { profile, tasks, reminderLog } = store.state;
  if (!profile.remindersOn) return;
  const { fire, skip } = dueReminders(tasks, now, new Set(reminderLog.map((l) => l.key)));
  if (!fire.length && !skip.length) return;
  const quiet = isQuiet(now, profile);
  const shown = fire.map((r) => entry(r, quiet ? 'quiet' : 'shown', now));
  store.update((s) => {
    s.reminderLog = [...s.reminderLog, ...skip.map((r) => entry(r, 'skipped', now)), ...shown].slice(-LOG_MAX);
    fire.filter((r) => r.kind === 'snooze').forEach((r) => { const t = s.tasks.find((x) => x.id === r.taskId); if (t) t.snooze = null; });
  });
  if (!quiet) shown.forEach(deliver);
}

// ---------- delivery: in-app card + sound, plus a system notification when the tab is not in front ----------
const active = new Map(); // key -> { entry, stage: 'ask' | 'pending' }

function deliver(e) {
  active.set(e.key, { entry: e, stage: 'ask' });
  paintCards();
  remindSound(baseKind(e));
  if (document.hidden || !document.hasFocus()) systemNotify(e);
}

async function systemNotify(e) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const title = KIND_LABELS[e.kind];
  const options = { body: e.message, tag: e.key, icon: 'icons/owl.svg', requireInteraction: isCheckin(e), data: { key: e.key } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    // Buttons only work on service-worker notifications (Chrome shows them; Safari and iPhone show a plain notification).
    if (reg) {
      await reg.showNotification(title, { ...options, actions: isCheckin(e) ? [{ action: 'done', title: 'Completed' }, { action: 'pending', title: 'Still pending' }] : [] });
    } else {
      const n = new Notification(title, options);
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch { /* the in-app card is already showing */ }
}

const snoozeRow = (key) => `<div class="row snooze"><span class="muted">Snooze</span>${SNOOZES.map((m) => `<button class="btn small" data-act="remind-snooze" data-key="${esc(key)}" data-min="${m}">${m} min</button>`).join('')}</div>`;

function cardHtml({ entry: e, stage }) {
  const task = findTask(e.taskId);
  const when = task?.from ? `${fmtTime(task.from)}${task.to ? ` - ${fmtTime(task.to)}` : ''}` : '';
  const key = esc(e.key);
  let body;
  if (stage === 'pending') {
    body = `<p>No problem. <b>${esc(e.title)}</b> stays in your Overdue list until it is done.</p>
      <div class="row"><button class="btn primary small" data-act="remind-reschedule" data-key="${key}">Reschedule</button>
      <button class="btn small" data-act="remind-close" data-key="${key}">OK</button></div>`;
  } else if (!task) {
    body = `<p>${esc(e.message)}</p><div class="row"><button class="btn primary small" data-act="remind-close" data-key="${key}">Got it</button></div>`;
  } else if (isCheckin(e)) {
    body = `<p>${esc(e.message)}</p>
      <div class="row"><button class="btn primary small" data-act="remind-done" data-key="${key}">${icon('check')} Completed</button>
      <button class="btn small" data-act="remind-pending" data-key="${key}">Still pending</button></div>${snoozeRow(e.key)}`;
  } else {
    body = `<p>${esc(e.message)}</p>
      <div class="row"><button class="btn primary small" data-act="remind-close" data-key="${key}">Got it</button>
      <button class="btn small" data-act="remind-done" data-key="${key}">${icon('check')} Already done</button></div>${snoozeRow(e.key)}`;
  }
  return `<div class="remind kind-${baseKind(e)}" role="alert">
    <div class="spread"><strong>${KIND_LABELS[e.kind]}</strong><span class="row"><span class="time">${when}</span>
      <button class="icon-btn" data-act="remind-close" data-key="${key}" aria-label="Dismiss reminder">${icon('x')}</button></span></div>
    ${body}</div>`;
}

function paintCards() {
  const host = $('#assistant');
  if (host) host.innerHTML = [...active.values()].map(cardHtml).join('');
}

// Finished early or deleted (here or on another device): its open reminders go away too.
store.subscribe(() => {
  let changed = false;
  active.forEach(({ entry: e, stage }, key) => {
    const task = findTask(e.taskId);
    if (e.taskId && (!task || (task.done && stage === 'ask'))) { active.delete(key); changed = true; }
  });
  if (changed) paintCards();
});

// ---------- answers (from the card, or from a notification via the service worker) ----------
function respond(key, response) {
  store.update((s) => { const l = s.reminderLog.find((x) => x.key === key); if (l) l.response = response; });
}
const close = (key) => { active.delete(key); paintCards(); };
const logged = (key) => store.state.reminderLog.find((l) => l.key === key);

function act(action, key, extra = {}) {
  const e = active.get(key)?.entry ?? logged(key);
  if (!e) return;
  if (action === 'done') {
    close(key);
    respond(key, 'done');
    if (e.taskId) setDone(e.taskId, true);
    toast('Marked as done. Proud of you!');
  } else if (action === 'pending') {
    respond(key, 'pending');
    active.set(key, { entry: e, stage: 'pending' });
    paintCards();
  } else if (action === 'reschedule') {
    close(key);
    openReschedule(e.taskId);
  } else if (action === 'snooze') {
    close(key);
    respond(key, `snoozed ${extra.minutes} min`);
    updateTask(e.taskId, { snooze: { at: Date.now() + extra.minutes * MINUTE, of: baseKind(e) } });
    toast(`Snoozed for ${extra.minutes} minutes`);
  } else if (action === 'open' && !active.has(key)) {
    active.set(key, { entry: e, stage: 'ask' });
    paintCards();
  }
}

onAction('remind-done', (el) => act('done', el.dataset.key));
onAction('remind-pending', (el) => act('pending', el.dataset.key));
onAction('remind-reschedule', (el) => act('reschedule', el.dataset.key));
onAction('remind-snooze', (el) => act('snooze', el.dataset.key, { minutes: Number(el.dataset.min) }));
onAction('remind-close', (el) => close(el.dataset.key));

/** A sample reminder so she can check sound, card and notification permission. Not tied to a task, not logged. */
export function testReminder() {
  deliver({ key: `test|${Date.now()}`, taskId: '', kind: 'start', of: '', title: 'Test', message: message('start', 'test reminder') });
  if ('Notification' in window && Notification.permission === 'granted') {
    systemNotify({ key: `test-n|${Date.now()}`, kind: 'start', of: '', message: 'This is how reminders look when the planner is in the background.' });
  }
}

export function startAssistant() {
  navigator.serviceWorker?.addEventListener('message', (ev) => {
    if (ev.data?.type === 'reminder') act(ev.data.action, ev.data.key);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
  setInterval(checkReminders, CHECK_MS);
  checkReminders();
}
