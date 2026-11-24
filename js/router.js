// Hash routing plus the bits of view state that pages share (selected day, month, filters).
import { todayKey, onAction } from './util.js';

const today = todayKey();
export const view = {
  date: today,                       // daily + weekly
  month: today.slice(0, 7),          // monthly
  habitMonth: today.slice(0, 7),
  goalYear: Number(today.slice(0, 4)),
  trackerFilter: 'week',
};

let renderer = () => {};
export const setRenderer = (fn) => { renderer = fn; };
export const rerender = () => renderer();

export function go(page, patch = {}) {
  Object.assign(view, patch);
  if (location.hash.slice(1) === page) renderer();
  else location.hash = page;
}

// Navigation actions shared by every page.
onAction('go', (el) => go(el.dataset.page));
onAction('open-day', (el) => go('daily', { date: el.dataset.date }));
