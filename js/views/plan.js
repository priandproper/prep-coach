// plan.js — plan / curriculum editor + the fit-analysis banner with 3 fixes.
import { h, mount, toast, modal, fmtHours, niceDate } from '../ui.js';
import * as store from '../store.js';
import { buildSchedule, fitAnalysis } from '../scheduler.js';

export function render(root) {
  const plan = store.plan();
  const config = store.config();
  const fit = fitAnalysis(plan, config);
  const sched = buildSchedule(plan, config);

  mount(root, [
    h('div.page-head', {}, [
      h('h1', {}, 'Study plan'),
      h('p', {}, `${plan.goal} · ${plan.horizonDays}-day sprint starting ${niceDate(plan.startDate)}`),
    ]),
    fitBanner(plan, config, fit),
    planControls(plan),
    daysList(plan, config, sched),
    topicEditor(plan),
  ]);
}

function fitBanner(plan, config, fit) {
  if (fit.fits) {
    return h('div.banner.good', {}, [
      h('div.icon', {}, '✅'),
      h('div.body', {}, [
        h('h3', {}, 'The plan fits'),
        h('p', {}, `${fmtHours(fit.totalNeeded)} of work vs ${fmtHours(fit.totalCapacity)} of capacity across ${plan.horizonDays} days. Comfortable buffer of ${fmtHours(fit.totalCapacity - fit.totalNeeded)}.`),
      ]),
    ]);
  }
  const f = fit.fixes;
  const actions = [];
  if (f.moreHours) {
    actions.push(h('button', {
      class: 'btn sm ' + (f.moreHours.feasible ? 'primary' : ''),
      disabled: !f.moreHours.feasible,
      title: f.moreHours.feasible ? '' : `Exceeds your daily burnout cap of ${config.cognitiveLoad.dailyMaxStudyHours}h`,
      onclick: () => { config.availability.defaultHours = f.moreHours.newDaily; store.save(); toast(`Daily study raised to ${f.moreHours.newDaily}h.`); },
    }, `+${f.moreHours.addPerDay}h/day → ${f.moreHours.newDaily}h daily`));
  }
  if (f.moreDays) {
    actions.push(h('button', {
      class: 'btn sm ' + (f.moreDays.feasible ? 'primary' : ''),
      disabled: f.moreDays.addDays <= 0,
      onclick: () => { plan.horizonDays = f.moreDays.newHorizon; store.save(); toast(`Sprint extended to ${f.moreDays.newHorizon} days.`); },
    }, `+${f.moreDays.addDays} day${f.moreDays.addDays === 1 ? '' : 's'} → ${f.moreDays.newHorizon}-day sprint`));
  }
  if (f.trim && f.trim.topics.length) {
    const names = f.trim.topics.map(t => t.title).join(', ');
    actions.push(h('button.btn.sm', {
      onclick: () => modal({
        title: 'Trim lowest-priority topics?',
        body: `This removes: ${names} (recovers ${fmtHours(f.trim.recovered)}). You can re-add them later or reset the plan.`,
        confirmText: 'Trim them', danger: true,
        onConfirm: () => {
          const ids = new Set(f.trim.topics.map(t => t.id));
          plan.topics = plan.topics.filter(t => !ids.has(t.id));
          store.save(); toast('Trimmed lower-priority topics.');
        },
      }),
    }, `Trim ${f.trim.topics.length} low-priority topic${f.trim.topics.length === 1 ? '' : 's'}`));
  }

  return h('div.banner.bad', {}, [
    h('div.icon', {}, '⛔'),
    h('div.body', {}, [
      h('h3', {}, `Plan doesn’t fit — you’re ${fmtHours(fit.gap)} short`),
      h('p', {}, `${fmtHours(fit.totalNeeded)} of work needs to happen in ${plan.horizonDays} days, but you only have ${fmtHours(fit.totalCapacity)} of capacity (after activities + your ${config.cognitiveLoad.dailyMaxStudyHours}h/day cap). Pick a fix:`),
      h('div.actions', {}, actions),
    ]),
  ]);
}

function planControls(plan) {
  return h('div.card', {}, [
    h('div.inline', {}, [
      h('label.field', {}, [h('span', {}, 'Goal'),
        h('input', { type: 'text', value: plan.goal, onchange: e => { plan.goal = e.target.value; store.save(); } })]),
      h('label.field', {}, [h('span', {}, 'Start date'),
        h('input', { type: 'date', value: plan.startDate, onchange: e => { plan.startDate = e.target.value; store.save(); toast('Start date updated.'); } })]),
      h('label.field', {}, [h('span', {}, 'Horizon (days, max 14)'),
        h('input', { type: 'number', min: 1, max: 14, value: plan.horizonDays, onchange: e => { plan.horizonDays = clamp(+e.target.value, 1, 14); store.save(); } })]),
    ]),
    h('div.btn-row', {}, [
      h('button.btn.sm', { onclick: () => { plan.startDate = store.todayISO(); store.save(); toast('Day 1 is today. 🌱'); } }, '▶ Start today (Day 1 = today)'),
      h('button.btn.ghost.sm', { onclick: () => modal({ title: 'Reset to the 10-day SQL plan?', body: 'This replaces your current topics with the preloaded curriculum and sets the start date to today. Progress is kept.', confirmText: 'Reset plan', danger: true, onConfirm: () => { store.loadSamplePlan(); toast('Preloaded SQL plan restored.'); } }) }, '↺ Reset to preloaded SQL plan'),
    ]),
  ]);
}

