// Little WebAudio sounds, so there are no audio files to download. Respects the sound setting.
import { store } from './store.js';

let ctx;
function tone(freq, start, dur, { type = 'sine', gain = 0.14, slideTo } = {}) {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const play = (fn) => {
  if (!store.state.profile.sound) return;
  try { fn(); } catch { /* audio blocked until first user gesture: stay quiet */ }
};

export const chime = () => play(() => [[659, 0], [784, 0.18], [988, 0.36]].forEach(([f, t]) => tone(f, t, 0.7)));
export const hoot = () => play(() => {
  tone(460, 0, 0.3, { slideTo: 400 });
  tone(430, 0.36, 0.45, { slideTo: 360 });
});
