# prep-coach — project context

A single-user, laptop-and-phone **study-accountability app** plus a **10-day SQL
bootcamp**, built to get the owner interview-ready for **marketing / business
analyst** roles (1–2 yr bar) inside a <90-day job window.

## Who this is for (the owner's goal)
Career-changer with a strong marketing/GTM + MBA (Business Analytics, STEM)
background but **basic SQL**. The résumé already lists SQL + Tableau, so the real
job is making those claims **defensible in a technical screen**. Priority order
for the job: **SQL (the gate) → Tableau → a portfolio project → Python/stats.**
The app keeps her accountable; the bootcamp is the curriculum.

## Live + repo
- **Deployed (GitHub Pages):** https://priandproper.github.io/prep-coach/
  - App: `/` · Bootcamp: `/bootcamp.html` · Handouts: `/day1.html`, `/day2.html`
- **Repo:** `priandproper/prep-coach` (public). Pushed over SSH via host alias
  `github-priandproper`. Commits as **Priyanka Tambe / ptambe1@babson.edu**.
- Every push to `main` auto-deploys via GitHub Pages ("Deploy from a branch",
  main /root). There is **no build step**.

## Run locally
```bash
cd prep-coach && ./run.sh        # python3 -m http.server 8000  → http://localhost:8000
```
Notifications + service worker need `http://localhost` or https (not `file://`).

## Tech
Vanilla **HTML/CSS/JS ES modules**, zero dependencies, no framework, no bundler.
Installable **PWA** (manifest + service worker, offline app-shell cache).
All state in **localStorage** (`store.js`), key `prepcoach.v1`.

### Files
```
index.html · styles.css · sw.js · manifest.json · run.sh · icons/
js/
  app.js         hash router (#/today #/plan #/jobs #/config) + data backup/restore
  store.js       state, localStorage, dates, migrations, export/import
  scheduler.js   buildSchedule(), fitAnalysis(), layoutDay(plan,config,dayObj,override)
  pomodoro.js    focus timer; breakMode 'auto' | 'ask' (onAsk check-in)
  confetti.js    tiny dependency-free celebration burst (respects reduced-motion)
  ui.js          h() DOM helper, mount(), toast(), modal()
  notify.js      desktop notifications   ics.js  calendar (.ics) export
  views/today.js  the home (biggest file) — see "self-paced model" below
  views/plan.js   curriculum editor, fit banner, day list w/ "Start here"
  views/config.js Setup (availability, activities, cognitive load, spaces, timer, jobs)
  views/jobsearch.js  weekly application/coffee-chat log + EAD countdown
  data/sql-plan.js    10-topic SQL curriculum (contentVersion 3, action-verb titles)
  data/resources.js   curated practice links
bootcamp.html · day1.html · day2.html   standalone browser handouts (ivory+green themed)
```

## Design system (don't drift from this)
Theme is **"Ivory + Hunter Green"** — set in `styles.css :root`:
- bg `#f4f1ea` (ivory) · text `#201e1a` (charcoal) · accent `#2f5d3f` (hunter green)
- ink-on-green `#f6f3ec` · line `#e4dfd3`. All-sans, minimal, tactile.
The **focus-mode overlay is intentionally dark** (immersive charcoal + green ring).
The owner iterated through cream/sage, indigo, and lime and settled here — do not
reintroduce those. Keep it sleek, minimal, action-first.

## Self-paced day model (important — recently changed)
Days are **NOT calendar-based** anymore. Progress lives in `store.progress()`:
- `dayCursor` — 0-based current sprint day. Advances **only when the user
  completes the current day and taps the "Day N done → start Day N+1" button**
  (`advanceDay()` in today.js). The calendar / `plan.startDate` no longer drives it.
- `doneTasks` — global array of completed task ids (e.g. `'t2:0'`), independent of
  any date. `toggleTask(taskId, on)` maintains it.
- `dayRecord(iso).dayPlan` — the per-day planning questionnaire result:
  `{ wake, getReadyMins, gym{go,time,mins}, walk{...}, others[], jobMins, jobSplit, hardStop }`.
  `dayPlanToOverride()` feeds it to `layoutDay()`, which lays study/breaks/job blocks
  around fixed activities. `jobSplit` → two application blocks (morning + end).
- `jobLog[weekStartISO]` — `{applications, coffeeChats}` (still weekly/calendar).
- `store.js migrate()` seeds `dayCursor`/`doneTasks` from old calendar-keyed records.
- **Plan tab → "Start here"** on any day jumps the cursor there and clears that
  day onward for a fresh start.

`sched.days[dayIdx]` is the sprint-day object (topics assigned by index).
`tasksForDay(dayObj)` turns a day's topic checklists into task items.

## Conventions
- **Bump the service-worker cache on every deploy** so installed PWAs update:
  `sw.js` → `const CACHE = 'prepcoach-vN'` (currently **v19**). Increment N.
- Verify UI changes in the browser before shipping. The in-app **preview caches ES
  modules aggressively** — to check new code, dynamic-import with a cache-buster
  (`import('/js/x.js?v='+Date.now())`) or fully clear SW+caches and reload.
- Commit messages: end with the Co-Authored-By line already used in history.
- Content changes to `data/sql-plan.js` must bump `contentVersion` (store.js
  migrate refreshes wording on existing devices without wiping progress).

## Current status
- SQL sprint is **self-paced**; the owner is on **Day 2 (Filter with precision)**
  and about to use Plan → "Start here" → Day 2 to reset to a clean Day 2.
- Built so far: PWA + install, day planner questionnaire, split/continuous job
  time, break check-in (auto/ask), one-tap full-screen focus mode with dial +
  confetti + chime, self-paced days + "Start here", standalone bootcamp + day1/day2
  handouts (day2 is a gradual step-by-step lesson).

## Open threads / likely next tasks
1. **Tableau portfolio dashboard** (active detour): a *Marketing Performance*
   dashboard (KPIs → funnel → trend → channel efficiency → recommendation).
   Wants: a realistic marketing dataset (CSV), SQL to prep it, and a Tableau
   build plan. This is portfolio/interview prep, **not** app code.
2. **Day 3–10 handouts** in the gradual style of `day2.html`.
3. **Tier-2 engagement** (coach voice, morning-intention/evening-reflection, count-ups,
   milestone celebrations) — research already done; Tier-1 shipped.
4. Optional: offer a plain tappable **checkbox list** as an alternative to the ring dial.

## What NOT to do
- Don't reintroduce calendar-based day advancement.
- Don't add dependencies / a build step / external CDNs (breaks offline + CSP-free simplicity).
- Don't push to GitHub unless asked (though the working pattern here has been ship-on-request).
- Don't over-gamify (no XP economy/mascots) — keep it minimal per the owner's taste.
