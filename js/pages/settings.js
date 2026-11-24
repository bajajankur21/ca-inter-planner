// Settings, profile and backup. Data only lives in this browser, so backups matter.
import { store } from '../store.js';
import { esc, options, todayKey, toast, onAction, onChange, icon } from '../util.js';
import { refreshLength } from '../focusTimer.js';
import { invalidate as rebuildFocusRoom } from './focus.js';

export const title = 'Make it yours.';

const num = (label, group, key, value, min, max) =>
  `<label class="lbl">${label}<input class="field" type="number" min="${min}" max="${max}" value="${value}" data-change="${group}" data-field="${key}"></label>`;

export function render(el) {
  const { profile: p, timer: t } = store.state;
  el.innerHTML = `
  <div class="grid">
    <div class="card s6"><h3>Profile</h3><div class="stack">
      <label class="lbl">Your name<input class="field" value="${esc(p.name)}" placeholder="So the dashboard can greet you" data-change="profile" data-field="name"></label>
      <div class="form2">
        <label class="lbl">CA Inter exam date<input class="field" type="date" value="${esc(p.examDate)}" data-change="profile" data-field="examDate"></label>
        <label class="lbl">Attempt<input class="field" value="${esc(p.attempt)}" placeholder="e.g. May 2027" data-change="profile" data-field="attempt"></label>
        <label class="lbl">Week starts on<select class="field" data-change="profile" data-field="weekStart">${options([[1, 'Monday'], [0, 'Sunday']], p.weekStart)}</select></label>
        ${num('Daily study goal (hours)', 'profile', 'dailyGoalHours', p.dailyGoalHours, 1, 16)}
        ${num('Water target (glasses)', 'profile', 'waterTarget', p.waterTarget, 1, 16)}
      </div>
      <label class="check"><input type="checkbox" ${p.sound ? 'checked' : ''} data-change="profile" data-field="sound"> Sounds (owl hoot and session chime)</label>
    </div></div>
    <div class="card s6"><h3>Focus timer</h3><div class="form2">
      ${num('Focus (minutes)', 'timer', 'focus', t.focus, 5, 180)}
      ${num('Short break (minutes)', 'timer', 'short', t.short, 1, 60)}
      ${num('Long break (minutes)', 'timer', 'long', t.long, 5, 90)}
      ${num('Long break after (sessions)', 'timer', 'longEvery', t.longEvery, 2, 8)}
    </div><p class="muted">Many CA students like 50 minutes focus and a 10 minute break. Try what suits you.</p></div>
    <div class="card s12"><h3>Backup &amp; restore</h3>
      <p class="muted">Everything is saved privately in this browser on this device. Nothing is uploaded anywhere.
      Download a backup now and then, especially before clearing browser data or switching phones.</p>
      <div class="row">
        <button class="btn primary" data-act="backup-export">${icon('download')} Download backup</button>
        <label class="btn">${icon('upload')} Restore from backup<input type="file" accept="application/json,.json" class="sr-only" data-change="backup-import"></label>
        <button class="btn" data-act="reset-all">Start fresh</button>
      </div>
    </div>
  </div>`;
}

function coerce(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'number') return Number(el.value);
  if (el.dataset.field === 'weekStart') return Number(el.value);
  return el.value;
}

function saveSetting(group, el) {
  const value = coerce(el);
  if (el.type === 'number' && (!Number.isFinite(value) || value < Number(el.min) || value > Number(el.max))) {
    toast(`Pick a number from ${el.min} to ${el.max}.`);
    return false;
  }
  store.update((s) => { s[group][el.dataset.field] = value; });
  return true;
}

// Shared by every page that edits the profile (settings, papers page).
onChange('profile', (el) => saveSetting('profile', el));
onChange('timer', (el) => {
  if (saveSetting('timer', el)) {
    refreshLength();
    rebuildFocusRoom();
  }
});

onAction('backup-export', () => {
  const blob = new Blob([store.exportJson()], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `ca-inter-hq-backup-${todayKey()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
});
onChange('backup-import', async (el) => {
  const file = el.files[0];
  el.value = '';
  if (!file) return;
  if (!confirm('Restoring replaces everything currently in the planner. Continue?')) return;
  try {
    store.importJson(await file.text());
    rebuildFocusRoom();
    toast('Backup restored');
  } catch {
    toast('That file is not a CA Inter HQ backup.');
  }
});
onAction('reset-all', () => {
  if (!confirm('Delete ALL planner data in this browser? Download a backup first if unsure.')) return;
  store.reset();
  rebuildFocusRoom();
  toast('Fresh start');
});
