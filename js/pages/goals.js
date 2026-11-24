// Goals across 6 life areas with sub-steps, year at a glance, and a vision board.
import { store } from '../store.js';
import { view, rerender } from '../router.js';
import { esc, ring, bar, barRow, empty, pct, field, openModal, fmt, icon, uid, toast, onAction, onChange, todayKey } from '../util.js';
import { goalPct, isAchieved } from '../stats.js';

export const title = 'Dream it, then break it down.';

export const AREAS = [
  ['studies', 'CA Inter & studies', '#f2b8c2'], ['career', 'Career', '#c3b3e3'], ['health', 'Health & wellness', '#a9d3a5'],
  ['growth', 'Personal growth', '#f5d27a'], ['money', 'Finances', '#9cc6e4'], ['family', 'Family & relationships', '#f4bf9a'],
];
const MAX_VISION = 24;
const IMG_MAX_PX = 640;

function goalCard(g) {
  const p = goalPct(g);
  const done = isAchieved(g);
  return `<div class="goal${done ? ' achieved' : ''}">
    <div class="spread"><label class="check"><input type="checkbox" data-change="goal-done" data-id="${g.id}" ${done ? 'checked' : ''}> <b>${esc(g.title)}</b></label>
      <button class="icon-btn" data-act="goal-del" data-id="${g.id}" aria-label="Delete goal ${esc(g.title)}">${icon('x')}</button></div>
    <small class="muted">${g.month ? `Target ${fmt(`${g.month}-01`, { month: 'short', year: 'numeric' })}` : 'No target month'} - ${p}%</small>
    ${bar(p)}
    <div class="steps">${(g.steps || []).map((st) => `<label class="check"><input type="checkbox" data-change="step-done" data-id="${g.id}" data-k="${st.id}" ${st.done ? 'checked' : ''}> ${esc(st.text)}</label>`).join('')}</div>
    <div class="addrow"><input class="field" data-step-input="${g.id}" placeholder="Add a step..." aria-label="New step for ${esc(g.title)}"><button data-act="step-add" data-id="${g.id}" aria-label="Add step">${icon('plus')}</button></div>
  </div>`;
}

function yearAtGlance(year) {
  const goals = store.state.goals;
  return Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
    const list = goals.filter((g) => g.month === ym);
    return `<div class="yearcell"><b>${fmt(`${ym}-01`, { month: 'long' })}</b><small class="muted">${list.filter(isAchieved).length}/${list.length} done</small>
      ${list.map((g) => `<div class="yg${isAchieved(g) ? ' done' : ''}">${isAchieved(g) ? icon('check') : '<span class="dot"></span>'} ${esc(g.title)}</div>`).join('')}</div>`;
  }).join('');
}

export function render(el) {
  const { goals, vision } = store.state;
  const achieved = goals.filter(isAchieved).length;
  const year = view.goalYear;
  el.innerHTML = `
  <div class="grid">
    <div class="card s4 center">${ring(pct(achieved, goals.length), `${achieved} / ${goals.length}`, { big: true })}<h3 class="mt">Goals achieved</h3>
      <button class="btn primary" data-act="goal-new">${icon('plus')} New goal</button></div>
    <div class="card s8"><h3>Areas of life</h3><div class="stack">${AREAS.map(([k, label, color]) => {
      const list = goals.filter((g) => g.area === k);
      return barRow(label, pct(list.filter(isAchieved).length, list.length), color, `${list.filter(isAchieved).length}/${list.length}`);
    }).join('')}</div></div>
  </div>
  <div class="grid mt">${AREAS.map(([k, label, color]) => {
    const list = goals.filter((g) => g.area === k);
    return `<div class="card s4 area" style="--area:${color}"><div class="spread"><h3>${esc(label)}</h3><button class="icon-btn" data-act="goal-new" data-area="${k}" aria-label="Add goal to ${esc(label)}">${icon('plus')}</button></div>
      <div class="stack">${list.length ? list.map(goalCard).join('') : empty('No goals here yet.')}</div></div>`;
  }).join('')}</div>

  <div class="sect"><h3>Year at a glance</h3><div class="datenav">
    <button class="icon-btn" data-act="goal-year" data-n="-1" aria-label="Previous year">${icon('left')}</button><b>${year}</b>
    <button class="icon-btn" data-act="goal-year" data-n="1" aria-label="Next year">${icon('right')}</button></div></div>
  <div class="card"><div class="yeargrid">${yearAtGlance(year)}</div></div>

  <div class="sect"><h3>Vision board</h3>
    <label class="btn primary">${icon('image')} Add images<input type="file" accept="image/*" multiple data-change="vision-add" class="sr-only"></label></div>
  <div class="card">${vision.length ? `<div class="vision">${vision.filter((v) => String(v.src).startsWith('data:image/')).map((v) => `<figure>
      <img src="${esc(v.src)}" alt="${esc(v.caption || 'Vision board image')}" loading="lazy">
      <figcaption><input class="field" value="${esc(v.caption)}" placeholder="Caption" data-change="vision-caption" data-id="${v.id}" aria-label="Caption"></figcaption>
      <button class="icon-btn vdel" data-act="vision-del" data-id="${v.id}" aria-label="Remove image">${icon('x')}</button></figure>`).join('')}</div>`
    : empty('Add photos that remind you why: the CA badge, your family, the life you are building.')}</div>`;
}

