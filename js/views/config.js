// config.js — Setup: availability, activities, cognitive load, study spaces,
// pomodoro, and job-search targets. Everything the coach uses to schedule.
import { h, mount, toast } from '../ui.js';
import * as store from '../store.js';

export function render(root) {
  const c = store.config();
  mount(root, [
    h('div.page-head', {}, [h('h1', {}, 'Setup'), h('p', {}, 'Tune how the coach schedules you. Changes save instantly and re-flow your plan.')]),
    availabilityCard(c),
    cognitiveCard(c),
    activitiesCard(c),
    spacesCard(c),
    pomodoroCard(c),
    jobCard(c),
  ]);
}

function num(label, value, opts, onchange) {
  return h('label.field', { style: 'margin:0' }, [h('span', {}, label),
    h('input', { type: 'number', value, ...opts, onchange: e => onchange(+e.target.value) })]);
}
function time(label, value, onchange) {
  return h('label.field', { style: 'margin:0' }, [h('span', {}, label),
    h('input', { type: 'time', value, onchange: e => onchange(e.target.value) })]);
}

function availabilityCard(c) {
  return h('div.card', {}, [
    h('h2', {}, 'Daily availability'),
    h('p.sub', {}, 'How many focused study hours you can give on a normal day, and when your day starts.'),
    h('div.inline', {}, [
      num('Study hours / day', c.availability.defaultHours, { min: 0.5, step: 0.5 }, v => { c.availability.defaultHours = Math.max(0.5, v); store.save(); }),
      time('Day starts at', c.availability.wakeTime, v => { c.availability.wakeTime = v; store.save(); }),
    ]),
    h('p.hint', {}, 'Per-day overrides: on a day you have less/more time, edit “capacity” from the Plan → day view (coming from your edits here first).'),
  ]);
}

function cognitiveCard(c) {
  const cl = c.cognitiveLoad;
  return h('div.card', {}, [
    h('h2', {}, 'Cognitive load'),
    h('p.sub', {}, 'When you’re sharpest (hardest topics go here) and your hard daily ceiling so the coach never pushes you into burnout.'),
    h('div.inline', {}, [
      time('Peak focus starts', cl.peakStart, v => { cl.peakStart = v; store.save(); }),
      time('Peak focus ends', cl.peakEnd, v => { cl.peakEnd = v; store.save(); }),
      num('Max study hours / day (burnout cap)', cl.dailyMaxStudyHours, { min: 1, step: 0.5 }, v => { cl.dailyMaxStudyHours = Math.max(1, v); store.save(); }),
    ]),
  ]);
}

function activitiesCard(c) {
  const rows = c.activities.map(a => h('div.task', {}, [
    h('div.task-main', {}, [
      h('div.inline', {}, [
        h('label.field', { style: 'margin:0' }, [h('span', {}, 'Activity'),
          h('input', { type: 'text', value: a.label, onchange: e => { a.label = e.target.value; store.save(); } })]),
        h('label.field', { style: 'margin:0' }, [h('span', {}, 'Minutes'),
          h('input', { type: 'number', min: 5, step: 5, value: a.minutes, onchange: e => { a.minutes = Math.max(5, +e.target.value); store.save(); } })]),
        h('label.field', { style: 'margin:0' }, [h('span', {}, 'Fixed time (optional)'),
          h('input', { type: 'time', value: a.time || '', onchange: e => { a.time = e.target.value; store.save(); } })]),
      ]),
    ]),
    h('button.btn.ghost.sm', { onclick: () => { c.activities = c.activities.filter(x => x !== a); store.save(); } }, '✕'),
  ]));
  return h('div.card', {}, [
    h('h2', {}, 'Activities & breaks'),
    h('p.sub', {}, 'Gym, walks, meals, breaks — carved out of the day so study time is realistic.'),
    ...rows,
    h('button.btn.sm.mt', { onclick: () => { c.activities.push({ id: 'act-' + Date.now(), label: 'New activity', minutes: 30, time: '' }); store.save(); } }, '+ Add activity'),
  ]);
}

