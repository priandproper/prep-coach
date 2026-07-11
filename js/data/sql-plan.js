// sql-plan.js — the preloaded 10-day SQL curriculum.
// Targets the real analytics-interview bar: joins, aggregation, CTEs, window
// functions, dialect differences (Snowflake/Oracle/SQL Server), and a timed mock.
// Each topic becomes one study "unit" the scheduler places on a day; `checklist`
// items become that day's checkable tasks. `estHours` drives dynamic scheduling.

export const SQL_PLAN = {
  goal: 'Become interview-strong at SQL',
  startDate: null,        // set to today on first load
  horizonDays: 10,        // 10-day sprint, extendable to 14
  topics: [
    {
      id: 't1', title: 'Foundations & practice setup', estHours: 3.5, priority: 1, load: 'low',
      resourceRefs: ['sqlbolt', 'mode', 'dbfiddle'],
      summary: 'SELECT, WHERE, ORDER BY, LIMIT, DISTINCT — and stand up a database you can run queries against all week.',
      checklist: [
        'Set up your practice database',
        'Do SQLBolt lessons 1–6',
        'Write 10 SELECT / WHERE / ORDER BY queries',
        'Note any syntax that tripped you up',
      ],
    },
    {
      id: 't2', title: 'Filtering, NULLs & functions', estHours: 4, priority: 1, load: 'medium',
      resourceRefs: ['sqlbolt', 'datalemur', 'mode'],
      summary: 'IN / BETWEEN / LIKE, NULL handling (IS NULL, COALESCE), string and date functions — the everyday toolkit.',
      checklist: [
        'Practice IN, BETWEEN, LIKE, and boolean logic (AND/OR/NOT)',
        'Master NULL handling: IS NULL, COALESCE, NULLIF, and why = NULL fails',
        'String functions: CONCAT, SUBSTRING, TRIM, UPPER/LOWER, REPLACE',
        'Date functions: extract parts, date math, DATE_TRUNC concept',
        'Solve 6 DataLemur "Easy" questions',
      ],
    },
    {
      id: 't3', title: 'Aggregation & GROUP BY', estHours: 4, priority: 1, load: 'medium',
      resourceRefs: ['datalemur', 'mode', 'hackerrank'],
      summary: 'GROUP BY, HAVING, COUNT/SUM/AVG/MIN/MAX, and conditional aggregation with CASE — the backbone of analytics.',
      checklist: [
        'GROUP BY with COUNT, SUM, AVG, MIN, MAX',
        'HAVING vs WHERE — when each applies',
        'Conditional aggregation: SUM(CASE WHEN ... THEN 1 ELSE 0 END)',
        'Build a "metrics per segment" query (e.g. revenue per channel)',
        'Solve 6 aggregation questions on DataLemur/HackerRank',
      ],
    },
    {
      id: 't4', title: 'Joins (incl. self & anti-joins)', estHours: 4.5, priority: 1, load: 'high',
      resourceRefs: ['mode', 'pgexercises', 'datalemur'],
      summary: 'INNER / LEFT / RIGHT / FULL, self-joins, anti-joins, multi-table joins — and the fan-out & duplicate traps interviewers love.',
      checklist: [
        'Diagram INNER vs LEFT vs RIGHT vs FULL with a tiny example',
        'Self-join (e.g. employees → managers) and anti-join (LEFT JOIN ... WHERE b.id IS NULL)',
        'Join 3+ tables and reason about row multiplication (fan-out)',
        'Deliberately create a duplicate-row bug, then fix it',
        'Solve 6 join questions; write one query joining 4 tables',
      ],
    },
    {
      id: 't5', title: 'Subqueries & CTEs', estHours: 4, priority: 1, load: 'high',
      resourceRefs: ['mode', 'datalemur', 'stratascratch'],
      summary: 'Correlated vs uncorrelated subqueries, CTEs for readability, chained CTEs, and recursive CTEs for hierarchies.',
      checklist: [
        'Rewrite a nested subquery as a chain of CTEs',
        'Correlated subquery: per-row lookups (e.g. above-average earners)',
        'Recursive CTE: walk an org chart or category tree',
        'Practice: break one hard problem into 3 named CTE steps',
        'Solve 5 CTE/subquery questions on StrataScratch/DataLemur',
      ],
    },
    {
      id: 't6', title: 'Window functions I — ranking', estHours: 4, priority: 1, load: 'high',
      resourceRefs: ['windowGuide', 'datalemur', 'leetcode'],
      summary: 'ROW_NUMBER, RANK, DENSE_RANK, PARTITION BY / ORDER BY, and deduplication with ROW_NUMBER — the single most-tested topic.',
      checklist: [
        'Understand PARTITION BY vs GROUP BY (rows kept vs collapsed)',
        'ROW_NUMBER vs RANK vs DENSE_RANK on tie cases',
        'Dedup rows keeping the latest per key with ROW_NUMBER',
        'Top-N per group (e.g. top 3 products per category)',
        'Solve 6 window-function questions',
      ],
    },
    {
      id: 't7', title: 'Window functions II — offsets & frames', estHours: 4, priority: 1, load: 'high',
      resourceRefs: ['windowGuide', 'stratascratch', 'leetcode'],
      summary: 'LAG / LEAD, running totals, moving averages, window frames (ROWS BETWEEN), and period-over-period growth.',
      checklist: [
        'LAG/LEAD for period-over-period (MoM, WoW) change',
        'Running total with SUM() OVER (ORDER BY ...)',
        'Moving average with ROWS BETWEEN N PRECEDING AND CURRENT ROW',
        'Compute % growth vs previous period',
        'Solve 6 offset/frame questions; explain one aloud',
      ],
    },
    {
      id: 't8', title: 'Analytics patterns', estHours: 4, priority: 2, load: 'high',
      resourceRefs: ['stratascratch', 'datalemur', 'mode'],
      summary: 'Funnels, cohort / retention basics, date bucketing, and top-N per group — the scenario shapes real analytics interviews use.',
      checklist: [
        'Build a conversion funnel across multiple event steps',
        'Simple cohort retention: signups grouped by month, active in later months',
        'Date bucketing with DATE_TRUNC / GROUP BY month',
        'A/B-style comparison: metric by variant with significance intuition',
        'Solve 4 medium/hard scenario questions on StrataScratch',
      ],
    },
    {
      id: 't9', title: 'Dialects & performance', estHours: 3.5, priority: 2, load: 'medium',
      resourceRefs: ['snowflakeqUALIFY', 'mode'],
      summary: 'Snowflake vs Oracle vs SQL Server differences (TOP / LIMIT / FETCH, date functions, Snowflake QUALIFY) plus indexing & EXPLAIN reasoning.',
      checklist: [
        'Row-limiting: SQL Server TOP, Oracle FETCH FIRST, Snowflake/Postgres LIMIT',
        'Date functions across dialects (DATEADD vs DATE_ADD vs interval math)',
        'Snowflake QUALIFY to filter window results without a subquery',
        'Read an EXPLAIN plan; know what an index does and when it helps',
        'Write the same query 3 ways for the 3 platforms you\'ll be asked about',
      ],
    },
    {
      id: 't10', title: 'Timed mock interview', estHours: 3, priority: 1, load: 'high',
      resourceRefs: ['datalemur', 'stratascratch', 'leetcode'],
      summary: 'Simulate the real round: 5 problems in 45 minutes, then review, then patch your weakest area.',
      checklist: [
        'Set a 45-minute timer; solve 5 mixed problems cold (no hints)',
        'Score yourself; list every concept you fumbled',
        'Re-solve the ones you missed, explaining each step out loud',
        'Do one final hard window-function + CTE combo problem',
        'Write a 1-page cheat-sheet of your personal gotchas',
      ],
    },
  ],
};
