// The study owl: an SVG character with moods. It sleeps until a session starts, then watches you.
const owls = new Set();
let pointer = null;
let frame = 0;

const AWAKE = new Set(['awake', 'watch', 'break', 'suspicious']);

const eye = (side, cx, id) => `
  <g class="owl-eye" clip-path="url(#${id}-${side})">
    <circle class="owl-sclera" cx="${cx}" cy="92" r="22"/>
    <g class="owl-pupil"><circle class="owl-iris" cx="${cx}" cy="92" r="11"/><circle class="owl-glint" cx="${cx + 4}" cy="87" r="3.5"/></g>
    <rect class="owl-lid" x="${cx - 24}" y="69" width="48" height="47"/>
  </g>`;

const markup = (id, label) => `
<svg class="owl" viewBox="0 0 200 232" data-state="sleep" role="button" tabindex="0" aria-label="${label}">
  <defs>
    <clipPath id="${id}-l"><circle cx="72" cy="92" r="22"/></clipPath>
    <clipPath id="${id}-r"><circle cx="128" cy="92" r="22"/></clipPath>
  </defs>
  <ellipse class="owl-shadow" cx="100" cy="224" rx="56" ry="6"/>
  <g class="owl-tilt"><g class="owl-bob">
    <g class="owl-wing owl-wing-l"><path d="M48 112 C24 132 26 176 52 196 C58 170 62 140 60 114Z"/></g>
    <g class="owl-wing owl-wing-r"><path d="M152 112 C176 132 174 176 148 196 C142 170 138 140 140 114Z"/></g>
    <path class="owl-ear" d="M50 64 L40 20 L86 48Z"/>
    <path class="owl-ear" d="M150 64 L160 20 L114 48Z"/>
    <ellipse class="owl-body" cx="100" cy="134" rx="62" ry="80"/>
    <ellipse class="owl-belly" cx="100" cy="160" rx="40" ry="50"/>
    <path class="owl-feathers" d="M80 140 q6 6 12 0 q6 6 12 0 q6 6 12 0 M86 160 q6 6 12 0 q6 6 12 0 M80 180 q6 6 12 0 q6 6 12 0 q6 6 12 0"/>
    <circle class="owl-face" cx="72" cy="92" r="30"/>
    <circle class="owl-face" cx="128" cy="92" r="30"/>
    ${eye('l', 72, id)}${eye('r', 128, id)}
    <g class="owl-brows"><path d="M50 62 L90 74"/><path d="M150 62 L110 74"/></g>
    <path class="owl-happy" d="M56 96 Q72 78 88 96 M112 96 Q128 78 144 96"/>
    <path class="owl-beak" d="M92 108 L108 108 L100 124Z"/>
    <circle class="owl-cheek" cx="54" cy="118" r="7"/><circle class="owl-cheek" cx="146" cy="118" r="7"/>
    <path class="owl-feet" d="M80 210 l-6 10 M86 210 v11 M92 210 l6 10 M108 210 l-6 10 M114 210 v11 M120 210 l6 10"/>
  </g></g>
  <g class="owl-zzz" aria-hidden="true"><text x="150" y="44">z</text><text x="164" y="28">z</text><text x="178" y="12">Z</text></g>
</svg>`;

function aimPupils(owl, dx, dy) {
  const dist = Math.hypot(dx, dy) || 1;
  const reach = Math.min(8, dist / 25);
  const t = `translate(${((dx / dist) * reach).toFixed(1)} ${((dy / dist) * reach).toFixed(1)})`;
  owl.pupils.forEach((p) => p.setAttribute('transform', t));
}

function track() {
  frame = 0;
  for (const owl of owls) {
    if (!owl.el.isConnected) { owl.destroy(); continue; }
    if (!AWAKE.has(owl.state) || !pointer || !owl.el.getClientRects().length) continue;
    const r = owl.el.getBoundingClientRect();
    aimPupils(owl, pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height * 0.4));
  }
}
document.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  pointer = { x: e.clientX, y: e.clientY };
  frame ||= requestAnimationFrame(track);
}, { passive: true });

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * Mount an owl into host. Returns {setState, flash, state}.
 * States: sleep | awake | watch | break | suspicious | happy | celebrate
 */
export function createOwl(host, { label = 'Study owl. Tap to pet.', onPet } = {}) {
  const id = `owl${Math.random().toString(36).slice(2, 8)}`;
  host.innerHTML = markup(id, label);
  const el = host.querySelector('svg');
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  const owl = {
    el,
    pupils: [...el.querySelectorAll('.owl-pupil')],
    state: 'sleep',
    base: 'sleep',

    /** Persistent mood. */
    setState(state) {
      const wasAsleep = owl.state === 'sleep';
      owl.base = state;
      owl.state = state;
      el.dataset.state = state;
      if (wasAsleep && state !== 'sleep') {
        el.classList.add('waking');
        later(() => el.classList.remove('waking'), 900);
      }
    },

    /** Temporary mood, then back to the persistent one. */
    flash(state, ms = 1600) {
      owl.state = state;
      el.dataset.state = state;
      clearTimeout(owl.flashTimer);
      owl.flashTimer = setTimeout(() => owl.setState(owl.base), ms);
    },

    destroy() {
      timers.forEach(clearTimeout);
      clearTimeout(owl.flashTimer);
      owls.delete(owl);
    },
  };

  // Blinks at a natural, irregular pace.
  const blink = () => {
    if (!el.isConnected) return owl.destroy();
    if (AWAKE.has(owl.state)) {
      el.classList.add('blink');
      later(() => el.classList.remove('blink'), 140);
    }
    later(blink, rand(2200, 5600));
  };
  // Keeps an eye on things: head tilts, and on touch screens it glances around by itself.
  const fidget = () => {
    if (!el.isConnected) return owl.destroy();
    if (owl.state === 'watch' || owl.state === 'awake') {
      const side = Math.random() < 0.5 ? 'tilt-l' : 'tilt-r';
      el.classList.add(side);
      later(() => el.classList.remove(side), 1300);
      if (!pointer) aimPupils(owl, rand(-1, 1), rand(-0.4, 0.6));
    }
    later(fidget, rand(4000, 9000));
  };
  later(blink, 1500);
  later(fidget, 3000);

  const pet = () => {
    if (owl.state === 'sleep') {
      el.classList.add('stir');
      later(() => el.classList.remove('stir'), 700);
    } else {
      owl.flash('happy', 1400);
    }
    onPet?.(owl.base);
  };
  el.addEventListener('click', pet);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(); }
  });

  owls.add(owl);
  return owl;
}
