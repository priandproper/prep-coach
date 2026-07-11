// scheduler.js — the coach's brain.
// Turns { topics + estHours + priority } and { daily availability − activities,
// capped by cognitive-load limit } into a day-by-day assignment, and detects when
// the plan does not fit within the horizon.

import { addDays, todayISO, daysBetween } from './store.js';

// Effective study hours available on a given calendar day.
export function dayCapacity(config, iso) {
  const av = config.availability;
  const base = (av.overrides && av.overrides[iso] != null) ? av.overrides[iso] : av.defaultHours;
  const cap = config.cognitiveLoad.dailyMaxStudyHours;
  return Math.max(0, Math.min(base, cap));
}

// List of the horizon's calendar days with capacity.
export function horizonDays(plan, config) {
  const out = [];
  for (let i = 0; i < plan.horizonDays; i++) {
    const iso = addDays(plan.startDate, i);
    out.push({ index: i, iso, capacity: dayCapacity(config, iso) });
  }
  return out;
}

// Greedy fill: walk topics in plan order (which is priority-ordered curriculum),
// placing each on the earliest day with remaining capacity. High cognitive-load
// topics still land in curriculum order — the day layout (below) puts them in
// peak hours. Returns { days:[{iso,index,capacity,used,topics[]}], unplaced[] }.
export function buildSchedule(plan, config) {
  const days = horizonDays(plan, config).map(d => ({ ...d, used: 0, topics: [] }));
  const unplaced = [];

  for (const topic of plan.topics) {
    let placed = false;
    for (const day of days) {
      if (day.capacity - day.used >= topic.estHours - 0.001) {
        day.topics.push(topic);
        day.used += topic.estHours;
        placed = true;
        break;
      }
    }
    if (!placed) unplaced.push(topic);
  }
  return { days, unplaced };
}

// Does the plan fit? Compute the gap and concrete fixes.
export function fitAnalysis(plan, config) {
  const cap = horizonDays(plan, config);
  const totalCapacity = cap.reduce((s, d) => s + d.capacity, 0);
  const totalNeeded = plan.topics.reduce((s, t) => s + t.estHours, 0);
  const gap = +(totalNeeded - totalCapacity).toFixed(2);
  const fits = gap <= 0.001;

  const fixes = {};
  if (!fits) {
    // Fix A: raise hours/day evenly across horizon (bounded by burnout cap).
    const perDay = gap / plan.horizonDays;
    const newDaily = +(config.availability.defaultHours + perDay).toFixed(1);
    fixes.moreHours = {
      newDaily,
      feasible: newDaily <= config.cognitiveLoad.dailyMaxStudyHours + 0.001,
      addPerDay: +perDay.toFixed(1),
    };
    // Fix B: extend horizon up to 14 days at current daily capacity.
    const avgDaily = totalCapacity / plan.horizonDays || config.availability.defaultHours;
    const extraDaysNeeded = Math.ceil(gap / Math.max(0.5, avgDaily));
    const newHorizon = Math.min(14, plan.horizonDays + extraDaysNeeded);
    const capacityAtNewHorizon = newHorizon * avgDaily;
    fixes.moreDays = {
      newHorizon,
      feasible: capacityAtNewHorizon >= totalNeeded - 0.001,
      addDays: newHorizon - plan.horizonDays,
    };
    // Fix C: trim lowest-priority topics until it fits.
    const trimmable = [...plan.topics]
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (b.t.priority - a.t.priority) || (b.i - a.i)); // lowest priority first
    const toTrim = [];
    let recovered = 0;
    for (const { t } of trimmable) {
      if (recovered >= gap) break;
      toTrim.push(t);
      recovered += t.estHours;
    }
    fixes.trim = { topics: toTrim, recovered: +recovered.toFixed(1) };
  }

  return { fits, gap, totalNeeded, totalCapacity, fixes, cap };
}

