// ics.js — export schedule blocks as an .ics calendar file.
// Importing into Apple/Google Calendar is the bridge to *phone* reminders:
// your phone's calendar fires native alerts for each block, even though the app
// itself is laptop-only.

function pad(n) { return String(n).padStart(2, '0'); }

// Build a local-time DTSTART/DTEND value (floating time, no TZ suffix) so events
// land at the intended wall-clock time in whatever calendar imports them.
function dt(iso, hhmm) {
  const [y, m, d] = iso.split('-');
  const [h, min] = hhmm.split(':');
  return `${y}${m}${d}T${pad(h)}${pad(min)}00`;
}

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// blocks: [{ start, end, kind, title, detail }] all on the same `iso` date.
// reminderKinds: which block kinds get a VALARM popup (default study + job).
export function buildICS(iso, blocks, { calName = 'prep-coach', reminderKinds = ['study', 'job'] } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//prep-coach//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(calName)}`,
  ];
  let seq = 0;
  for (const b of blocks) {
    const uid = `prepcoach-${iso}-${seq++}-${b.start.replace(':', '')}@local`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${dt(iso, b.start)}`);
    lines.push(`DTEND:${dt(iso, b.end)}`);
    lines.push(`SUMMARY:${esc(iconFor(b.kind) + ' ' + b.title)}`);
    if (b.detail) lines.push(`DESCRIPTION:${esc(b.detail)}`);
    if (reminderKinds.includes(b.kind)) {
      lines.push('BEGIN:VALARM', 'TRIGGER:-PT2M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(b.title)}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function iconFor(kind) {
  return { study: '📘', break: '☕', activity: '🏃', job: '💼', focus: '🎯' }[kind] || '•';
}

export function downloadICS(filename, contents) {
  const blob = new Blob([contents], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
