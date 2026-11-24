// Focus room: pomodoro + the owl who wakes up when you study and keeps an eye on you.
import { store } from '../store.js';
import { createOwl } from '../owl.js';
import * as timer from '../focusTimer.js';
import { hoot } from '../sound.js';
import { $, esc, ring, empty, options, onAction, onChange, pct, todayKey, toast, field, openModal, plural } from '../util.js';
import { minutesOn, sessionsOn, hoursLabel } from '../stats.js';
import { paperShort } from '../tasks.js';

export const title = 'Focus together, one session at a time.';

// One-tap focus/break lengths in minutes. "Custom" covers everything else (e.g. 50 / 5).
const PRESETS = [[25, 5], [50, 10], [60, 10], [90, 15]];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const LINES = {
  sleep: ["Psst... I'm napping. Wake me when you're ready to focus.", 'Zzz... press Start and I will keep watch.'],
  start: ["I'm awake! Phone face down, book open. Let's go.", 'Chalo, one focused block. I am watching.', 'Eyes on the book. I have my eyes on you.'],
  watch: ['Still here, still watching.', 'Keep the pen moving. You are doing great.', 'One more illustration, then one more.', 'Read the question twice, answer once.', 'Write the working notes. Examiners love them.'],
  half: ['Halfway there! Sit up straight and keep going.'],
  pause: ["Paused. I'll wait right here.", 'Quick pause? Okay. Do not let it become a reel break.'],
  breakStart: ['Break time! Stretch, sip some water, rest your eyes.', 'Walk around a little. No scrolling, deal?'],
  away: [(s) => `Hoo were you texting? You were away for ${s} seconds.`, (s) => `I saw that. ${s} seconds in another tab!`, (s) => `Welcome back. That was ${s}s away. Back to the book!`],
  done: ['We did it! Session complete. I am so proud of you.', 'Another one done. ICAI will not know what hit them.', 'Session complete! Mark a chapter tick if you finished one.'],
  breakDone: ['Break over. Ready for the next round?'],
  saved: [(m) => `Saved ${m} minutes. Every minute counts.`],
  pet: ['Hoot hoot!', 'Hehe, that tickles.', 'You have got this, future CA.', 'Debit the receiver, credit the giver... and focus!'],
  petSleep: ['Mmm... five more minutes...', 'Zzz... start a session to wake me.'],
};

function reply(text) {
  const x = text.toLowerCase();
  if (/tired|sleepy|exhaust|thak/.test(x)) return 'That sounds like a lot. Drink some water, stretch for two minutes, then one small topic.';
  if (/sad|stress|anxious|upset|scared|darr|tension/.test(x)) return 'It is okay to feel that. You do not have to finish the syllabus today. What is one tiny next step?';
  if (/done|finished|completed|ho gaya/.test(x)) return 'That deserves a celebration! Tick it off in Papers and revision.';
  if (/bored|distract|reels|scroll|insta|phone/.test(x)) return 'Let us make the next five minutes simple: one question, one small win.';
  if (/tax|gst|audit|costing|law|accounts|fm|sm/.test(x)) return 'Good subject to pick. Start with the concepts, then practise questions from the module.';
  if (/^(hi|hello|hey|hii+)\b/.test(x)) return 'Hoot hoot! Hello! How is the study going today?';
  return 'I am listening. Want to tell me a bit more? We can find your next small step together.';
}

let owl = null;
let halfSaid = false;
let lastNudge = 0;
let justFinished = false; // stay awake after a session ends, inviting the next step
let holdUntil = 0;        // important lines stay up; ambient chatter waits its turn
const HOLD_MS = 6000;
const say = (text, { important = false } = {}) => {
  const el = $('#speech');
  if (!el) return;
  el.textContent = text;
  holdUntil = important ? Date.now() + HOLD_MS : 0;
};
const canChatter = () => Date.now() > holdUntil;
const chat = (who, text) => {
  const log = $('#chatlog');
  if (!log) return;
  const b = document.createElement('div');
  b.className = `bubble${who === 'You' ? ' me' : ''}`;
  b.textContent = `${who}: ${text}`;
  log.append(b);
  log.scrollTop = log.scrollHeight;
};

function owlMood(st) {
  if (st.running) return st.mode === 'focus' ? 'watch' : 'break';
  return st.startedAt || justFinished ? 'awake' : 'sleep';
}