/** Shrink to a small JPEG so localStorage (about 5 MB) holds plenty of images. */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, IMG_MAX_PX / Math.max(img.width, img.height));
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const findGoal = (s, id) => s.goals.find((g) => g.id === id);

onAction('goal-new', (el) => {
  const body = `${field({ label: 'Goal', name: 'title', required: true, placeholder: 'e.g. Finish R1 of all Group I papers' })}
    <div class="form2">${field({ label: 'Area', name: 'area', type: 'select', value: el.dataset.area || 'studies', choices: AREAS.map(([k, l]) => [k, l]) })}
    ${field({ label: 'Target month', name: 'month', type: 'month', value: todayKey().slice(0, 7) })}</div>`;
  openModal('New goal', body, (d) => {
    if (!d.title.trim()) return false;
    store.update((s) => s.goals.push({ id: uid(), title: d.title.trim(), area: d.area, month: d.month, done: false, steps: [] }));
    toast('Goal added. Break it into small steps!');
  });
});
onAction('goal-del', (el) => {
  if (confirm('Delete this goal?')) store.update((s) => { s.goals = s.goals.filter((g) => g.id !== el.dataset.id); });
});
onChange('goal-done', (el) => store.update((s) => {
  const g = findGoal(s, el.dataset.id);
  g.done = el.checked;
  if (g.steps?.length) g.steps.forEach((st) => { st.done = el.checked; });
}));
onAction('step-add', (el) => {
  const input = document.querySelector(`[data-step-input="${el.dataset.id}"]`);
  const text = input.value.trim();
  if (text) store.update((s) => { findGoal(s, el.dataset.id).steps.push({ id: uid(), text, done: false }); });
});
onChange('step-done', (el) => store.update((s) => {
  const g = findGoal(s, el.dataset.id);
  g.steps.find((st) => st.id === el.dataset.k).done = el.checked;
  if (!el.checked) g.done = false;
}));
onAction('goal-year', (el) => { view.goalYear += Number(el.dataset.n); rerender(); });
onChange('vision-add', async (el) => {
  const files = [...el.files].filter((f) => f.type.startsWith('image/'));
  el.value = '';
  const room = MAX_VISION - store.state.vision.length;
  if (files.length > room) toast(`The board holds ${MAX_VISION} images, adding the first ${Math.max(room, 0)}.`);
  try {
    const srcs = await Promise.all(files.slice(0, Math.max(room, 0)).map(shrink));
    store.update((s) => s.vision.push(...srcs.map((src) => ({ id: uid(), src, caption: '' }))));
  } catch {
    toast('That image could not be read. Try a JPG or PNG.');
  }
});
onChange('vision-caption', (el) => store.update((s) => { s.vision.find((v) => v.id === el.dataset.id).caption = el.value; }, { silent: true }));
onAction('vision-del', (el) => store.update((s) => { s.vision = s.vision.filter((v) => v.id !== el.dataset.id); }));
