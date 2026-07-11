// today.js — the accountability home screen.
import { h, mount, toast, fmtHours, niceDate } from '../ui.js';
import * as store from '../store.js';
import { buildSchedule, layoutDay, currentDayIndex } from '../scheduler.js';
import { Pomodoro } from '../pomodoro.js';
import { buildICS, downloadICS } from '../ics.js';
import { requestPermission, permission } from '../notify.js';
import { RESOURCES } from '../data/resources.js';
import { burst } from '../confetti.js';

let pomo = null;              // persists across re-renders so a running timer survives
let selectedSpaceId = null;
let audioCtx = null;          // unlocked on first Start; drives the chime
let lastBase = 'idle';        // last pomodoro phase base, to chime only on real transitions
let focusOverlay = null;      // the full-screen focus-mode element
let focusSeconds = 0;         // accumulated focused (work-phase) seconds this session
let heroTaskIdx = null;       // which task is showing in the center dial

// ---- task derivation ----
export function tasksForDay(iso, sched, plan) {
  const day = sched.days.find(d => d.iso === iso);
  if (!day) return [];
  const out = [];
  for (const t of day.topics) {
    (t.checklist || []).forEach((item, i) => {
      out.push({ id: `${t.id}:${i}`, title: item, topic: t, priority: t.priority, load: t.load });
    });
  }
  return out;
}

function dayComplete(iso, sched, plan) {
  const tasks = tasksForDay(iso, sched, plan);
  if (!tasks.length) return false;
  const rec = store.progress().days[iso];
  const done = new Set(rec ? rec.taskIds : []);
  return tasks.every(t => done.has(t.id));
}

// A day "counts" on a low, protectable bar: any task checked OR any focused time.
function isActiveDay(iso) {
  const rec = store.progress().days[iso];
  if (!rec) return false;
  return (rec.taskIds && rec.taskIds.length > 0) || (rec.studyMinutes || 0) > 0;
}

// Forgiving streak: a single missed day is auto-bridged (up to 2 "freezes");
// only two misses in a row actually break it. Never punishes one off day.
export function computeStreak() {
  let iso = store.todayISO();
  if (!isActiveDay(iso)) iso = store.addDays(iso, -1); // today may still be in progress
  let streak = 0, freezes = 0, gap = 0;
  const MAX_FREEZES = 2, MAX_ITER = 400;
  for (let i = 0; i < MAX_ITER; i++) {
    if (isActiveDay(iso)) { streak++; gap = 0; }
    else {
      gap++;
      if (gap >= 2 || freezes >= MAX_FREEZES) break; // real break
      freezes++; // bridge a single off day
    }
    iso = store.addDays(iso, -1);
  }
  return streak;
}

// ---- render ----
export function render(root) {
  const plan = store.plan();
  const config = store.config();
  const sched = buildSchedule(plan, config);
  const iso = store.todayISO();
  const dayIdx = currentDayIndex(plan);

  if (dayIdx === -1) {
    mount(root, [h('div.card', {}, [
      h('h2', {}, 'Your sprint hasn’t started yet'),
      h('p.sub', {}, `It begins ${niceDate(plan.startDate)}. Change the start date in Setup to begin today.`),
    ])]);
    return;
  }
  if (dayIdx >= plan.horizonDays) {
    mount(root, [h('div.banner.good', {}, [
      h('div.icon', {}, '🎉'),
      h('div.body', {}, [h('h3', {}, 'Sprint complete'), h('p', {}, 'You reached the end of the horizon. Start a new plan in Plan, or extend the horizon in Setup.')]),
    ])]);
    return;
  }

  const tasks = tasksForDay(iso, sched, plan);
  const rec = store.dayRecord(iso);
  const done = new Set(rec.taskIds);
  const doneCount = tasks.filter(t => done.has(t.id)).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const dayPlan = store.dayRecord(iso).dayPlan || null;
  const blocks = layoutDay(plan, config, sched, iso, dayPlan ? dayPlanToOverride(dayPlan) : null);

  mount(root, [homeView(plan, config, sched, iso, dayIdx, tasks, done, doneCount, allDone, blocks, dayPlan)]);
}

