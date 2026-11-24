// Pure time rules for tasks: when a task ends, when it is overdue, which reminders are due, quiet hours.
// No DOM and no store, so node can unit-test it. Times are local: 'YYYY-MM-DD' + 'HH:MM'.

export const MINUTE = 60 * 1000;
export const PRE_MINUTES = 5;
// How late a reminder may still fire, e.g. when the tab was asleep. Older ones are dropped: the overdue list covers them.
const GRACE = { pre: 2 * MINUTE, start: 2 * MINUTE, end: 30 * MINUTE, snooze: 30 * MINUTE };

export const at = (date, time) => new Date(`${date}T${time || '00:00'}`).getTime();

/** When a task counts as finished: its end time, else its start time, else the end of its day. */
export function endOf(task) {
  if (task.to) return at(task.date, task.to);
  if (task.from) return at(task.date, task.from);
  return at(task.date, '00:00') + 24 * 60 * MINUTE;
}

export const isOverdue = (task, now) => !task.done && now >= endOf(task);

/**
 * Reminders for one task. Keys include the schedule, so rescheduling a task re-arms its reminders on its own.
 * pre: 5 minutes before the start, start: at the start, end: check-in at the end time.
 */
export function remindersFor(task) {
  if (task.done) return [];
  const list = [];
  if (task.from) {
    const start = at(task.date, task.from);
    const stamp = `${task.date}T${task.from}`;
    list.push({ kind: 'pre', at: start - PRE_MINUTES * MINUTE, key: `${task.id}|pre|${stamp}` });
    list.push({ kind: 'start', at: start, key: `${task.id}|start|${stamp}` });
  }
  if (task.from && task.to) list.push({ kind: 'end', at: at(task.date, task.to), key: `${task.id}|end|${task.date}T${task.to}` });
  if (task.snooze?.at) list.push({ kind: 'snooze', of: task.snooze.of, at: task.snooze.at, key: `${task.id}|snooze|${task.snooze.at}` });
  return list.map((r) => ({ ...r, taskId: task.id }));
}

/**
 * What to do right now. `fire`: show these. `skip`: due but superseded by a later reminder for the same task
 * (e.g. the app opened at 10:01, so "starts now" wins over "5 minutes left"); record them so they never fire.
 */
export function dueReminders(tasks, now, firedKeys) {
  const fire = [];
  const skip = [];
  for (const task of tasks) {
    const due = remindersFor(task)
      .filter((r) => !firedKeys.has(r.key) && now >= r.at && now - r.at <= GRACE[r.kind])
      .sort((a, b) => a.at - b.at);
    if (!due.length) continue;
    skip.push(...due.slice(0, -1));
    fire.push(due.at(-1));
  }
  return { fire, skip };
}

const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Quiet hours may cross midnight (22:30 to 07:00). */
export function isQuiet(now, { quietOn, quietFrom, quietTo }) {
  if (!quietOn || !quietFrom || !quietTo || quietFrom === quietTo) return false;
  const d = new Date(now);
  const m = d.getHours() * 60 + d.getMinutes();
  const from = minutesOf(quietFrom);
  const to = minutesOf(quietTo);
  return from < to ? m >= from && m < to : m >= from || m < to;
}
