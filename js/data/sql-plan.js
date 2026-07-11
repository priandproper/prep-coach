// sql-plan.js — the preloaded 10-day SQL curriculum.
// Targets the real analytics-interview bar: joins, aggregation, CTEs, window
// functions, dialect differences, and a timed mock. Each topic becomes one study
// unit the scheduler places on a day; `checklist` items become that day's tasks.
// Bump `contentVersion` when wording changes so devices refresh (see store.js).

export const SQL_PLAN = {
  goal: 'Interview-ready at SQL',
  startDate: null,
  horizonDays: 10,
  contentVersion: 3,
  topics: [
    {
      id: 't1', title: 'Get querying', estHours: 3.5, priority: 1, load: 'low',
      resourceRefs: ['sqlbolt', 'mode', 'dbfiddle'],
      summary: 'SELECT, WHERE, ORDER BY, LIMIT, DISTINCT — and a database to practice on all week.',
      checklist: [
        'Set up your practice database',
        'Do SQLBolt 1–6',
        'Write 10 SELECT / WHERE queries',
        'Note any syntax that tripped you up',
      ],
    },
    {
      id: 't2', title: 'Filter with precision', estHours: 4, priority: 1, load: 'medium',
      resourceRefs: ['sqlbolt', 'datalemur', 'mode'],
      summary: 'IN / BETWEEN / LIKE, NULL handling, string and date functions.',
      checklist: [
        'Practice IN, BETWEEN, LIKE',
        'Handle NULLs: IS NULL, COALESCE',
        'String functions',
        'Date functions',
        'Solve 6 easy questions',
      ],
    },
    {
      id: 't3', title: 'Crunch the numbers', estHours: 4, priority: 1, load: 'medium',
      resourceRefs: ['datalemur', 'mode', 'hackerrank'],
      summary: 'GROUP BY, HAVING, aggregates, and conditional aggregation with CASE.',
      checklist: [
        'GROUP BY with COUNT / SUM / AVG',
        'WHERE vs HAVING',
        'Conditional aggregation (CASE)',
        'Build a metric-per-segment query',
        'Solve 6 aggregation questions',
      ],
    },
    {
      id: 't4', title: 'Master the join', estHours: 4.5, priority: 1, load: 'high',
      resourceRefs: ['mode', 'pgexercises', 'datalemur'],
      summary: 'INNER / LEFT / RIGHT / FULL, self & anti-joins, and fan-out traps.',
      checklist: [
        'Diagram INNER / LEFT / RIGHT / FULL',
        'Self-join and anti-join',
        'Join 3+ tables',
        'Fix a duplicate-row (fan-out) bug',
        'Solve 6 join questions',
      ],
    },
    {
      id: 't5', title: 'Break it into CTEs', estHours: 4, priority: 1, load: 'high',
      resourceRefs: ['mode', 'datalemur', 'stratascratch'],
      summary: 'Correlated subqueries, chained CTEs, and recursive CTEs.',
      checklist: [
        'Rewrite a subquery as CTEs',
        'Correlated subquery',
        'Recursive CTE (hierarchy)',
        'Break one problem into 3 CTE steps',
        'Solve 5 CTE questions',
      ],
    },
    {
      id: 't6', title: 'Rank & dedupe', estHours: 4, priority: 1, load: 'high',
      resourceRefs: ['windowGuide', 'datalemur', 'leetcode'],
      summary: 'ROW_NUMBER, RANK, DENSE_RANK, PARTITION BY — the top-tested topic.',
      checklist: [
        'PARTITION BY vs GROUP BY',
        'ROW_NUMBER vs RANK vs DENSE_RANK',
        'Dedup with ROW_NUMBER',
        'Top-N per group',
        'Solve 6 window questions',
      ],
    },
    {
      id: 't7', title: 'Track trends over time', estHours: 4, priority: 1, load: 'high',
      resourceRefs: ['windowGuide', 'stratascratch', 'leetcode'],
      summary: 'LAG / LEAD, running totals, moving averages, period-over-period.',
      checklist: [
        'LAG / LEAD for period-over-period',
        'Running total',
        'Moving average',
        '% growth vs previous period',
        'Solve 6 window questions',
      ],
    },
    {
      id: 't8', title: 'Build funnels & cohorts', estHours: 4, priority: 2, load: 'high',
      resourceRefs: ['stratascratch', 'datalemur', 'mode'],
      summary: 'Funnels, cohort/retention, date bucketing — the scenario shapes.',
      checklist: [
        'Build a conversion funnel',
        'Cohort retention basics',
        'Date bucketing (DATE_TRUNC)',
        'A/B comparison by variant',
        'Solve 4 scenario questions',
      ],
    },
    {
      id: 't9', title: 'Speak every dialect', estHours: 3.5, priority: 2, load: 'medium',
      resourceRefs: ['snowflakeqUALIFY', 'mode'],
      summary: 'Snowflake / Oracle / SQL Server differences, plus indexing basics.',
      checklist: [
        'Row limits: TOP vs LIMIT vs FETCH',
        'Date functions across dialects',
        'Snowflake QUALIFY',
        'Read an EXPLAIN plan',
        'Write one query 3 ways',
      ],
    },
    {
      id: 't10', title: 'Prove it — timed mock', estHours: 3, priority: 1, load: 'high',
      resourceRefs: ['datalemur', 'stratascratch', 'leetcode'],
      summary: '5 problems in 45 minutes, then review your weak spots.',
      checklist: [
        'Solve 5 problems in 45 min, cold',
        'Score yourself; list gaps',
        'Re-solve misses out loud',
        'One hard window + CTE combo',
        'Write your gotchas cheat-sheet',
      ],
    },
  ],
};
