// today.js — the accountability home screen.
import { h, mount, toast, fmtHours, niceDate } from '../ui.js';
import * as store from '../store.js';
import { buildSchedule, layoutDay, currentDayIndex } from '../scheduler.js';
import { Pomodoro } from '../pomodoro.js';
import { buildICS, downloadICS } from '../ics.js';
import { requestPermission, permission } from '../notify.js';
import { RESOURCES } from '../data/resources.js';

let pomo = null;              // persists across re-renders so a running timer survives
let selectedSpaceId = null;
let spaceConfirmed = false;

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

export function computeStreak(plan, sched) {
  let streak = 0;
  let iso = store.todayISO();
  if (!dayComplete(iso, sched, plan)) iso = store.addDays(iso, -1); // today not done yet → count up to yesterday
  while (dayComplete(iso, sched, plan)) { streak++; iso = store.addDays(iso, -1); }
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
  const blocks = layoutDay(plan, config, sched, iso);

  mount(root, [
    riskBanner(plan, config, sched, iso, dayIdx, tasks, doneCount, allDone),
    statsRow(plan, sched, dayIdx, doneCount, tasks.length),
    h('div.grid.grid-2', {}, [
      h('div', {}, [
        checklistCard(iso, tasks, done),
        scheduleCard(iso, blocks),
      ]),
      h('div', {}, [
        focusCard(config),
        jobMiniCard(config),
      ]),
    ]),
  ]);
}

function riskBanner(plan, config, sched, iso, dayIdx, tasks, doneCount, allDone) {
  const remaining = tasks.length - doneCount;
  // hours of unfinished work today
  const day = sched.days.find(d => d.iso === iso);
  const topicsToday = day ? day.topics : [];
  const doneIds = new Set(store.dayRecord(iso).taskIds);
  let hoursLeft = 0;
  for (const t of topicsToday) {
    const items = t.checklist || [];
    const remainItems = items.filter((_, i) => !doneIds.has(`${t.id}:${i}`)).length;
    if (items.length) hoursLeft += t.estHours * (remainItems / items.length);
  }
  const bufferDays = plan.horizonDays - dayIdx - 1;   // days after today inside horizon
  const now = new Date();
  const hoursToMidnight = (24 * 60 - (now.getHours() * 60 + now.getMinutes())) / 60;

  if (allDone) {
    return h('div.banner.good', {}, [
      h('div.icon', {}, '✅'),
      h('div.body', {}, [
        h('h3', {}, `Day ${dayIdx + 1} done. Streak protected.`),
        h('p', {}, `You cleared everything scheduled for today. ${bufferDays} day${bufferDays === 1 ? '' : 's'} of runway left in the sprint.`),
      ]),
    ]);
  }

  // cascade: if today's remaining work slips, does the sprint still finish in the horizon?
  const slips = bufferDays <= 0;
  const finishDay = slips ? plan.horizonDays + 1 : dayIdx + 2;
  const level = slips ? 'bad' : (hoursLeft > hoursToMidnight ? 'warn' : 'info');
  const icon = { bad: '⛔', warn: '⚠️', info: '⏳' }[level];
  const msg = slips
    ? `You have no buffer days left. Skip today and the Day-${plan.horizonDays} mock slips past your ${plan.horizonDays}-day deadline to day ${finishDay}. Do not miss today.`
    : `${remaining} task${remaining === 1 ? '' : 's'} (~${fmtHours(hoursLeft)}) left today, ~${fmtHours(hoursToMidnight)} of day remaining. Miss today and this work pushes to tomorrow — you’d burn 1 of your ${bufferDays} buffer day${bufferDays === 1 ? '' : 's'}.`;

  return h('div', { class: 'banner ' + level }, [
    h('div.icon', {}, icon),
    h('div.body', {}, [
      h('h3', {}, `Day ${dayIdx + 1} of ${plan.horizonDays} — ${doneCount}/${tasks.length} done`),
      h('p', {}, msg),
    ]),
  ]);
}