// Tight, minimal, action-first home: where you are · one primary action · tasks.
function homeView(plan, config, sched, iso, dayIdx, tasks, done, doneCount, allDone, blocks, dayPlan) {
  ensurePomo(config);
  const total = tasks.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const streak = computeStreak(plan, sched);
  const day = sched.days.find(d => d.iso === iso);
  const topic = day && day.topics.length ? day.topics[0].title : 'Lighter day';
  const firstUndone = tasks.findIndex(t => !done.has(t.id));

  if (heroTaskIdx == null || heroTaskIdx < 0 || heroTaskIdx >= total) heroTaskIdx = Math.max(0, firstUndone);

  return h('div.home', {}, [
    // ── Plan-my-day prompt (until today is planned) ──
    !dayPlan ? h('div.plan-prompt', {}, [
      h('div', {}, [
        h('div.pp-title', {}, 'Plan today'),
        h('div.pp-sub', {}, 'Answer a few quick questions and I’ll build your schedule around your day.'),
      ]),
      h('button.btn.primary.sm', { onclick: () => openDayPlanner(iso) }, 'Plan my day'),
    ]) : null,
    // ── 1 · Study ──
    h('section.home-sec', {}, [
      h('div.sec-head', {}, [
        h('span.sec-title', {}, 'Study'),
        h('span.sec-note', {}, `Day ${dayIdx + 1} · ${topic}${streak > 0 ? ` · ${streak}-day streak` : ''}`),
      ]),
      h('div.home-hero', {}, [
        total ? taskDial(iso, tasks, done, doneCount) : h('p.home-empty', {}, 'Nothing scheduled today — rest up.'),
        total ? dotsRow(iso, tasks, done) : null,
        h('button.btn.primary.focus-start', { onclick: () => { unlockAudio(); openFocusMode(config); } }, 'Start my session →'),
      ]),
    ]),
    // ── 2 · Job search ──
    jobSection(config),
    // ── 3 · Schedule ──
    h('section.home-sec', {}, [
      h('div.sec-head', {}, [
        h('span.sec-title', {}, 'Schedule'),
        h('button.linklike', { onclick: () => openDayPlanner(iso) }, dayPlan ? 'Edit day' : 'Plan day'),
      ]),
      (dayPlan && blocks && blocks.length)
        ? h('div', {}, [
            h('div.timeline', {}, blocks.map(b => h('div.tl-row', {}, [
              h('div.tl-time', {}, b.start),
              h('div', { class: 'tl-block ' + b.kind }, [
                h('div.t', {}, b.title),
                b.detail ? h('div.d', {}, b.detail) : null,
                (b.kind === 'study' && b.topicId)
                  ? h('ul.tl-tasks', {}, tasks.filter(t => t.topic.id === b.topicId).map(t =>
                      h('li', { class: done.has(t.id) ? 'done' : '' }, t.title)))
                  : null,
                h('div.d.faint', {}, `${b.start}–${b.end}`),
              ]),
            ]))),
            h('button.btn.sm.ghost.mt', { onclick: () => exportDay(iso, blocks) }, '📅 Export to calendar'),
          ])
        : h('p.sub', { style: 'margin:0' }, 'Plan your day and I’ll lay out your study blocks around it.'),
    ]),
  ]);
}

// ---- daily planning questionnaire ----
function defaultDayPlan(config) {
  return {
    wake: config.availability.wakeTime || '08:00',
    getReadyMins: config.availability.getReadyMins || 60,
    gym: { go: false, time: '07:00', mins: 60 },
    walk: { go: false, time: '18:00', mins: 30 },
    others: [],
    jobMins: config.jobSearch.dailyMinutes || 120,
    jobSplit: false,
    hardStop: '21:00',
  };
}

// Convert a day plan into the scheduler's activity override.
function dayPlanToOverride(dp) {
  const acts = [];
  if (dp.getReadyMins) acts.push({ label: 'Get ready', minutes: dp.getReadyMins, time: dp.wake });
  const add = (label, a, defMins) => {
    if (!a || !a.go) return;
    const o = { label, minutes: a.mins || defMins };
    if (a.time) o.time = a.time;
    acts.push(o);
  };
  add('Gym', dp.gym, 60);
  add('Walk', dp.walk, 30);
  (dp.others || []).forEach(o => {
    if (!o.label && !o.time) return;
    const item = { label: o.label || 'Plan', minutes: o.mins || 60 };
    if (o.time) item.time = o.time;
    acts.push(item);
  });
  return { wakeTime: dp.wake, activities: acts, jobMinutes: dp.jobMins, jobSplit: !!dp.jobSplit };
}

