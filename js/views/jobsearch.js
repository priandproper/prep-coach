// jobsearch.js — weekly targets, quick-log, EAD countdown, and history.
import { h, mount, toast, niceDate } from '../ui.js';
import * as store from '../store.js';

export function render(root) {
  const c = store.config();
  const j = c.jobSearch;
  const week = store.weekStartISO();
  const log = store.progress().jobLog;
  if (!log[week]) log[week] = { applications: 0, coffeeChats: 0 };
  const cur = log[week];

  const daysToEAD = store.daysBetween(store.todayISO(), j.eadDeadline);

  mount(root, [
    h('div.page-head', {}, [h('h1', {}, 'Job search'), h('p', {}, 'Your own applications + chats, on top of what your consultant sends. This is non-negotiable weekly.')]),
    countdownBanner(daysToEAD),
    h('div.grid.grid-2', {}, [
      h('div', {}, [
        h('div.card', {}, [
          h('h2', {}, `This week (from ${niceDate(week)})`),
          h('div.statrow', {}, [
            counterStat('Applications', cur.applications, j.weeklyApplications, () => bump('applications', 1), () => bump('applications', -1)),
            counterStat('Coffee chats', cur.coffeeChats, j.weeklyCoffeeChats, () => bump('coffeeChats', 1), () => bump('coffeeChats', -1)),
          ]),
          h('p.hint.mt', {}, 'Tip: aim to front-load applications early in the week so follow-ups and chats have room to land.'),
        ]),
        historyCard(log, j),
      ]),
      h('div', {}, [
        h('div.card', {}, [
          h('h2', {}, 'Consultant'),
          h('p.sub', {}, j.consultantNote),
          h('hr.sep'),
          h('h3', {}, 'Weekly checklist'),
          checkItem('Applied to target number of roles'),
          checkItem('Sent connection requests to 10+ people'),
          checkItem('Followed up on last week’s outreach'),
          checkItem('Updated LinkedIn / resume with a new SQL win'),
          h('p.hint.mt', {}, 'These reset visually each week — they’re a nudge, not stored state.'),
        ]),
        h('div.card', {}, [
          h('h2', {}, 'Fast links'),
          h('div.btn-row', {}, [
            h('a.btn.sm.ghost', { href: 'https://www.linkedin.com/jobs/', target: '_blank', rel: 'noopener' }, 'LinkedIn Jobs'),
            h('a.btn.sm.ghost', { href: 'https://www.linkedin.com/mynetwork/', target: '_blank', rel: 'noopener' }, 'My Network'),
          ]),
        ]),
      ]),
    ]),
  ]);

  function bump(field, n) {
    cur[field] = Math.max(0, (cur[field] || 0) + n);
    store.save();
    if (n > 0) toast(field === 'applications' ? 'Application logged 💼' : 'Coffee chat logged ☕');
    render(root);
  }
}

function countdownBanner(days) {
  const level = days <= 30 ? 'bad' : days <= 60 ? 'warn' : 'info';
  const icon = { bad: '⏰', warn: '⏳', info: '🗓️' }[level];
  return h('div', { class: 'banner ' + level }, [
    h('div.icon', {}, icon),
    h('div.body', {}, [
      h('h3', {}, `${days} days until your deadline`),
      h('p', {}, days <= 30 ? 'Crunch window — maximize applications and outreach every single week.' : 'Steady cadence now compounds. Keep the weekly numbers up.'),
    ]),
  ]);
}

function counterStat(label, val, target, inc, dec) {
  const pct = target ? Math.min(100, Math.round((val / target) * 100)) : 0;
  return h('div.stat', { style: 'min-width:200px' }, [
    h('div', { class: 'n ' + (pct >= 100 ? 'good' : pct >= 50 ? 'warn' : 'bad') }, `${val} / ${target}`),
    h('div.l', {}, label),
    h('div.progress', {}, [h('i', { class: pct >= 100 ? 'good' : pct >= 50 ? 'warn' : '', style: `width:${pct}%` })]),
    h('div.btn-row.mt', {}, [
      h('button.btn.sm.primary', { onclick: inc }, '+1'),
      h('button.btn.sm.ghost', { onclick: dec }, '−1'),
    ]),
  ]);
}

function historyCard(log, j) {
  const weeks = Object.keys(log).sort().reverse().slice(0, 8);
  if (weeks.length <= 1) return h('div.card', {}, [h('h2', {}, 'History'), h('p.sub', {}, 'Your weekly totals will build up here.')]);
  return h('div.card', {}, [
    h('h2', {}, 'Recent weeks'),
    ...weeks.map(w => {
      const r = log[w];
      const ok = r.applications >= j.weeklyApplications && r.coffeeChats >= j.weeklyCoffeeChats;
      return h('div.checkline', {}, [
        h('span', {}, ok ? '✅' : '•'),
        h('span', { style: 'flex:1' }, niceDate(w)),
        h('span.muted', {}, `${r.applications} apps · ${r.coffeeChats} chats`),
      ]);
    }),
  ]);
}

function checkItem(label) {
  return h('label.checkline', {}, [h('input', { type: 'checkbox' }), h('span', {}, label)]);
}