function spacesCard(c) {
  const cards = c.studySpaces.map(s => h('div.day-card', {}, [
    h('div.day-head', {}, [
      h('label', { style: 'display:flex;align-items:center;gap:10px;flex:1' }, [
        h('input', { type: 'checkbox', checked: s.active, onchange: e => { s.active = e.target.checked; store.save(); } }),
        h('input', { type: 'text', value: s.label, style: 'flex:1', onchange: e => { s.label = e.target.value; store.save(); } }),
      ]),
      h('button.btn.ghost.sm', { onclick: () => { c.studySpaces = c.studySpaces.filter(x => x !== s); store.save(); } }, '✕'),
    ]),
    h('div.day-body', {}, [
      h('p.sub', { style: 'margin:0 0 8px' }, 'Environment checklist (you confirm this before each focus block):'),
      ...s.checklist.map((item, i) => h('div', { style: 'display:flex;gap:8px;margin-bottom:6px' }, [
        h('input', { type: 'text', value: item, style: 'flex:1', onchange: e => { s.checklist[i] = e.target.value; store.save(); } }),
        h('button.btn.ghost.sm', { onclick: () => { s.checklist.splice(i, 1); store.save(); } }, '✕'),
      ])),
      h('button.btn.ghost.sm', { onclick: () => { s.checklist.push('New checklist item'); store.save(); } }, '+ Add item'),
    ]),
  ]));
  return h('div.card', {}, [
    h('h2', {}, 'Study spaces'),
    h('p.sub', {}, 'Where you study and the setup ritual for each. Keep “phone away” on the list — it’s the point.'),
    h('div.day-list', {}, cards),
    h('button.btn.sm.mt', { onclick: () => { c.studySpaces.push({ id: 'sp-' + Date.now(), label: 'New space', active: true, checklist: ['Phone away', 'Water', 'Clear one goal'] }); store.save(); } }, '+ Add study space'),
  ]);
}

function pomodoroCard(c) {
  const p = c.pomodoro;
  return h('div.card', {}, [
    h('h2', {}, 'Pomodoro'),
    h('p.sub', {}, 'Focus/break lengths for the Today timer.'),
    h('div.inline', {}, [
      num('Focus (min)', p.work, { min: 5, step: 5 }, v => { p.work = Math.max(5, v); store.save(); }),
      num('Short break (min)', p.shortBreak, { min: 1 }, v => { p.shortBreak = Math.max(1, v); store.save(); }),
      num('Long break (min)', p.longBreak, { min: 1 }, v => { p.longBreak = Math.max(1, v); store.save(); }),
      num('Long break every N', p.longEvery, { min: 2 }, v => { p.longEvery = Math.max(2, v); store.save(); }),
    ]),
  ]);
}

function jobCard(c) {
  const j = c.jobSearch;
  return h('div.card', {}, [
    h('h2', {}, 'Job-search targets'),
    h('p.sub', {}, 'Weekly cadence and your EAD deadline. These inject a daily job block and drive the countdown.'),
    h('div.inline', {}, [
      num('Applications / week', j.weeklyApplications, { min: 0 }, v => { j.weeklyApplications = Math.max(0, v); store.save(); }),
      num('Coffee chats / week', j.weeklyCoffeeChats, { min: 0 }, v => { j.weeklyCoffeeChats = Math.max(0, v); store.save(); }),
      num('Daily job block (min)', j.dailyMinutes, { min: 0, step: 5 }, v => { j.dailyMinutes = Math.max(0, v); store.save(); }),
    ]),
    h('label.field.mt', {}, [h('span', {}, 'EAD / job-search deadline'),
      h('input', { type: 'date', value: j.eadDeadline, onchange: e => { j.eadDeadline = e.target.value; store.save(); } })]),
    h('label.field', {}, [h('span', {}, 'Consultant note'),
      h('textarea', { onchange: e => { j.consultantNote = e.target.value; store.save(); } }, j.consultantNote)]),
  ]);
}