function openDayPlanner(iso) {
  const config = store.config();
  const rec = store.dayRecord(iso);
  const dp = rec.dayPlan ? JSON.parse(JSON.stringify(rec.dayPlan)) : defaultDayPlan(config);
  if (!dp.gym) dp.gym = { go: false, time: '07:00', mins: 60 };
  if (!dp.walk) dp.walk = { go: false, time: '18:00', mins: 30 };
  if (!dp.others) dp.others = [];

  const backdrop = h('div.modal-backdrop', { onclick: (e) => { if (e.target === backdrop) close(); } });
  function close() { backdrop.remove(); }

  const timeInput = (val, on) => h('input', { type: 'time', value: val || '', onchange: (e) => on(e.target.value) });
  const numInput = (val, on) => h('input', { type: 'number', min: 0, step: 5, value: val, class: 'dp-num', onchange: (e) => on(Math.max(0, +e.target.value)) });

  const body = h('div', {});
  function draw() {
    mount(body, [
      h('label.field', {}, [h('span', {}, 'When did you wake up?'), timeInput(dp.wake, (v) => { dp.wake = v; })]),
      h('label.field', {}, [h('span', {}, 'Time to get ready (min)'), numInput(dp.getReadyMins, (v) => { dp.getReadyMins = v; })]),

      h('div.dp-label', {}, 'Activities today'),
      h('div.dp-row', {}, [
        h('label.dp-check', {}, [h('input', { type: 'checkbox', checked: dp.gym.go, onchange: (e) => { dp.gym.go = e.target.checked; } }), h('span', {}, 'Gym')]),
        timeInput(dp.gym.time, (v) => { dp.gym.time = v; }),
        numInput(dp.gym.mins, (v) => { dp.gym.mins = v; }),
      ]),
      h('div.dp-row', {}, [
        h('label.dp-check', {}, [h('input', { type: 'checkbox', checked: dp.walk.go, onchange: (e) => { dp.walk.go = e.target.checked; } }), h('span', {}, 'Walk')]),
        timeInput(dp.walk.time, (v) => { dp.walk.time = v; }),
        numInput(dp.walk.mins, (v) => { dp.walk.mins = v; }),
      ]),

      h('div.dp-label', {}, 'Other plans'),
      ...dp.others.map((o, i) => h('div.dp-row', {}, [
        h('input', { type: 'text', placeholder: 'What?', value: o.label, class: 'dp-what', onchange: (e) => { o.label = e.target.value; } }),
        timeInput(o.time, (v) => { o.time = v; }),
        numInput(o.mins, (v) => { o.mins = v; }),
        h('button.jobbtn', { 'aria-label': 'Remove', onclick: () => { dp.others.splice(i, 1); draw(); } }, '×'),
      ])),
      h('button.btn.ghost.sm', { onclick: () => { dp.others.push({ label: '', time: '', mins: 60 }); draw(); } }, '+ Add a plan'),

      h('div.dp-label', {}, 'Job applications'),
      h('div.dp-row', {}, [
        h('span', { style: 'flex:1' }, 'Time today (min)'),
        numInput(dp.jobMins, (v) => { dp.jobMins = v; }),
      ]),
      h('div.dp-seg', {}, [
        h('button', { class: 'dp-segbtn' + (!dp.jobSplit ? ' active' : ''), onclick: () => { dp.jobSplit = false; draw(); } }, 'One block'),
        h('button', { class: 'dp-segbtn' + (dp.jobSplit ? ' active' : ''), onclick: () => { dp.jobSplit = true; draw(); } }, 'Split in two'),
      ]),

      h('label.field', { style: 'margin-top:16px' }, [h('span', {}, 'Wrap up by (optional)'), timeInput(dp.hardStop, (v) => { dp.hardStop = v; })]),
    ]);
  }
  draw();

  const box = h('div.modal', { class: 'dp-modal' }, [
    h('h2', {}, 'Plan today'),
    h('p.sub', {}, 'Tell me your day — I’ll build your study blocks around it.'),
    body,
    h('div.modal-actions', {}, [
      h('button.btn.ghost', { onclick: close }, 'Cancel'),
      h('button.btn.primary', {
        onclick: () => {
          store.dayRecord(iso).dayPlan = dp;
          store.save();
          toast('Schedule built around your day. ✓');
          close();
        },
      }, 'Plan my day'),
    ]),
  ]);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
}

// Job-search section: log applications + coffee chats against weekly targets.
function jobSection(config) {
  const js = config.jobSearch;
  const week = store.weekStartISO();
  const log = store.progress().jobLog[week] || { applications: 0, coffeeChats: 0 };
  return h('section.home-sec', {}, [
    h('div.sec-head', {}, [
      h('span.sec-title', {}, 'Job search'),
      h('span.sec-note', {}, 'This week'),
    ]),
    jobCounter('Applications', log.applications, js.weeklyApplications, 'applications'),
    jobCounter('Coffee chats', log.coffeeChats, js.weeklyCoffeeChats, 'coffeeChats'),
  ]);
}

