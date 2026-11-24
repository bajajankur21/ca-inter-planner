// Tiny SVG charts. No library: the planner has to work offline and load instantly.
import { esc } from './util.js';

/** items: [{label, value, highlight?}] */
export function barChart(items, { height = 150, unit = '', color = 'var(--pink)', accent = 'var(--brown)' } = {}) {
  if (!items.length) return '';
  const w = 34;
  const max = Math.max(1, ...items.map((x) => x.value));
  const bars = items.map((x, i) => {
    const h = Math.round((x.value / max) * (height - 24));
    const xPos = i * w + 6;
    const label = `${x.label}: ${x.value}${unit}`;
    return `<g><title>${esc(label)}</title>
      <rect x="${xPos}" y="${height - h}" width="${w - 12}" height="${Math.max(h, 2)}" rx="5" fill="${x.highlight ? accent : color}" opacity="${x.value ? 1 : 0.35}"/>
      ${x.value ? `<text x="${xPos + (w - 12) / 2}" y="${height - h - 5}" text-anchor="middle">${esc(x.value)}</text>` : ''}
      <text x="${xPos + (w - 12) / 2}" y="${height + 14}" text-anchor="middle">${esc(x.label)}</text></g>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${items.length * w + 12} ${height + 20}" role="img" aria-label="Bar chart">${bars}</svg></div>`;
}

/** values: numbers 0-100 or null (not yet happened). */
export function lineChart(values, labels, { height = 110, color = 'var(--pink-ink)' } = {}) {
  const step = 22;
  const width = Math.max(1, values.length - 1) * step + 20;
  const y = (v) => 8 + (height - 16) * (1 - v / 100);
  const pts = values.map((v, i) => (v == null ? null : [10 + i * step, y(v)])).filter(Boolean);
  if (!pts.length) return '';
  const line = pts.map(([px, py]) => `${px},${py}`).join(' ');
  const area = `M${pts[0][0]},${height} L${line.replace(/ /g, ' L')} L${pts.at(-1)[0]},${height} Z`;
  const ticks = labels.map((l, i) => (i % 5 === 0 || i === labels.length - 1 ? `<text x="${10 + i * step}" y="${height + 13}" text-anchor="middle">${esc(l)}</text>` : '')).join('');
  const grid = [0, 50, 100].map((v) => `<line x1="0" x2="${width}" y1="${y(v)}" y2="${y(v)}" stroke="#f0ebe6"/>`).join('');
  const dots = pts.map(([px, py], i) => `<circle cx="${px}" cy="${py}" r="2.6" fill="${color}"><title>${esc(values.filter((v) => v != null)[i])}%</title></circle>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${width} ${height + 18}" role="img" aria-label="Line chart">${grid}
    <path d="${area}" fill="${color}" opacity=".08"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${dots}${ticks}</svg></div>`;
}
