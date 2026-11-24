// Skill sprint: pick a skill, give it N days, add each day's learning as a task. Finishing it grows the streak.
import { store } from '../store.js';
import { esc, ring, empty, todayKey, addDays, fmt, field, openModal, icon, uid, toast, onAction, plural } from '../util.js';
import { taskRow, addTask } from '../tasks.js';
import { skillDays, streak, bestStreak, sprintProgress } from '../stats.js';

export const title = 'Learn one small thing every day.';
const LENGTHS = [7, 14, 21, 30, 60, 90];
const DEFAULT_LENGTH = 30;
const RECENT_DAYS = 14;

function recentDots(days, today) {
  const set = new Set(days);
  return Array.from({ length: RECENT_DAYS }, (_, i) => addDays(today, i - RECENT_DAYS + 1)).map((d) => {
    const on = set.has(d);
    return `<span class="hcell${on ? ' on' : ''}${d === today ? ' today' : ''}" title="${fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })}${on ? ': practised' : ''}">${on ? icon('check') : ''}</span>`;
  }).join('');
}

function skillCard(skill, today) {
  const days = skillDays(skill);
  const p = sprintProgress(skill, days);
  const ticked = skill.days.includes(today);
  const viaTask = days.includes(today) && !ticked;
  const todays = store.state.tasks.filter((t) => t.skill === skill.id && t.date === today);
  const label = esc(skill.name);
  return `<div class="card s4 skill">
    <div class="spread"><h3>${label}</h3><span class="row">
      <button class="icon-btn" data-act="skill-edit" data-id="${skill.id}" aria-label="Edit ${label}">${icon('edit')}</button>
      <button class="icon-btn" data-act="skill-del" data-id="${skill.id}" aria-label="Delete ${label}">${icon('x')}</button></span></div>
    ${skill.goal ? `<p class="muted">${esc(skill.goal)}</p>` : ''}
    <div class="metric">${ring(p.pct, `${p.practised}/${skill.length}`, { color: '#c3b3e3' })}
      <div><strong>${icon('flame')} ${plural(streak(days), 'day')} streak</strong>
      <small>Best ${plural(bestStreak(days), 'day')}</small>
      <small>${p.finished ? `Sprint ended ${fmt(p.end, { day: 'numeric', month: 'short' })}` : `Day ${p.day} of ${skill.length}`}</small></div></div>
    <div class="skilldays" role="img" aria-label="Practised ${days.filter((d) => d > addDays(today, -RECENT_DAYS)).length} of the last ${RECENT_DAYS} days">${recentDots(days, today)}</div>
    ${p.finished ? `<div class="sprint-done"><strong>Sprint complete!</strong> You practised ${p.practised} of ${skill.length} days.
      <button class="btn primary small" data-act="skill-restart" data-id="${skill.id}">Start another ${skill.length}-day sprint</button></div>` : ''}
    <button class="btn${ticked || viaTask ? ' primary' : ''}" data-act="skill-tick" data-id="${skill.id}" aria-pressed="${ticked || viaTask}" ${viaTask ? 'disabled title="Counted from a finished task"' : ''}>
      ${ticked || viaTask ? `${icon('check')} Practised today` : 'Mark practised today'}</button>
    <div class="list">${todays.map((t) => taskRow(t)).join('')}</div>
    <div class="addrow"><input class="field" data-skill-input="${skill.id}" placeholder="What will you learn today?" aria-label="Today's learning for ${label}">
      <button data-act="skill-task" data-id="${skill.id}" aria-label="Add as today's task">${icon('plus')}</button></div>
  </div>`;
}

export function render(el) {
  const today = todayKey();
  const { skills } = store.state;
  el.innerHTML = `<div class="hero"><div class="eyebrow">Skill sprint</div><h3>Pick a skill. Show up daily. Watch the streak grow.</h3>
    <div class="muted">Give a skill a sprint (say 30 days) and add today's learning as a task. It shows on your dashboard and planner,
    and finishing it counts for your streak. Add a time to it and you get reminders too.</div>
    <button class="btn primary mt" data-act="skill-new">${icon('plus')} Start a skill sprint</button></div>
  <div class="grid">${skills.length ? skills.map((s) => skillCard(s, today)).join('')
    : `<div class="card s12">${empty('No sprint yet. Excel, spoken English, typing speed, anything you want to get better at.')}</div>`}</div>`;
}

function openSkillForm(existing) {
  const s = { name: '', goal: '', length: DEFAULT_LENGTH, ...existing };
  const body = `${field({ label: 'Skill', name: 'name', value: s.name, required: true, placeholder: 'e.g. Advanced Excel' })}
    ${field({ label: 'Daily target (optional)', name: 'goal', value: s.goal, placeholder: 'e.g. 20 minutes, one lesson' })}
    ${field({ label: 'Sprint length', name: 'length', type: 'select', value: String(s.length), choices: LENGTHS.map((n) => [String(n), `${n} days`]) })}`;
  openModal(existing ? 'Edit skill sprint' : 'New skill sprint', body, (d) => {
    const patch = { name: d.name.trim(), goal: d.goal.trim(), length: Number(d.length) || DEFAULT_LENGTH };
    if (!patch.name) return false;
    store.update((st) => {
      if (existing) Object.assign(st.skills.find((x) => x.id === existing.id), patch);
      else st.skills.push({ id: uid(), start: todayKey(), days: [], ...patch });
    });
    toast(existing ? 'Sprint updated' : `Day 1 of ${patch.length}. Add today's learning below.`);
  }, { submitLabel: existing ? 'Save' : 'Start sprint' });
}

const findSkill = (id) => store.state.skills.find((x) => x.id === id);

onAction('skill-new', () => openSkillForm());
onAction('skill-edit', (el) => openSkillForm(findSkill(el.dataset.id)));
onAction('skill-del', (el) => {
  const skill = findSkill(el.dataset.id);
  if (!skill || !confirm(`Delete the "${skill.name}" sprint? Its tasks stay, just without the skill link.`)) return;
  store.update((s) => {
    s.skills = s.skills.filter((x) => x.id !== skill.id);
    s.tasks.forEach((t) => { if (t.skill === skill.id) t.skill = ''; });
  });
});
onAction('skill-tick', (el) => store.update((s) => {
  const skill = s.skills.find((x) => x.id === el.dataset.id);
  const today = todayKey();
  if (skill) skill.days = skill.days.includes(today) ? skill.days.filter((d) => d !== today) : [...skill.days, today];
}));
onAction('skill-restart', (el) => store.update((s) => {
  const skill = s.skills.find((x) => x.id === el.dataset.id);
  if (skill) skill.start = todayKey();
}));
onAction('skill-task', (el) => {
  const skill = findSkill(el.dataset.id);
  const input = document.querySelector(`[data-skill-input="${el.dataset.id}"]`);
  const text = input?.value.trim();
  if (!skill || !text) return;
  addTask({ title: `${skill.name}: ${text}`, type: 'Skill', skill: skill.id, date: todayKey() });
  toast('Added to today. Tick it when you are done to grow the streak.');
});