function jobCounter(label, val, target, field) {
  const pct = target ? Math.min(100, Math.round((val / target) * 100)) : 0;
  return h('div.jobrow', {}, [
    h('div.jobrow-top', {}, [
      h('span.jobrow-label', {}, label),
      h('span.jobrow-count', {}, `${val} / ${target}`),
      h('div.stepper', {}, [
        h('button.jobbtn', { 'aria-label': 'Decrease', onclick: () => logJob(field, -1) }, '−'),
        h('button.jobbtn', { 'aria-label': 'Increase', onclick: () => logJob(field, 1) }, '+'),
      ]),
    ]),
    h('div.progress', {}, [h('i', { class: pct >= 100 ? 'good' : '', style: `width:${pct}%` })]),
  ]);
}

function rerenderHome() { const root = document.getElementById('view'); if (root) render(root); }

// A short "what kind of task" label — the couple of words describing it.
function taskKind(title) {
  const w = (title || '').trim().toLowerCase();
  if (w.startsWith('set up') || w.startsWith('setup')) return 'SET UP';
  if (w.startsWith('do ') || w.startsWith('read')) return 'LEARN';
  if (w.startsWith('write') || w.startsWith('build')) return 'BUILD';
  if (w.startsWith('practice') || w.startsWith('solve') || w.startsWith('diagram') || w.startsWith('join') || w.startsWith('dedup')) return 'DRILL';
  if (w.startsWith('note') || w.startsWith('score') || w.startsWith('re-solve') || w.startsWith('review')) return 'REVIEW';
  return 'PRACTICE';
}

// Centerpiece: one task in a ring you can flip through and tap to complete.
function taskDial(iso, tasks, done, doneCount) {
  const total = tasks.length;
  const t = tasks[heroTaskIdx];
  const isDone = t && done.has(t.id);
  const pct = total ? (doneCount / total) * 100 : 0;
  const R = 76, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
  const ring = h('div', {
    class: 'task-dial' + (isDone ? ' done' : ''),
    html:
      '<svg viewBox="0 0 180 180" aria-hidden="true">' +
      '<circle class="td-track" cx="90" cy="90" r="' + R + '"/>' +
      '<circle class="td-prog" cx="90" cy="90" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg>',
  });
  ring.appendChild(h('div.td-center', { onclick: () => t && toggleTask(iso, t.id, !isDone) }, [
    h('div.td-kind', {}, taskKind(t.title)),
    h('div.td-title', {}, t.title),
    h('div.td-action', {}, isDone ? '✓ done' : 'tap to complete'),
  ]));
  return h('div.td-wrap', {}, [
    h('button.td-nav', { 'aria-label': 'Previous task', onclick: () => { heroTaskIdx = (heroTaskIdx - 1 + total) % total; rerenderHome(); } }, '‹'),
    ring,
    h('button.td-nav', { 'aria-label': 'Next task', onclick: () => { heroTaskIdx = (heroTaskIdx + 1) % total; rerenderHome(); } }, '›'),
  ]);
}

function dotsRow(iso, tasks, done) {
  return h('div.td-dots', {}, tasks.map((t, i) => h('button', {
    class: 'td-dot' + (done.has(t.id) ? ' done' : '') + (i === heroTaskIdx ? ' active' : ''),
    'aria-label': 'Task ' + (i + 1),
    onclick: () => { heroTaskIdx = i; rerenderHome(); },
  })));
}

