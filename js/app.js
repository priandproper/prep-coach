// app.js — router + top-level wiring.
import * as store from './store.js';
import { toast, modal } from './ui.js';
import { buildSchedule } from './scheduler.js';
import { computeStreak } from './views/today.js';
import * as today from './views/today.js';
import * as planView from './views/plan.js';
import * as jobs from './views/jobsearch.js';
import * as config from './views/config.js';

const routes = {
  today: today.render,
  plan: planView.render,
  jobs: jobs.render,
  config: config.render,
};

const viewEl = document.getElementById('view');
const navEl = document.getElementById('nav');

function currentRoute() {
  const hash = location.hash.replace(/^#\//, '');
  return routes[hash] ? hash : 'today';
}

function renderRoute() {
  const route = currentRoute();
  for (const a of navEl.querySelectorAll('a')) a.classList.toggle('active', a.dataset.route === route);
  try {
    routes[route](viewEl);
  } catch (e) {
    console.error('render error', e);
    viewEl.innerHTML = `<div class="card"><h2>Something broke rendering this view</h2><p class="sub">${escapeHtml(e.message)}</p></div>`;
  }
  updateChrome();
}

function updateChrome() {
  const plan = store.plan();
  const streakEl = document.getElementById('streakNum');
  if (streakEl) streakEl.textContent = String(computeStreak(plan, buildSchedule(plan, store.config())));
  document.getElementById('goalTag').textContent = plan.goal.length > 22 ? plan.goal.slice(0, 22) + '…' : plan.goal;
  const days = store.daysBetween(store.todayISO(), store.config().jobSearch.eadDeadline);
  document.getElementById('ead-mini').textContent = `⏳ ${days} days to deadline`;
}

// Re-render on state changes (checkbox toggles, edits, etc.).
let raf = null;
store.subscribe(() => {
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(renderRoute);
});

window.addEventListener('hashchange', renderRoute);

// ---- footer data controls ----
document.getElementById('exportData').addEventListener('click', () => {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `prep-coach-backup-${store.todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded.');
});
const importFile = document.getElementById('importFile');
document.getElementById('importData').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    store.importJSON(await file.text());
    toast('Data restored.');
    renderRoute();
  } catch (e) { toast('Import failed — not a valid backup file.'); }
  importFile.value = '';
});
document.getElementById('resetData').addEventListener('click', () => {
  modal({
    title: 'Reset everything?',
    body: 'This wipes all progress, settings, and job-search logs, and restores the preloaded SQL plan starting today. Cannot be undone.',
    confirmText: 'Reset all', danger: true,
    onConfirm: () => { store.resetAll(); location.hash = '#/today'; renderRoute(); toast('Reset complete.'); },
  });
});

function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

// first paint
if (!location.hash) location.hash = '#/today';
renderRoute();