function statsRow(plan, sched, dayIdx, doneCount, total) {
  const streak = computeStreak(plan, sched);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const overallDone = countAllDone(plan, sched);
  const overallTotal = countAllTasks(plan, sched);
  return h('div.statrow.mb', {}, [
    h('div.stat', {}, [h('div', { class: 'n ' + (streak > 0 ? 'good' : '') }, `🔥 ${streak}`), h('div.l', {}, 'Day streak')]),
    h('div.stat', {}, [h('div.n', {}, `${dayIdx + 1}/${plan.horizonDays}`), h('div.l', {}, 'Sprint day')]),
    h('div.stat', {}, [h('div', { class: 'n ' + (pct === 100 ? 'good' : pct > 0 ? 'warn' : 'bad') }, `${pct}%`), h('div.l', {}, 'Today complete')]),
    h('div.stat', {}, [h('div.n', {}, `${overallDone}/${overallTotal}`), h('div.l', {}, 'Tasks overall')]),
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
    h('div', { class: 'btn-row', style: 'justify-content:space-between;align-items:center' }, [
      h('h2', { style: 'margin:0' }, 'Today’s schedule'),
      h('button.btn.sm', { onclick: () => exportDay(iso, blocks) }, '📅 Export to calendar'),
    ]),
    h('p.sub', {}, 'Hardest topics are placed in your peak-focus window. Export to get reminders on your phone.'),
    h('div.timeline', {}, rows),
  ]);
}

function focusCard(config) {
  ensurePomo(config);
  const spaces = (config.studySpaces || []).filter(s => s.active);
  const space = spaces.find(s => s.id === selectedSpaceId) || null;

  const timeEl = h('div.pomo-time', {}, Pomodoro.fmt(pomo.remaining || pomo.cfg.work * 60));
  const phaseEl = h('div.pomo-phase', {}, phaseLabel(pomo.phase));
  const countEl = h('div.pomo-count', {}, `Completed focus blocks: ${pomo.completed}`);
  const wrap = h('div', { class: 'pomo ' + pomoClass(pomo.phase) }, [phaseEl, timeEl]);

  pomo.onTick = (sec) => { timeEl.textContent = Pomodoro.fmt(sec); };
  pomo.onPhase = (ph) => {
    phaseEl.textContent = phaseLabel(ph);
    wrap.className = 'pomo ' + pomoClass(ph);
    countEl.textContent = `Completed focus blocks: ${pomo.completed}`;
  };

  const spaceButtons = h('div.spaces', {}, spaces.map(s =>
    h('button', {
      class: 'space-btn' + (s.id === selectedSpaceId ? ' active' : ''),
      onclick: () => { selectedSpaceId = s.id; spaceConfirmed = false; rerenderFocus(config); },
    }, s.label)));

  let checklistBox = null;
  if (space) {
    const boxes = space.checklist.map((item, i) => {
      const cb = h('input', { type: 'checkbox', onchange: () => updateConfirm(space, checklistBox) });
      return h('label.checkline', {}, [cb, h('span', {}, item)]);
    });
    checklistBox = h('div', {}, boxes);
  }

  const startBtn = h('button', {
    class: 'btn primary', disabled: !space || !spaceConfirmed,
    onclick: () => { pomo.start('work'); pomo.onPhase(pomo.phase); toast('Focus block started — phone away.'); },
  }, '▶ Start focus block');
  const startWrap = h('div', {}, [startBtn]);
  focusStartRef = () => { startBtn.disabled = !space || !spaceConfirmed; };

  const controls = h('div.pomo-controls', {}, [
    startWrap,
    h('button.btn.ghost.sm', { onclick: () => { pomo.running ? pomo.pause() : pomo.resume(); pomo.onPhase(pomo.phase); } }, 'Pause / resume'),
    h('button.btn.ghost.sm', { onclick: () => { pomo.stop(); pomo.onPhase('idle'); pomo.onTick(pomo.cfg.work * 60); } }, 'Reset'),
  ]);

  const permBtn = permission() !== 'granted'
    ? h('button.btn.sm.mt', { onclick: async () => { const p = await requestPermission(); toast(p === 'granted' ? 'Notifications on.' : 'Notifications blocked — enable in browser settings.'); } }, '🔔 Enable notifications')
    : null;

  focusCardRef = () => rerenderFocus(config);

  return h('div.card#focusCard', {}, [
    h('h2', {}, 'Focus session'),
    h('p.sub', {}, 'Set up your space, then run a Pomodoro. You can’t start until the environment checklist is done — including phone away.'),
    wrap, controls, countEl,
    h('hr.sep'),
    h('h3', {}, 'Study space'),
    spaceButtons,
    space ? h('p.sub', {}, `Set up “${space.label}” before you start:`) : h('p.sub', {}, 'Pick where you’re studying.'),
    checklistBox,
    permBtn,
  ]);
}

let focusStartRef = null;
let focusCardRef = null;
function updateConfirm(space, box) {
  const all = [...box.querySelectorAll('input[type=checkbox]')].every(c => c.checked);
  spaceConfirmed = all;
  if (focusStartRef) focusStartRef();
  if (all) toast('Space ready. Start your focus block.');
}
function rerenderFocus(config) {
  const old = document.getElementById('focusCard');
  if (old) old.replaceWith(focusCard(config));
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
  // update lastCompletedDate bookkeeping
  store.save();
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