function shell() {
  const papers = [['', 'Pick a paper (optional)'], ...store.state.papers.map((p) => [p.id, `${p.short} - ${p.name}`])];
  const st = timer.status();
  return `
  <div class="hero"><div class="eyebrow">Your little study room</div><h3>Focus together. One session at a time.</h3>
    <div class="muted">Start a session and your owl wakes up and keeps watch. Tap the owl to pet it.</div></div>
  <div class="grid">
    <div class="s8"><div class="owlroom" id="room">
      <div class="spread"><span class="eyebrow">Owl study club</span><span class="roomstate" id="roomState"></span></div>
      <div class="lamp" aria-hidden="true"></div>
      <div class="owlstage"><div id="owlHost"></div><div class="perch" aria-hidden="true"></div>
        <div class="speech" id="speech" aria-live="polite"></div></div>
      <div class="mode" role="group" aria-label="Session type">
        ${Object.keys(timer.MODES).map((m) => `<button data-act="focus-mode" data-mode="${m}" aria-pressed="false"></button>`).join('')}
      </div>
      <div class="mode lengths" role="group" aria-label="Session length in minutes, focus and break">
        <span>Length</span>
        ${PRESETS.map(([f, b]) => `<button data-act="focus-preset" data-focus="${f}" data-short="${b}" aria-pressed="false" aria-label="${f} minutes focus, ${b} minutes break">${f} / ${b}</button>`).join('')}
        <button data-act="focus-custom">Custom…</button>
      </div>
      <div class="timer" id="timer" role="timer">${timer.clock(st.remaining)}</div>
      <div class="studying">
        <select class="field" id="studyPaper" data-change="focus-study" aria-label="Paper">${options(papers, st.paper)}</select>
        <input class="field" id="studyLabel" data-change="focus-study" value="${esc(st.label)}" placeholder="What are you studying? e.g. GST - ITC" aria-label="What are you studying">
      </div>
      <div class="timerctrl">
        <button class="start" id="startBtn" data-act="focus-toggle">Start focus</button>
        <button data-act="focus-reset">Reset</button>
        <button data-act="focus-end" title="Stop now and keep the minutes studied">End and save</button>
        <button data-act="focus-skip">Skip</button>
      </div>
      <div class="cycle" id="cycle" aria-label="Sessions in this cycle"></div>
      <p class="roomfoot" id="roomFoot"></p>
    </div></div>
    <div class="s4 stack">
      <div class="card"><h3>Today</h3><div id="focusToday"></div></div>
      <div class="card"><h3>Sessions today</h3><div id="sessionList" class="list"></div></div>
      <div class="card"><h3>Chat with your owl</h3>
        <div class="chatlog" id="chatlog"><div class="bubble">Owl: Hey! I am your study buddy. Start a timer and we will get cosy in here.</div></div>
        <div class="addrow"><input class="field" id="chatInput" placeholder="Tell your owl how it is going..." aria-label="Message to owl"><button data-act="owl-chat">Send</button></div>
      </div>
    </div>
    <div class="card s12"><h3>How the owl keeps an eye on you</h3>
      <p class="muted">The owl watches this browser tab. If you switch tabs or minimise the window during a focus session for more than a few seconds, it notices,
      counts a distraction and gives you a look when you come back. The tab title also nudges you while you are away. It cannot see other apps, your camera or your phone.</p></div>
  </div>`;
}