function daysList(plan, config, sched) {
  const today = store.todayISO();
  const cards = sched.days.map((day, i) => {
    const isToday = day.iso === today;
    const isPast = day.iso < today;
    const load = day.topics.reduce((s, t) => s + t.estHours, 0);
    return h('div', { class: 'day-card' + (isToday ? ' today' : '') + (isPast ? ' past' : '') }, [
      h('div.day-head', {}, [
        h('div', {}, [
          h('span.dt', {}, `Day ${i + 1}`),
          h('span.dm', {}, `  ·  ${niceDate(day.iso)}${isToday ? '  · today' : ''}`),
        ]),
        h('span.dm', {}, `${fmtHours(load)} / ${fmtHours(day.capacity)} capacity`),
      ]),
      h('div.day-body', {}, day.topics.length
        ? day.topics.map(t => h('div', { style: 'padding:6px 0' }, [
            h('span', { class: 'pill p' + t.priority, style: 'margin-right:8px' }, priorityLabel(t.priority)),
            h('strong', {}, t.title),
            h('span.faint', {}, `  · ${fmtHours(t.estHours)}`),
            h('div.sub', { style: 'margin:4px 0 0' }, t.summary),
          ]))
        : [h('p.sub', { style: 'margin:0' }, 'No study topics — rest / overflow buffer day.')]),
    ]);
  });
  if (sched.unplaced.length) {
    cards.push(h('div.banner.warn', { style: 'margin-top:14px' }, [
      h('div.icon', {}, '⚠️'),
      h('div.body', {}, [
        h('h3', {}, `${sched.unplaced.length} topic(s) couldn’t be scheduled`),
        h('p', {}, `${sched.unplaced.map(t => t.title).join(', ')} — resolve the fit gap above.`),
      ]),
    ]));
  }
  return h('div', {}, [h('h3', { style: 'margin:22px 0 12px;color:var(--muted)' }, 'Day-by-day'), h('div.day-list', {}, cards)]);
}

function topicEditor(plan) {
  const rows = plan.topics.map(t => h('div.task', {}, [
    h('div.task-main', {}, [
      h('input', { type: 'text', value: t.title, onchange: e => { t.title = e.target.value; store.save(); } }),
      h('div.inline.mt', {}, [
        h('label.field', { style: 'margin:0' }, [h('span', {}, 'Est. hours'),
          h('input', { type: 'number', min: 0.5, step: 0.5, value: t.estHours, onchange: e => { t.estHours = Math.max(0.5, +e.target.value); store.save(); } })]),
        h('label.field', { style: 'margin:0' }, [h('span', {}, 'Priority'),
          selectEl([[1, 'Must-do'], [2, 'Important'], [3, 'Optional']], t.priority, v => { t.priority = +v; store.save(); })]),
        h('label.field', { style: 'margin:0' }, [h('span', {}, 'Cognitive load'),
          selectEl([['high', 'High (peak slot)'], ['medium', 'Medium'], ['low', 'Low']], t.load, v => { t.load = v; store.save(); })]),
      ]),
    ]),
    h('button.btn.ghost.sm', { onclick: () => { plan.topics = plan.topics.filter(x => x !== t); store.save(); toast('Topic removed.'); } }, '✕'),
  ]));
  return h('div.card', { style: 'margin-top:22px' }, [
    h('h2', {}, 'Edit topics'),
    h('p.sub', {}, 'Adjust effort, priority, and cognitive load. The scheduler re-flows instantly.'),
    ...rows,
    h('button.btn.sm.mt', { onclick: () => { plan.topics.push({ id: 'c' + Date.now(), title: 'New topic', estHours: 2, priority: 2, load: 'medium', resourceRefs: [], summary: '', checklist: ['Define what "done" looks like'] }); store.save(); } }, '+ Add topic'),
  ]);
}

function selectEl(options, value, onchange) {
  return h('select', { onchange: e => onchange(e.target.value) },
    options.map(([v, label]) => h('option', { value: v, ...(String(v) === String(value) ? { selected: '' } : {}) }, label)));
}
function priorityLabel(p) { return p === 1 ? 'Must-do' : p === 2 ? 'Important' : 'Optional'; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
