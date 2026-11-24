// Settings, profile, sync and backup.
import { store } from '../store.js';
import { esc, options, toast, onAction, onChange, icon, downloadBackup } from '../util.js';
import { LIMITS, setLengths } from '../focusTimer.js';
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
      ${Object.entries(LIMITS).map(([key, l]) => num(l.label, 'timer', key, t[key], l.min, l.max)).join('')}
    </div><p class="muted">You can also change these in the Focus room. Many CA students like 50 minutes focus and a 10 minute break.</p></div>
    <div class="card s12"><h3>Sync across devices</h3>
      <p class="muted">Sign in with Google on each device (laptop, phone) and the planner stays the same everywhere.
      Only your Google account can see your data. Vision board photos stay on the device where you added them.</p>
      <p><b data-sync-label></b> <span data-sync-when="in">as <span data-sync-email></span></span></p>
      <p class="muted" data-sync-detail></p>
      <div class="row">
        <button class="btn primary" data-act="sync-signin" data-sync-when="out">Sign in with Google</button>
        <button class="btn" data-act="sync-signout" data-sync-when="in">Sign out</button>
      </div>
    </div>
    <div class="card s12"><h3>Backup &amp; restore</h3>
      <p class="muted">The planner is always saved in this browser, and in your Google account once you sign in.
      A backup file is still a good idea now and then, especially before clearing browser data.</p>
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

function saveProfile(el) {
  const value = coerce(el);
  if (el.type === 'number' && (!Number.isFinite(value) || value < Number(el.min) || value > Number(el.max))) {
    toast(`Pick a number from ${el.min} to ${el.max}.`);
    return;
  }
  store.update((s) => { s.profile[el.dataset.field] = value; });
}

// Shared by every page that edits the profile (settings, papers page).
onChange('profile', saveProfile);
onChange('timer', (el) => {
  const error = setLengths({ [el.dataset.field]: Number(el.value) });
  if (error) toast(error);
});

onAction('backup-export', () => {
  downloadBackup(store.exportJson());
  toast('Backup downloaded');
});
onChange('backup-import', async (el) => {
  const file = el.files[0];
  el.value = '';
  if (!file) return;
  if (!confirm('Restoring replaces everything currently in the planner, including on your other devices if you are signed in. Continue?')) return;
  try {
    store.importJson(await file.text());
    rebuildFocusRoom();
    toast('Backup restored');
  } catch {
    toast('That file is not a CA Inter HQ backup.');
  }
});
onAction('reset-all', () => {
  if (!confirm('Delete ALL planner data? If you are signed in, this also clears it on your other devices. Download a backup first if unsure.')) return;
  store.reset();
  rebuildFocusRoom();
  toast('Fresh start');
});
