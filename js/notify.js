// notify.js — desktop browser notifications (in-session nudges).
// Works when the page is served over http://localhost or https (a "secure
// context"); it is disabled on file:// pages — hence run.sh serves over localhost.

export function supported() { return 'Notification' in window; }

export function permission() { return supported() ? Notification.permission : 'denied'; }

export async function requestPermission() {
  if (!supported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try { return await Notification.requestPermission(); }
  catch { return Notification.permission; }
}

export function notify(title, body, tag) {
  if (!supported() || Notification.permission !== 'granted') return null;
  try {
    return new Notification(title, { body, tag, icon: undefined, requireInteraction: false });
  } catch (e) {
    console.warn('notify failed', e);
    return null;
  }
}

// Fire a notification after `delayMs`. Returns a cancel function. Only fires while
// the tab/app stays open — good for the current session's block/break pings.
const timers = new Set();
export function schedule(delayMs, title, body, tag) {
  const id = setTimeout(() => { timers.delete(id); notify(title, body, tag); }, delayMs);
  timers.add(id);
  return () => { clearTimeout(id); timers.delete(id); };
}
export function clearAllScheduled() { for (const id of timers) clearTimeout(id); timers.clear(); }
