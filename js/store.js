// store.js — single source of truth. All app state lives in one localStorage blob.
import { SQL_PLAN } from './data/sql-plan.js';

const KEY = 'prepcoach.v1';
const SCHEMA_VERSION = 1;

// ---- date helpers (local-time, no timezone drift) ----
export function todayISO(d = new Date()) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return todayISO(d);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
export function weekStartISO(iso = todayISO()) {
  // Monday as start of week
  const d = new Date(iso + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return todayISO(d);
}

// ---- default state ----
function defaults() {
  const start = todayISO();
  const plan = JSON.parse(JSON.stringify(SQL_PLAN));
  plan.startDate = start;
  return {
    schemaVersion: SCHEMA_VERSION,
    config: {
      availability: {
        defaultHours: 5,             // focused study hours available per day
        wakeTime: '08:00',           // when the daily schedule starts laying out blocks
        overrides: {},               // { 'YYYY-MM-DD': hours }
      },
      activities: [                  // recurring non-study commitments carved out of the day
        { id: 'act-gym', label: 'Gym', minutes: 60, time: '07:00' },
        { id: 'act-walk', label: 'Walk / fresh air', minutes: 30, time: '' },
        { id: 'act-meals', label: 'Meals', minutes: 90, time: '' },
      ],
      cognitiveLoad: {
        peakStart: '09:00',          // when you're sharpest — hardest topics go here
        peakEnd: '12:00',
        dailyMaxStudyHours: 6,       // burnout cap — scheduler never exceeds this
      },
      studySpaces: [
        {
          id: 'sp-home', label: 'Home study table', active: true,
          checklist: [
            'Phone in another room / on Do-Not-Disturb',
            'Water + coffee within reach',
            'Notebook & pen out',
            'Close email + Slack + non-study tabs',
            'Headphones on',
          ],
        },
        {
          id: 'sp-starbucks', label: 'Starbucks', active: true,
          checklist: [
            'Phone face-down, notifications off',
            'Laptop charged / charger packed',
            'Headphones + focus playlist',
            'One clear goal for this sitting',
          ],
        },
      ],
      pomodoro: { work: 25, shortBreak: 5, longBreak: 15, longEvery: 4, breakMode: 'auto' }, // 'auto' | 'ask'
      jobSearch: {
        weeklyApplications: 12,      // target 10–15/week
        weeklyCoffeeChats: 10,
        eadDeadline: addDays(start, 89), // <90 days from today
        consultantNote: 'Consultant is applying on my behalf — I complement it with my own apps + chats.',
        dailyMinutes: 120,           // daily applications time (2 hrs)
      },
    },
    plan,   // { goal, startDate, horizonDays, topics[] }
    progress: {
      // keyed by ISO date: { taskIds:[], studyMinutes, blocksCompleted, spaceUsed }
      days: {},
      dayCursor: 0,        // self-paced: current 0-based sprint day (advances on completion)
      doneTasks: [],       // completed task ids (e.g. 't2:0'), independent of the calendar
      streak: 0,
      lastCompletedDate: null,
      // weekly job-search log keyed by week-start ISO: { applications, coffeeChats }
      jobLog: {},
    },
  };
}

// ---- load / save ----
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.warn('prep-coach: failed to load state, starting fresh', e);
    return defaults();
  }
}

function migrate(s) {
  // Ensure plan.startDate exists and shape is current; keep forward-compatible.
  const base = defaults();
  if (!s.schemaVersion) s.schemaVersion = SCHEMA_VERSION;
  if (!s.plan) s.plan = base.plan;
  if (!s.plan.startDate) s.plan.startDate = todayISO();
  if (!s.progress) s.progress = base.progress;
  if (!s.progress.days) s.progress.days = {};
  if (!s.progress.jobLog) s.progress.jobLog = {};
  if (!s.config) s.config = base.config;
  // fill any missing config keys without clobbering user edits
  s.config = deepFill(s.config, base.config);

  // refresh built-in curriculum wording when content version changes,
  // preserving each topic's scheduling fields, dates, and progress.
  if (s.plan.contentVersion !== SQL_PLAN.contentVersion) {
    const src = Object.fromEntries(SQL_PLAN.topics.map(t => [t.id, t]));
    for (const t of s.plan.topics || []) {
      const o = src[t.id];
      if (o) { t.title = o.title; t.summary = o.summary; t.checklist = o.checklist.slice(); t.resourceRefs = o.resourceRefs.slice(); }
    }
    s.plan.contentVersion = SQL_PLAN.contentVersion;
  }

  // Migrate to the self-paced model: gather completed task ids from the old
  // calendar-keyed records, and set the day cursor to the number of fully-done
  // leading days so the user lands where they actually are (not a calendar day).
  if (s.progress.doneTasks == null) {
    const all = new Set();
    for (const iso in (s.progress.days || {})) {
      for (const id of (s.progress.days[iso].taskIds || [])) all.add(id);
    }
    s.progress.doneTasks = [...all];
  }
  if (s.progress.dayCursor == null) {
    const done = new Set(s.progress.doneTasks);
    let c = 0;
    for (const t of (s.plan.topics || [])) {
      const items = t.checklist || [];
      if (items.length && items.every((_, i) => done.has(`${t.id}:${i}`))) c++; else break;
    }
    s.progress.dayCursor = c;
  }
  return s;
}

function deepFill(target, src) {
  if (Array.isArray(src)) return target === undefined ? src : target;
  if (src && typeof src === 'object') {
    const out = target && typeof target === 'object' ? target : {};
    for (const k of Object.keys(src)) out[k] = deepFill(out[k], src[k]);
    return out;
  }
  return target === undefined ? src : target;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('prep-coach: save failed', e);
  }
  emit();
}

// ---- accessors ----
export function get() { return state; }
export function config() { return state.config; }
export function plan() { return state.plan; }
export function progress() { return state.progress; }

// day progress record helper
export function dayRecord(iso) {
  if (!state.progress.days[iso]) {
    state.progress.days[iso] = { taskIds: [], studyMinutes: 0, blocksCompleted: 0, spaceUsed: null };
  }
  return state.progress.days[iso];
}

// ---- reactive subscriptions ----
const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) { try { fn(state); } catch (e) { console.error(e); } } }

// ---- reset / export / import ----
export function resetAll() {
  state = defaults();
  save();
}
export function loadSamplePlan() {
  state.plan = JSON.parse(JSON.stringify(SQL_PLAN));
  state.plan.startDate = todayISO();
  save();
}
export function exportJSON() {
  return JSON.stringify(state, null, 2);
}
export function importJSON(text) {
  const parsed = JSON.parse(text);
  state = migrate(parsed);
  save();
}
