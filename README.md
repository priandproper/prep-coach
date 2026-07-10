# prep-coach

A laptop-only accountability coach for a time-boxed study sprint. Built for one job:
**make it impossible to drift** from the plan while prepping SQL (and job applications)
for marketing / business analytics roles.

It ships preloaded with a **10-day SQL curriculum** targeting the real interview bar
(joins → CTEs → window functions → dialect differences across Snowflake/Oracle/SQL Server →
a timed mock), and a job-search tracker for your weekly applications + coffee chats.

## Run it

Browser notifications only work over `http://localhost` (not `file://`), so serve it:

```bash
cd prep-coach
./run.sh              # → http://localhost:8000  (or: python3 -m http.server 8000)
```

Then open **http://localhost:8000** and click **Enable notifications** on the Today page.

No install, no build, no accounts, no server code. Everything lives in your browser
(`localStorage`). Use **Backup data** in the footer to save a JSON snapshot.

## What it does

- **Today** — your day, time-blocked (hardest topics in your peak-focus window), a task
  checklist, a streak, and an **at-risk banner** that shows the exact cascade of skipping a
  day. Starting a focus block forces you through your study-space checklist first — including
  *phone away* — before the Pomodoro timer runs.
- **Plan** — the dynamic scheduler. Set your topics, effort, priority, and cognitive load;
  it lays out the days and, if the work doesn’t fit the horizon, tells you the exact gap and
  offers three one-click fixes: **more hours/day**, **more days (≤14)**, or **trim
  low-priority topics**.
- **Job search** — weekly application + coffee-chat targets with quick-logging, a deadline
  countdown, and weekly history.
- **Setup** — availability, activities (gym/walks/meals/breaks), cognitive-load peak window +
  daily burnout cap, study spaces & their checklists, Pomodoro lengths, and job targets.

## Phone reminders

The app is laptop-only, so it can’t push to your phone directly. Instead, **Today → Export to
calendar** downloads a `.ics` file. Import it into Apple/Google Calendar once and your phone’s
native calendar fires the reminders for each block.

## Customize

Everything is editable in the app. To change the preloaded curriculum itself, edit
`js/data/sql-plan.js` (topics, hours, priority, cognitive load, checklist items, resource
links). Resource links live in `js/data/resources.js`.

## Structure

```
index.html · styles.css · run.sh
js/
  app.js          router + data backup/restore
  store.js        state, localStorage, dates
  scheduler.js    capacity, allocation, fit analysis, day layout
  ics.js          calendar export      notify.js  desktop notifications
  pomodoro.js     focus timer          ui.js      tiny DOM helpers
  views/          today · plan · config · jobsearch
  data/           sql-plan · resources
```
