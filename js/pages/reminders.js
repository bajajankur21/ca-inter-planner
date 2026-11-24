// Reminders: assistant settings, what is coming up today, and the history of every reminder.
import { store } from '../store.js';
import { rerender } from '../router.js';
import { esc, empty, todayKey, dateKey, fmt, fmtTime, field, onAction, toast } from '../util.js';
import { remindersFor } from '../schedule.js';
import { KIND_LABELS, testReminder } from '../assistant.js';

export const title = 'Your study assistant.';
const UPCOMING_SHOWN = 8;
const STATUS = { quiet: 'Quiet hours', skipped: 'Skipped (a newer reminder took over)' };
const RESPONSE = { done: 'Completed', pending: 'Still pending' };

const clock = (ms) => new Date(ms).toTimeString().slice(0, 5);
const profileField = (key, label, type, value) => field({ label, name: key, type, value, attrs: `data-change="profile" data-field="${key}"` });

function permissionHtml() {
  if (!('Notification' in window)) {
    return '<p class="muted">This browser cannot show system notifications. On iPhone, add the planner to your Home Screen first. Reminders still pop up inside the planner.</p>';
  }
  const state = Notification.permission;
  if (state === 'granted') return '<p class="muted">System notifications are on. You will see them even while using another tab or app, as long as the planner is open.</p>';
  if (state === 'denied') return '<p class="muted">Notifications are blocked for this site. Allow them in the browser\'s site settings, then reload.</p>';
  return '<p class="muted">Allow notifications to get reminders while you are on another tab or app.</p><button class="btn primary" data-act="notif-allow">Allow notifications</button>';
}

function upcomingHtml(now) {
  const today = todayKey();
  const list = store.state.tasks.filter((t) => t.date === today).flatMap(remindersFor)
    .filter((r) => r.at > now).sort((a, b) => a.at - b.at).slice(0, UPCOMING_SHOWN);
  if (!list.length) return empty('Nothing else timed today. Add a start time to a task to get reminders for it.');
  const titleOf = (id) => store.state.tasks.find((t) => t.id === id)?.title ?? '';
  return list.map((r) => `<div class="item"><span class="time">${fmtTime(clock(r.at))}</span>
    <span class="grow">${esc(titleOf(r.taskId))}</span><span class="tag">${KIND_LABELS[r.kind]}</span></div>`).join('');
}

function historyHtml() {
  const log = store.state.reminderLog;
  if (!log.length) return empty('No reminders yet. They will show up here as they happen.');
  return log.slice().reverse().map((l) => {
    const outcome = RESPONSE[l.response] ?? (l.response.startsWith('snoozed') ? `Snoozed ${l.response.slice(8)}` : STATUS[l.status] ?? '');
    return `<div class="item${l.status === 'shown' ? '' : ' muted-item'}">
      <span class="time">${fmt(dateKey(new Date(l.at)), { day: 'numeric', month: 'short' })} ${fmtTime(clock(l.at))}</span>
      <span class="grow">${esc(l.message)}</span><span class="tag">${KIND_LABELS[l.kind]}</span>
      ${outcome ? `<span class="tag${l.response === 'done' ? ' good' : ''}">${outcome}</span>` : ''}</div>`;
  }).join('');
}

export function render(el) {
  const p = store.state.profile;
  const now = Date.now();
  el.innerHTML = `<div class="hero"><div class="eyebrow">Smart task reminders</div><h3>A nudge before, a push at the start, a check-in at the end.</h3>
    <div class="muted">Give a task a start time and the planner reminds you 5 minutes before and when it starts. Give it an end time too and it asks whether you finished.</div></div>
  <div class="grid">
    <div class="card s6 stack"><h3>Reminder settings</h3>
      ${profileField('remindersOn', 'Remind me about timed tasks', 'checkbox', p.remindersOn)}
      ${profileField('sound', 'Play a sound with reminders (and the owl)', 'checkbox', p.sound)}
      ${permissionHtml()}
      ${profileField('quietOn', 'Quiet hours (no reminders while sleeping)', 'checkbox', p.quietOn)}
      <div class="form2">
        ${profileField('quietFrom', 'From', 'time', p.quietFrom)}
        ${profileField('quietTo', 'To', 'time', p.quietTo)}
      </div>
      <div class="row"><button class="btn" data-act="remind-test">Send a test reminder</button></div>
      <p class="muted">Reminders work while the planner is open: in any tab, minimised, or as the home-screen app on your iPhone screen.
      They cannot arrive once it is fully closed.</p>
    </div>
    <div class="card s6"><h3>Coming up today</h3><div class="list">${upcomingHtml(now)}</div></div>
    <div class="card s12"><div class="spread"><h3>History</h3>${store.state.reminderLog.length ? '<button class="btn" data-act="remind-clear">Clear history</button>' : ''}</div>
      <div class="list">${historyHtml()}</div></div>
  </div>`;
}

onAction('notif-allow', async () => {
  const result = await Notification.requestPermission();
  toast(result === 'granted' ? 'Notifications on. Try a test reminder!' : 'Notifications stay off. Reminders still pop up inside the planner.');
  rerender(); // repaint the permission line (not a data change, so nothing to sync)
});
onAction('remind-test', () => testReminder());
onAction('remind-clear', () => {
  if (confirm('Clear the reminder history?')) store.update((s) => { s.reminderLog = []; });
});