// Lay out one calendar day into time-ordered blocks: activities, study blocks
// (hardest in the peak window), breaks between them, and a job-search block.
// Returns [{ start:'HH:MM', end:'HH:MM', kind, title, detail, topicId? }].
// `override` (optional) = { wakeTime, activities:[{label,minutes,time?,kind?}], jobMinutes }
// from the day's planning questionnaire; falls back to config defaults.
export function layoutDay(plan, config, sched, iso, override) {
  const day = sched.days.find(d => d.iso === iso);
  const blocks = [];
  const wakeStr = (override && override.wakeTime) || config.availability.wakeTime || '08:00';
  const activities = (override && override.activities) || config.activities || [];
  const jobMins = (override && override.jobMinutes != null ? override.jobMinutes : config.jobSearch.dailyMinutes) || 30;

  // Fixed = has a time (placed at that time, study flows around it). Floating = after study.
  const fixed = activities.filter(a => a.time)
    .map(a => ({ ...a, s: toMin(a.time), e: toMin(a.time) + (a.minutes || 30) }))
    .sort((x, y) => x.s - y.s);
  const floating = activities.filter(a => !a.time);

  for (const a of fixed) blocks.push(block(fromMin(a.s), fromMin(a.e), a.kind || 'activity', a.label, ''));

  const peakStart = toMin(config.cognitiveLoad.peakStart || '09:00');
  const loadRank = { high: 0, medium: 1, low: 2 };
  const topics = day ? [...day.topics].sort((a, b) => (loadRank[a.load] ?? 1) - (loadRank[b.load] ?? 1)) : [];

  let cursor = skipFixed(toMin(wakeStr), fixed);
  if (cursor < peakStart && topics.some(t => t.load === 'high')) cursor = skipFixed(Math.max(cursor, peakStart), fixed);

  const pomo = config.pomodoro;
  let sinceBreak = 0;
  for (let i = 0; i < topics.length; i++) {
    const mins = Math.round(topics[i].estHours * 60);
    cursor = fitBefore(cursor, mins, fixed);
    blocks.push(block(fromMin(cursor), fromMin(cursor + mins), 'study', topics[i].title, topics[i].summary, topics[i].id));
    cursor += mins;
    if (i < topics.length - 1) {
      sinceBreak++;
      const brk = (sinceBreak % pomo.longEvery === 0) ? pomo.longBreak : pomo.shortBreak;
      cursor = skipFixed(cursor, fixed);
      blocks.push(block(fromMin(cursor), fromMin(cursor + brk), 'break', 'Break', 'Stand, water, look away'));
      cursor += brk;
    }
    cursor = skipFixed(cursor, fixed);
  }

  for (const a of floating) {
    cursor = skipFixed(cursor, fixed);
    blocks.push(block(fromMin(cursor), fromMin(cursor + (a.minutes || 30)), a.kind || 'activity', a.label, ''));
    cursor += a.minutes || 30;
  }

  cursor = skipFixed(cursor, fixed);
  blocks.push(block(fromMin(cursor), fromMin(cursor + jobMins), 'job', 'LinkedIn + applications',
    'Apply to roles, send connection requests, follow up on coffee chats'));

  return blocks.sort((a, b) => toMin(a.start) - toMin(b.start));
}

// If cursor falls inside a fixed block, jump to that block's end (repeat).
function skipFixed(cursor, fixed) {
  let moved = true;
  while (moved) { moved = false; for (const a of fixed) { if (cursor >= a.s && cursor < a.e) { cursor = a.e; moved = true; } } }
  return cursor;
}
// Ensure a [cursor, cursor+dur] block doesn't straddle a fixed block; else jump past it.
function fitBefore(cursor, dur, fixed) {
  cursor = skipFixed(cursor, fixed);
  let moved = true;
  while (moved) {
    moved = false;
    for (const a of fixed) {
      if (cursor < a.e && cursor + dur > a.s) { cursor = skipFixed(a.e, fixed); moved = true; break; }
    }
  }
  return cursor;
}

// Which curriculum day-index is "today" (0-based), or -1 if outside horizon.
export function currentDayIndex(plan) {
  const idx = daysBetween(plan.startDate, todayISO());
  return (idx >= 0 && idx < plan.horizonDays) ? idx : (idx < 0 ? -1 : plan.horizonDays);
}

// ---- time helpers ----
function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function fromMin(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function addMin(hhmm, mins) { return fromMin(toMin(hhmm) + mins); }
function block(start, end, kind, title, detail, topicId) { return { start, end, kind, title, detail, topicId }; }
