// CA Inter papers: chapter-wise revision tracker (Read, R1, R2, R3, MTP/Qs) and exam countdown.
import { store } from '../store.js';
import { esc, ring, bar, empty, field, openModal, onAction, onChange, uid, toast, icon } from '../util.js';
import { STAGES, paperPct, stagePct, syllabusPct, minutesForPaper, hoursLabel, daysToExam } from '../stats.js';

export const title = 'Every chapter, every revision.';

const findPaper = (s, id) => s.papers.find((p) => p.id === id);

function paperCard(p) {
  const progress = paperPct(p);
  const rows = p.chapters.map((c) => `<tr>
      <td class="wide">${esc(c.name)}</td>
      ${STAGES.map(([k, l]) => `<td><input type="checkbox" data-change="chapter-mark" data-id="${p.id}" data-k="${c.id}:${k}" ${c.marks?.[k] ? 'checked' : ''} aria-label="${l}: ${esc(c.name)}"></td>`).join('')}
      <td><button class="icon-btn" data-act="chapter-del" data-id="${p.id}" data-k="${c.id}" aria-label="Remove ${esc(c.name)}">${icon('x')}</button></td>
    </tr>`).join('');
  return `<div class="card s6 paper" style="--tone:${p.color}">
    <div class="paper-head">
      ${ring(progress, `${progress}%`, { color: p.color })}
      <div class="grow"><span class="eyebrow">${esc(p.group)} - ${esc(p.short)}</span><h3>${esc(p.name)}</h3>
        <small class="muted">${p.chapters.length} chapters - ${hoursLabel(minutesForPaper(p.id))} focused</small></div>
    </div>
    <div class="stagebars">${STAGES.map(([k, l]) => `<div><small>${l}</small>${bar(stagePct(p, k), p.color)}</div>`).join('')}</div>
    ${p.chapters.length ? `<div class="tablewrap"><table class="tbl chapters"><thead><tr><th>Chapter</th>${STAGES.map(([, l]) => `<th>${l}</th>`).join('')}<th><span class="sr-only">Remove</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : empty('Add the chapters from your ICAI module, or paste them all at once.')}
    <div class="addrow"><input class="field" data-paper-input="${p.id}" placeholder="Add a chapter..." aria-label="New chapter for ${esc(p.short)}">
      <button data-act="chapter-add" data-id="${p.id}" aria-label="Add chapter">${icon('plus')}</button></div>
    <button class="btn mt" data-act="chapter-bulk" data-id="${p.id}">Paste chapter list</button>
  </div>`;
}

export function render(el) {
  const s = store.state;
  const days = daysToExam();
  const syl = syllabusPct();
  const groups = [...new Set(s.papers.map((p) => p.group))];
  el.innerHTML = `
  <div class="grid">
    <div class="card s4 center">${ring(syl, `${syl}%`, { big: true })}<h3 class="mt">Syllabus ticked</h3>
      <small class="muted">Each chapter counts Read, R1, R2, R3 and MTP / question practice.</small></div>
    <div class="card s8"><h3>Exam countdown</h3>
      <div class="countdown"><strong>${days == null ? '--' : Math.max(days, 0)}</strong><span>days left</span></div>
      <div class="form2 mt">
        <label class="lbl">Exam start date<input class="field" type="date" value="${esc(s.profile.examDate)}" data-change="profile" data-field="examDate"></label>
        <label class="lbl">Attempt<input class="field" value="${esc(s.profile.attempt)}" placeholder="e.g. May 2027, both groups" data-change="profile" data-field="attempt"></label>
      </div>
    </div>
  </div>
  ${groups.map((g) => `<div class="sect"><h3>${esc(g)}</h3></div><div class="grid">${s.papers.filter((p) => p.group === g).map(paperCard).join('')}</div>`).join('')}`;
}

function addChapters(paperId, names) {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return;
  store.update((s) => findPaper(s, paperId).chapters.push(...clean.map((name) => ({ id: uid(), name, marks: {} }))));
  toast(`${clean.length} chapter${clean.length > 1 ? 's' : ''} added`);
}

onAction('chapter-add', (el) => {
  const input = document.querySelector(`[data-paper-input="${el.dataset.id}"]`);
  addChapters(el.dataset.id, [input.value]);
});
onAction('chapter-bulk', (el) => {
  const paper = findPaper(store.state, el.dataset.id);
  openModal(`Chapters for ${paper.short}`, field({ label: 'One chapter per line', name: 'list', type: 'textarea', placeholder: 'Chapter 1\nChapter 2\n...', attrs: 'rows="10"' }),
    (data) => addChapters(paper.id, data.list.split('\n')), { submitLabel: 'Add chapters' });
});
onAction('chapter-del', (el) => {
  if (!confirm('Remove this chapter and its ticks?')) return;
  store.update((s) => { const p = findPaper(s, el.dataset.id); p.chapters = p.chapters.filter((c) => c.id !== el.dataset.k); });
});
onChange('chapter-mark', (el) => store.update((s) => {
  const [chapterId, stage] = el.dataset.k.split(':');
  const chapter = findPaper(s, el.dataset.id).chapters.find((c) => c.id === chapterId);
  chapter.marks = { ...chapter.marks, [stage]: el.checked };
}));