function taskRow(iso, t, isDone, isNext) {
  const links = isNext ? (t.topic.resourceRefs || []).map(r => RESOURCES[r]).filter(Boolean) : [];
  return h('label', { class: 'trow' + (isDone ? ' done' : '') + (isNext ? ' next' : '') }, [
    h('input', { type: 'checkbox', checked: isDone, onchange: (e) => toggleTask(iso, t.id, e.target.checked) }),
    h('div.trow-body', {}, [
      h('span.trow-title', {}, t.title),
      links.length ? h('div.trow-links', {}, links.map(l => h('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.label))) : null,
    ]),
  ]);
}

// Warm, action-oriented header: the day's focus as a headline, a slim progress
// bar, and streak as a subtle accent. Replaces the clinical stat tiles + banner.
function headerHero(plan, config, sched, iso, dayIdx, tasks, doneCount, allDone) {
  const streak = computeStreak(plan, sched);
  const total = tasks.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const remaining = total - doneCount;

  const day = sched.days.find(d => d.iso === iso);
  const topicsToday = day ? day.topics : [];
  const focusName = topicsToday.length ? topicsToday[0].title : 'Lighter day — rest or catch up';

  // remaining focused hours + how much day is left
  const doneIds = new Set(store.dayRecord(iso).taskIds);
  let hoursLeft = 0;
  for (const t of topicsToday) {
    const items = t.checklist || [];
    const remainItems = items.filter((_, i) => !doneIds.has(`${t.id}:${i}`)).length;
    if (items.length) hoursLeft += t.estHours * (remainItems / items.length);
  }
  const bufferDays = plan.horizonDays - dayIdx - 1;
  const now = new Date();
  const hoursToMidnight = (24 * 60 - (now.getHours() * 60 + now.getMinutes())) / 60;

  // one warm line — nudge only when genuinely behind
  let sub, subClass = '';
  if (allDone) { sub = 'Everything for today is done — beautifully done. 🎉'; subClass = 'good'; }
  else if (bufferDays <= 0 && remaining > 0) { sub = `${remaining} left today, and no buffer days remain — let’s keep today on track.`; subClass = 'risk'; }
  else if (hoursLeft > hoursToMidnight && remaining > 0) { sub = `${remaining} task${remaining === 1 ? '' : 's'} left (~${fmtHours(hoursLeft)}) and the day’s getting short — best to start now.`; subClass = 'risk'; }
  else if (remaining > 0) { sub = `${remaining} task${remaining === 1 ? '' : 's'} to clear · about ${fmtHours(hoursLeft)} of focused work.`; }
  else { sub = 'Nothing scheduled today — enjoy the breather.'; }

  return h('div.home-hero', {}, [
    h('div.hero-eyebrow', {}, `${niceDate(iso).toUpperCase()} · DAY ${dayIdx + 1} OF ${plan.horizonDays}`),
    h('h1.hero-title', {}, focusName),
    h('p', { class: 'hero-sub ' + subClass }, sub),
    h('div.hero-progress', {}, [
      h('div.progress', {}, [h('i', { class: pct === 100 ? 'good' : '', style: `width:${pct}%` })]),
      h('div.hero-meta', {}, [
        h('span', {}, `${doneCount}/${total || 0} done`),
        h('span.hero-dot', {}, '·'),
        h('span', { class: streak > 0 ? 'hero-streak' : '' }, `🔥 ${streak}`),
      ]),
    ]),
  ]);
}

function checklistCard(iso, tasks, done) {
  if (!tasks.length) {
    return h('div.card', {}, [h('h2', {}, 'Today’s tasks'), h('p.sub', {}, 'No study tasks scheduled today. Enjoy the breather — but keep your job-search block.')]);
  }
  const rows = tasks.map(t => {
    const isDone = done.has(t.id);
    const links = (t.topic.resourceRefs || []).map(ref => RESOURCES[ref]).filter(Boolean);
    return h('label', { class: 'task' + (isDone ? ' done' : '') }, [
      h('input', {
        type: 'checkbox', checked: isDone,
        onchange: (e) => toggleTask(iso, t.id, e.target.checked),
      }),
      h('div.task-main', {}, [
        h('div.task-title', {}, t.title),
        h('div.task-meta', {}, [
          h('span', { class: 'pill p' + t.priority }, priorityLabel(t.priority)),
          t.load === 'high' ? h('span.pill.focus', {}, 'deep focus') : null,
          h('span', {}, t.topic.title),
        ]),
        links.length ? h('div.task-links', {}, links.map(l => h('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.label))) : null,
      ]),
    ]);
  });
  return h('div.card', {}, [
    h('h2', {}, 'Today’s tasks'),
    h('p.sub', {}, 'Check each off as you finish. Completing all of them protects your streak.'),
    ...rows,
  ]);
}

function scheduleCard(iso, blocks) {
  const rows = blocks.map(b => h('div.tl-row', {}, [
    h('div.tl-time', {}, b.start),
    h('div', { class: 'tl-block ' + b.kind }, [
      h('div.t', {}, b.title),
      b.detail ? h('div.d', {}, b.detail) : null,
      h('div.d.faint', {}, `${b.start}–${b.end}`),
    ]),
  ]));
  return h('div.card', {}, [
    h('details', {}, [
      h('summary.card-summary', {}, 'Today’s schedule'),
      h('p.sub', { style: 'margin-top:10px' }, 'Hardest topics sit in your peak-focus window. Export to get reminders on your phone.'),
      h('button.btn.sm', { onclick: () => exportDay(iso, blocks) }, '📅 Export to calendar'),
      h('div.timeline', { style: 'margin-top:12px' }, rows),
    ]),
  ]);
}

function focusCard(config) {
  ensurePomo(config);
  const spaces = (config.studySpaces || []).filter(s => s.active);
  const space = spaces.find(s => s.id === selectedSpaceId) || spaces[0] || null;
  selectedSpaceId = space ? space.id : null;

  const mins = store.dayRecord(store.todayISO()).studyMinutes || 0;
  const statLine = mins > 0
    ? `${mins} min focused today — nice work.`
    : 'A distraction-free timer. The screen clears until you tap End.';

  const startBtn = h('button.btn.primary.focus-start', {
    onclick: () => { unlockAudio(); openFocusMode(config); },
  }, '▶ Start focus');

  // Optional pre-flight ritual — nice at a desk, ignorable on the go. Never blocks start.
  let setup = null;
  if (space) {
    const spaceButtons = spaces.length > 1 ? h('div.spaces', {}, spaces.map(s =>
      h('button', {
        class: 'space-btn' + (s.id === selectedSpaceId ? ' active' : ''),
        onclick: () => { selectedSpaceId = s.id; rerenderFocus(config); },
      }, s.label))) : null;
    const boxes = space.checklist.map((item) =>
      h('label.checkline', {}, [h('input', { type: 'checkbox' }), h('span', {}, item)]));
    setup = h('details', {}, [
      h('summary', {}, 'Optional: study-space setup'),
      h('p.hint', { style: 'margin:8px 0' }, 'A quick ritual for deep focus — use it or skip it.'),
      spaceButtons,
      h('div', { style: 'margin-top:8px' }, boxes),
    ]);
  }

  return h('div.card#focusCard', {}, [
    h('h2', {}, 'Focus'),
    h('p.sub', {}, statLine),
    startBtn,
    setup,
  ]);
}

function rerenderFocus(config) {
  const old = document.getElementById('focusCard');
  if (old) old.replaceWith(focusCard(config));
}

// ---- full-screen focus mode ----
function currentTaskInfo(iso, sched, plan) {
  const tasks = tasksForDay(iso, sched, plan);
  const done = new Set(store.dayRecord(iso).taskIds);
  const next = tasks.find(t => !done.has(t.id));
  if (next) return { task: next.title, topic: next.topic.title };
  if (tasks.length) return { task: 'All of today’s tasks are done', topic: 'Bonus focus time' };
  return { task: 'Deep work', topic: 'Focus session' };
}

function openFocusMode(config) {
  const plan = store.plan();
  const sched = buildSchedule(plan, config);
  const iso = store.todayISO();
  const info = currentTaskInfo(iso, sched, plan);
  focusSeconds = 0;
  lastBase = 'idle';

  // Circular progress dial that drains as the block counts down.
  const R = 118, C = 2 * Math.PI * R;
  const dial = h('div.fo-dial', {
    html:
      '<svg class="fo-ring" viewBox="0 0 260 260" aria-hidden="true">' +
      '<circle class="fo-ring-track" cx="130" cy="130" r="' + R + '"/>' +
      '<circle class="fo-ring-prog" cx="130" cy="130" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="0"/>' +
      '</svg>',
  });
  const timeEl = h('div.fo-time', {}, Pomodoro.fmt(pomo.cfg.work * 60));
  dial.appendChild(timeEl);
  const progCircle = dial.querySelector('.fo-ring-prog');
  let phaseTotal = pomo.cfg.work * 60;

  const phaseEl = h('div.fo-phase', {}, 'Focus');
  const taskBox = h('div.fo-task', {}, [
    h('div.fo-task-label', {}, 'NOW'),
    h('div.fo-task-title', {}, info.task),
    h('div.fo-task-topic', {}, info.topic),
  ]);

  const pauseBtn = h('button.fo-btn', {
    onclick: () => {
      if (pomo.running) { pomo.pause(); pauseBtn.textContent = 'Resume'; dial.classList.add('paused'); }
      else { pomo.resume(); pauseBtn.textContent = 'Pause'; dial.classList.remove('paused'); }
    },
  }, 'Pause');
  const skipBtn = h('button.fo-btn', { hidden: true, onclick: () => { lastBase = 'idle'; pomo.start('work'); } }, 'Skip break →');
  const endBtn = h('button.fo-end', { onclick: () => endFocusMode(iso) }, 'End session');
  const controlsEl = h('div.fo-controls', {}, [pauseBtn, skipBtn]);
  const normalControls = () => mount(controlsEl, [pauseBtn, skipBtn]);
  const askControls = () => mount(controlsEl, [
    h('button.fo-btn.primary', { onclick: () => { const isLong = pomo.completed % pomo.cfg.longEvery === 0; pomo.start(isLong ? 'long' : 'short'); } }, `Take a ${pomo.cfg.shortBreak}-min break`),
    h('button.fo-btn', { onclick: () => { pomo.start('work'); } }, 'Keep going'),
  ]);

  const overlay = h('div.focus-overlay.focus', {}, [
    h('div.fo-top', {}, [phaseEl, endBtn]),
    h('div.fo-center', {}, [dial, taskBox]),
    controlsEl,
  ]);

  pomo.onTick = (sec) => {
    timeEl.textContent = Pomodoro.fmt(sec);
    if (pomo.phase === 'work') focusSeconds++;
    if (progCircle && phaseTotal) progCircle.style.strokeDashoffset = (C * (1 - sec / phaseTotal)).toFixed(1);
  };
  pomo.onPhase = (ph) => {
    const base = String(ph).split(':')[0];
    const isBreak = base === 'short' || base === 'long';
    phaseEl.textContent = isBreak ? 'Break — rest your eyes' : (base === 'work' ? 'Focus' : phaseLabel(ph));
    overlay.className = 'focus-overlay ' + (isBreak ? 'break' : 'focus');
    taskBox.style.visibility = isBreak ? 'hidden' : 'visible';
    skipBtn.hidden = !isBreak;
    phaseTotal = base === 'short' ? pomo.cfg.shortBreak * 60 : base === 'long' ? pomo.cfg.longBreak * 60 : pomo.cfg.work * 60;
    if (progCircle) progCircle.style.strokeDashoffset = '0';
    if (base === 'work' || base === 'short' || base === 'long') normalControls();
    if (base !== lastBase) { playBeep(); lastBase = base; }
  };

  // Break check-in: in "ask" mode, a finished work block asks instead of auto-breaking.
  pomo.askOnComplete = config.pomodoro.breakMode === 'ask';
  pomo.onAsk = () => {
    phaseEl.textContent = `${pomo.cfg.work} min done — need a break?`;
    taskBox.style.visibility = 'hidden';
    timeEl.textContent = Pomodoro.fmt(pomo.cfg.shortBreak * 60);
    if (progCircle) progCircle.style.strokeDashoffset = '0';
    askControls();
    playBeep();
  };

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  focusOverlay = overlay;
  try { (overlay.requestFullscreen || overlay.webkitRequestFullscreen || (() => {})).call(overlay); } catch (e) { /* iOS: already chromeless */ }

  pomo.start('work');
}

function endFocusMode(iso) {
  pomo.stop();
  try { (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document); } catch (e) { /* ignore */ }
  const mins = Math.max(0, Math.round(focusSeconds / 60));
  const blocks = pomo.completed;
  const rec = store.dayRecord(iso);
  rec.studyMinutes = (rec.studyMinutes || 0) + mins;
  rec.blocksCompleted = (rec.blocksCompleted || 0) + blocks;
  pomo.completed = 0;
  showFocusSummary(mins, blocks);
  store.save();
}

function showFocusSummary(mins, blocks) {
  if (!focusOverlay) return;
  focusOverlay.className = 'focus-overlay done';
  mount(focusOverlay, [
    h('div.fo-summary', {}, [
      h('div.fo-sum-emoji', {}, '✦'),
      h('div.fo-sum-title', {}, mins > 0 ? `${mins} min focused` : 'Session ended'),
      h('div.fo-sum-stat', {}, blocks ? `${blocks} block${blocks > 1 ? 's' : ''}` : `${mins} min`),
      h('div.fo-sum-sub', {}, 'A vote for the analyst you’re becoming.'),
      h('button.fo-btn.primary', { onclick: closeFocusMode }, 'Back to dashboard'),
    ]),
  ]);
  if (mins > 0 || blocks > 0) burst({ origin: { x: 0.5, y: 0.42 } });
}

function closeFocusMode() {
  if (focusOverlay) { focusOverlay.remove(); focusOverlay = null; }
  document.body.style.overflow = '';
  focusSeconds = 0;
  lastBase = 'idle';
  const root = document.getElementById('view');
  if (root) render(root);
}

// Audio chime — reliable on phones where web notifications don't fire.
// Unlocked on the first Start tap (a user gesture), then usable from timers.
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* no audio available */ }
}
function playBeep() {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.start(t); o.stop(t + 0.42);
  } catch (e) { /* ignore */ }
}

function jobMiniCard(config) {
  const js = config.jobSearch;
  const week = store.weekStartISO();
  const log = store.progress().jobLog[week] || { applications: 0, coffeeChats: 0 };
  const appPct = Math.min(100, Math.round((log.applications / js.weeklyApplications) * 100));
  const chatPct = Math.min(100, Math.round((log.coffeeChats / js.weeklyCoffeeChats) * 100));
  const behind = log.applications < js.weeklyApplications * 0.5 || log.coffeeChats < js.weeklyCoffeeChats * 0.5;
  return h('div.card', {}, [
    h('h2', {}, 'Job search this week'),
    behind ? h('p.sub', { style: 'color:var(--warn)' }, 'You’re behind pace — block time today. This matters as much as SQL.') : h('p.sub', {}, 'On pace. Keep the momentum.'),
    progressLine('Applications', log.applications, js.weeklyApplications, appPct),
    progressLine('Coffee chats', log.coffeeChats, js.weeklyCoffeeChats, chatPct),
    h('div.btn-row.mt', {}, [
      h('button.btn.sm', { onclick: () => { logJob('applications', 1); } }, '+1 application'),
      h('button.btn.sm', { onclick: () => { logJob('coffeeChats', 1); } }, '+1 coffee chat'),
      h('a.btn.sm.ghost', { href: '#/jobs' }, 'Details'),
    ]),
  ]);
}

function progressLine(label, val, target, pct) {
  return h('div.mt', {}, [
    h('div', { style: 'display:flex;justify-content:space-between;font-size:13px' }, [
      h('span.muted', {}, label),
      h('span', {}, `${val} / ${target}`),
    ]),
    h('div.progress', {}, [h('i', { class: pct >= 100 ? 'good' : pct >= 50 ? '' : 'warn', style: `width:${pct}%` })]),
  ]);
}

// ---- actions ----
function toggleTask(iso, taskId, on) {
  const rec = store.dayRecord(iso);
  const set = new Set(rec.taskIds);
  on ? set.add(taskId) : set.delete(taskId);
  rec.taskIds = [...set];
  store.save();
  // Celebrate only the real milestone: clearing everything scheduled today.
  if (on) {
    const plan = store.plan(), config = store.config();
    const dayTasks = tasksForDay(iso, buildSchedule(plan, config), plan);
    if (dayTasks.length && dayTasks.every(t => set.has(t.id))) {
      burst({ origin: { x: 0.5, y: 0.4 } });
      toast('Day cleared — a vote for the analyst you’re becoming. ✓');
    }
  }
}
function logJob(field, n) {
  const week = store.weekStartISO();
  const log = store.progress().jobLog;
  if (!log[week]) log[week] = { applications: 0, coffeeChats: 0 };
  log[week][field] = Math.max(0, (log[week][field] || 0) + n);
  store.save();
  toast(field === 'applications' ? 'Application logged 💼' : 'Coffee chat logged ☕');
}
function exportDay(iso, blocks) {
  const ics = buildICS(iso, blocks, { calName: `prep-coach ${iso}` });
  downloadICS(`prep-coach-${iso}.ics`, ics);
  toast('Calendar file downloaded — import it to get phone reminders.');
}

// ---- helpers ----
function ensurePomo(config) {
  if (!pomo) pomo = new Pomodoro(config.pomodoro);
  else pomo.cfg = config.pomodoro;
}
function priorityLabel(p) { return p === 1 ? 'Must-do' : p === 2 ? 'Important' : 'Optional'; }
function phaseLabel(ph) {
  if (ph.startsWith('work')) return ph.includes('paused') ? 'Focus (paused)' : 'Focus';
  if (ph.startsWith('short')) return 'Short break';
  if (ph.startsWith('long')) return 'Long break';
  return 'Ready';
}
function pomoClass(ph) { return ph.startsWith('work') ? 'focus' : (ph.startsWith('short') || ph.startsWith('long')) ? 'break' : ''; }

function countAllTasks(plan, sched) {
  let n = 0;
  for (const d of sched.days) for (const t of d.topics) n += (t.checklist || []).length;
  return n;
}
function countAllDone(plan, sched) {
  let n = 0;
  const days = store.progress().days;
  for (const d of sched.days) {
    const done = new Set(days[d.iso] ? days[d.iso].taskIds : []);
    for (const t of d.topics) (t.checklist || []).forEach((_, i) => { if (done.has(`${t.id}:${i}`)) n++; });
  }
  return n;
}
