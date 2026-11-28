// Single source of truth. Everything lives in one localStorage key, so a task typed once shows up on every page.
import { toast } from './util.js';

const KEY = 'ca-inter-hq-v1';
// Too big for the cloud document (vision images are data URLs), so these stay on the device that added them.
const DEVICE_ONLY = ['vision'];

// CA Inter (ICAI scheme applicable from May 2024). Chapters are added by the student.
const PAPERS = [
  ['p1', 'P1', 'Advanced Accounting', 'Group I', '#f2b8c2'],
  ['p2', 'P2', 'Corporate and Other Laws', 'Group I', '#f5d27a'],
  ['p3', 'P3', 'Taxation (Income Tax + GST)', 'Group I', '#a9d3a5'],
  ['p4', 'P4', 'Cost and Management Accounting', 'Group II', '#c3b3e3'],
  ['p5', 'P5', 'Auditing and Ethics', 'Group II', '#f4bf9a'],
  ['p6', 'P6', 'Financial Management and Strategic Management', 'Group II', '#9cc6e4'],
];

export const BLANK_DAY = Object.freeze({
  water: 0, mood: '', wake: '', bed: '', affirmation: '', notes: '', workout: '', wins: '',
  meals: Object.freeze({ breakfast: '', lunch: '', snacks: '', dinner: '' }),
});

function defaults() {
  return {
    version: 1,
    profile: {
      name: '', examDate: '', attempt: '', weekStart: 1, dailyGoalHours: 6, saturdayGoalHours: 2, waterTarget: 8, sound: true,
      remindersOn: true, quietOn: false, quietFrom: '22:30', quietTo: '07:00',
    },
    timer: { focus: 25, short: 5, long: 15, longEvery: 4 },
    tasks: [],         // {id,title,date,from,to,priority,type,paper,top3,event,skill,done,doneAt,snooze:{at,of}|null}
    days: {},          // 'YYYY-MM-DD' -> BLANK_DAY shape
    habits: [],        // {id,name,days:['YYYY-MM-DD'],schedule?:'week'|'sunday',paused?} no schedule = 'week' (Mon-Sat)
    habitNotes: {},    // 'YYYY-MM' -> {reflection,learned}
    goals: [],         // {id,title,area,month,done,steps:[{id,text,done}]}
    vision: [],        // {id,src,caption}
    papers: PAPERS.map(([id, short, name, group, color]) => ({ id, short, name, group, color, chapters: [] })),
    sessions: [],      // {id,date,minutes,paper,label,distractions,ts}
    skills: [],        // {id,name,goal,length,start,days:['YYYY-MM-DD']}  days = manual "practised" ticks
    reminderLog: [],   // newest last: {key,taskId,kind,title,message,at,status:'shown'|'quiet'|'skipped',response}
  };
}

/** Defaults first, saved data on top: new settings appear without wiping old data. */
function hydrate(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    profile: { ...base.profile, ...raw.profile },
    timer: { ...base.timer, ...raw.timer },
    papers: Array.isArray(raw.papers) && raw.papers.length ? raw.papers : base.papers,
  };
}

function load() {
  try {
    return hydrate(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return defaults();
  }
}

let state = load();
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
// Edits made on this device (not ones arriving from the cloud or another tab): the sync layer pushes these.
const editListeners = new Set();
const edited = () => editListeners.forEach((fn) => fn());

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    toast('Storage is full. Remove a few vision-board images or export a backup.');
    return false;
  }
}

// Another tab saved: pick it up so two open tabs never overwrite each other with stale data.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  state = load();
  notify();
});

export const store = {
  get state() { return state; },

  /** Mutate state, save, re-render. Use silent for typing in text boxes (keeps the cursor where it is). */
  update(mutator, { silent = false } = {}) {
    mutator(state);
    persist();
    edited();
    if (!silent) notify();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  onLocalEdit(fn) {
    editListeners.add(fn);
    return () => editListeners.delete(fn);
  },

  /** Has anything been entered yet (here, or in a cloud copy)? Decides whether a first sign-in must ask before replacing data. */
  hasData(s = state) {
    return Boolean(s.tasks.length || s.sessions.length || s.habits.length || s.goals.length || s.skills.length || Object.keys(s.days).length
      || s.profile.name || s.profile.examDate || s.papers.some((p) => p.chapters.length));
  },

  /** The part of the state that syncs. */
  cloudData() {
    const copy = { ...state };
    DEVICE_ONLY.forEach((k) => delete copy[k]);
    return copy;
  },

  /** Take the cloud copy, keeping device-only parts. Not a local edit, so it is not pushed back. */
  applyCloud(data) {
    const keep = Object.fromEntries(DEVICE_ONLY.map((k) => [k, state[k]]));
    state = hydrate({ ...data, ...keep });
    persist();
    notify();
  },

  /** Read-only view of a day; never creates empty entries. */
  dayView(key) {
    const d = state.days[key];
    return d ? { ...BLANK_DAY, ...d, meals: { ...BLANK_DAY.meals, ...d.meals } } : BLANK_DAY;
  },

  /** Writable day record (call inside update). */
  dayRecord(s, key) {
    s.days[key] ??= { ...BLANK_DAY, meals: { ...BLANK_DAY.meals } };
    s.days[key].meals ??= { ...BLANK_DAY.meals };
    return s.days[key];
  },

  exportJson(data = state) {
    return JSON.stringify({ app: 'ca-inter-hq', exportedAt: new Date().toISOString(), data }, null, 2);
  },

  importJson(text) {
    const parsed = JSON.parse(text);
    const data = parsed?.app === 'ca-inter-hq' ? parsed.data : parsed;
    if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.papers)) throw new Error('Not a CA Inter HQ backup');
    state = hydrate(data);
    persist();
    edited();
    notify();
  },

  reset() {
    state = defaults();
    persist();
    edited();
    notify();
  },
};