function paint() {
  const st = timer.status();
  const mood = owlMood(st);
  if (owl && owl.base !== mood) owl.setState(mood);
  $('#timer').textContent = timer.clock(st.remaining);
  $('#room').classList.toggle('lit', mood !== 'sleep');
  $('#roomState').textContent = { sleep: 'Sleeping, lamp off', watch: 'Awake and watching', break: 'On a break', awake: 'Awake, waiting for you' }[mood];
  const label = st.running ? 'Pause' : st.startedAt ? 'Resume' : st.mode === 'focus' ? 'Start focus' : 'Start break';
  $('#startBtn').textContent = label;
  const t = store.state.timer;
  document.querySelectorAll('[data-act="focus-mode"]').forEach((b) => {
    const on = b.dataset.mode === st.mode;
    b.textContent = `${timer.MODES[b.dataset.mode]} - ${t[b.dataset.mode]}m`;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('[data-act="focus-preset"]').forEach((b) => {
    const on = Number(b.dataset.focus) === t.focus && Number(b.dataset.short) === t.short;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const every = store.state.timer.longEvery;
  $('#cycle').innerHTML = Array.from({ length: every }, (_, i) => `<i class="${i < st.cycle % every || (st.cycle && st.cycle % every === 0 && st.mode === 'long') ? 'on' : ''}"></i>`).join('');
  $('#roomFoot').textContent = st.distractions ? `The owl caught ${plural(st.distractions, 'tab switch', 'tab switches')} this session` : '';
}

function paintSide() {
  const today = todayKey();
  const mins = minutesOn(today);
  const goal = store.state.profile.dailyGoalHours * 60;
  const list = sessionsOn(today);
  const caught = list.reduce((a, s) => a + (s.distractions || 0), 0);
  $('#focusToday').innerHTML = `<div class="metric">${ring(pct(mins, goal), hoursLabel(mins), { big: true })}
    <div><strong>${plural(list.length, 'session')}</strong><small>Goal ${store.state.profile.dailyGoalHours}h a day</small><small>${plural(caught, 'distraction')} caught</small></div></div>`;
  $('#sessionList').innerHTML = list.length
    ? list.slice().reverse().map((s) => `<div class="item"><span class="grow">${esc(s.label || 'Focus session')}</span>${s.paper ? `<span class="tag">${esc(paperShort(s.paper))}</span>` : ''}<span class="time">${s.minutes}m</span></div>`).join('')
    : empty('No sessions yet today. The owl is waiting.');
}

function onTimerEvent(type, detail) {
  if (!$('#timer')) return;
  if (type === 'tick') {
    const st = timer.status();
    $('#timer').textContent = timer.clock(detail.left);
    if (st.mode !== 'focus' || !canChatter()) return;
    if (!halfSaid && detail.left <= st.total / 2) { halfSaid = true; say(pick(LINES.half)); }
    if (Date.now() - lastNudge > 8 * 60 * 1000) { lastNudge = Date.now(); if (detail.left < st.total - 60) say(pick(LINES.watch)); }
    return;
  }
  if (type === 'start') {
    const st = timer.status();
    halfSaid = st.remaining <= st.total / 2;
    lastNudge = Date.now();
    say(pick(st.mode === 'focus' ? LINES.start : LINES.breakStart));
  }
  if (type === 'pause') say(pick(LINES.pause));
  if (type === 'reset') say(pick(LINES.sleep));
  if (type === 'saved') say(detail.minutes ? pick(LINES.saved)(detail.minutes) : 'Nothing to save yet. Less than a minute studied.');
  if (type === 'complete') justFinished = true;
  if (type === 'start' || type === 'reset' || type === 'mode' || type === 'saved') justFinished = false;
  paint();
  if (type === 'away') {
    owl?.flash('suspicious', 4500);
    const line = pick(LINES.away)(detail.seconds);
    say(line, { important: true });
    chat('Owl', line);
  }
  if (type === 'complete') {
    const msg = pick(detail.mode === 'focus' ? LINES.done : LINES.breakDone);
    if (detail.mode === 'focus') owl?.flash('celebrate', 5000);
    say(msg, { important: true });
    chat('Owl', msg);
    toast(detail.mode === 'focus' ? 'Session complete. Take a break!' : 'Break over!');
  }
}
timer.onTimer(onTimerEvent);

export function render(el) {
  if (!el.dataset.ready) {
    el.innerHTML = shell();
    el.dataset.ready = '1';
    owl = createOwl($('#owlHost', el), {
      label: 'Study owl. Press to pet.',
      onPet: (mood) => { hoot(); say(pick(mood === 'sleep' ? LINES.petSleep : LINES.pet), { important: true }); },
    });
    const st = timer.status();
    owl.setState(owlMood(st));
    say(pick(st.running ? LINES.watch : LINES.sleep));
  }
  paint();
  paintSide();
}

/** Papers changed (restore, start fresh): rebuild the room next time it is shown. Lengths repaint on their own. */
export function invalidate() {
  const el = $('#page-focus');
  if (el) { delete el.dataset.ready; owl?.destroy(); owl = null; }
}

onAction('focus-toggle', () => (timer.status().running ? timer.pause() : timer.start()));
onAction('focus-reset', () => timer.reset());
onAction('focus-end', () => timer.endAndSave());
onAction('focus-mode', (el) => { if (!timer.setMode(el.dataset.mode)) toast('Pause the timer first.'); });
onAction('focus-skip', () => {
  const st = timer.status();
  if (st.running) return toast('Pause first to switch sessions.');
  timer.setMode(st.mode === 'focus' ? 'short' : 'focus');
});
onChange('focus-study', () => timer.setStudy({ paper: $('#studyPaper').value, label: $('#studyLabel').value }));

/** Save lengths and say when they apply: now for a fresh timer, from the next session for one already started. */
function applyLengths(patch) {
  const error = timer.setLengths(patch);
  if (error) {
    toast(error);
    return false;
  }
  const { focus, short } = store.state.timer;
  toast(`Focus ${focus} min, break ${short} min${timer.status().startedAt ? '. Starts with your next session' : ''}`);
  return true;
}

onAction('focus-preset', (el) => applyLengths({ focus: Number(el.dataset.focus), short: Number(el.dataset.short) }));
onAction('focus-custom', () => {
  const t = store.state.timer;
  const body = `<div class="form2">${Object.entries(timer.LIMITS).map(([key, l]) => field({
    label: l.label, name: key, type: 'number', value: t[key], required: true, attrs: `min="${l.min}" max="${l.max}" step="1"`,
  })).join('')}</div>`;
  openModal('Session lengths', body, (d) => applyLengths(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Number(v)]))));
});
onAction('owl-chat', () => {
  const input = $('#chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  chat('You', text);
  setTimeout(() => { chat('Owl', reply(text)); owl?.flash('happy', 900); }, 350);
});
