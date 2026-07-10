// pomodoro.js — configurable focus timer with work/short/long cycles.
// Emits ticks and phase-change events; the Today view renders it and wires
// notifications on transitions.

import { notify } from './notify.js';

export class Pomodoro {
  constructor(cfg) {
    this.cfg = cfg;                 // { work, shortBreak, longBreak, longEvery }
    this.phase = 'idle';            // 'work' | 'short' | 'long' | 'idle'
    this.remaining = 0;             // seconds
    this.completed = 0;             // completed work sessions
    this._int = null;
    this.onTick = () => {};
    this.onPhase = () => {};
  }

  _phaseSeconds(phase) {
    if (phase === 'work') return this.cfg.work * 60;
    if (phase === 'short') return this.cfg.shortBreak * 60;
    if (phase === 'long') return this.cfg.longBreak * 60;
    return 0;
  }

  start(phase = 'work') {
    this.stop();
    this.phase = phase;
    this.remaining = this._phaseSeconds(phase);
    this.onPhase(this.phase);
    this._int = setInterval(() => this._tick(), 1000);
    this.onTick(this.remaining);
  }

  _tick() {
    this.remaining--;
    if (this.remaining <= 0) { this._advance(); return; }
    this.onTick(this.remaining);
  }

  _advance() {
    clearInterval(this._int);
    if (this.phase === 'work') {
      this.completed++;
      const isLong = this.completed % this.cfg.longEvery === 0;
      const next = isLong ? 'long' : 'short';
      notify('Focus block done ✅', isLong ? 'Take a longer break — stretch and step away.' : 'Short break. Water, eyes off screen.', 'pomo');
      this.start(next);
    } else {
      notify('Break over ⏱️', 'Phone away — back into it. Start your next focus block.', 'pomo');
      this.phase = 'idle';
      this.remaining = 0;
      this.onPhase(this.phase);
      this.onTick(0);
    }
  }

  pause() { if (this._int) { clearInterval(this._int); this._int = null; this.onPhase(this.phase + ':paused'); } }
  resume() { if (!this._int && this.remaining > 0) { this._int = setInterval(() => this._tick(), 1000); this.onPhase(this.phase); } }
  stop() { if (this._int) clearInterval(this._int); this._int = null; this.phase = 'idle'; this.remaining = 0; }
  get running() { return !!this._int; }

  static fmt(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
