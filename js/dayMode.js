// Three dashboard modes picked from the date: weekday (Mon-Fri), Saturday (light study), Sunday (rest).
// Pure: no DOM, no store. The weekday entries are the planner's original content, unchanged.

export const WEEKDAY = 'weekday';
export const SATURDAY = 'saturday';
export const SUNDAY = 'sunday';

/** 'YYYY-MM-DD' -> mode. Local calendar day. */
export function dayMode(key) {
  const day = new Date(`${key}T00:00`).getDay();
  return day === 0 ? SUNDAY : day === 6 ? SATURDAY : WEEKDAY;
}
export const isSunday = (key) => dayMode(key) === SUNDAY;

/** Pick today's line from a list, the same way the header always has (day of month). */
export const ofTheDay = (list, date = new Date()) => list[date.getDate() % list.length];

export const MODES = {
  [WEEKDAY]: {
    title: 'A little progress, every day.',
    quotes: [
      ['I think I can, I know I can.', 'One step at a time.'],
      ['Small daily progress beats last-minute panic.', 'Consistency wins.'],
      ['Revise like the exam is tomorrow.', 'R1, R2, R3.'],
      ['Discipline is choosing what you want most over what you want now.', 'Future CA.'],
      ['Every chapter you finish is one less to fear.', 'Keep ticking.'],
      ['Practice the questions, not just the theory.', 'MTPs and RTPs.'],
      ['Rest is part of the plan, not a break from it.', 'Be kind to yourself.'],
    ],
  },
  [SATURDAY]: {
    title: 'Light study, lighter mind.',
    eyebrow: 'Saturday, light study day',
    headlines: ['A gentle Saturday. One or two small wins is plenty.', 'Light day today. Revise a little, rest a little.',
      'Keep the streak warm, not the stress high.', 'Saturday mode: easy topics, short sessions, early finish.'],
    slogan: 'Slow is still progress.',
    note: 'Light day: aim for one or two small study wins, then enjoy your Saturday.',
    quotes: [
      ['A little revision today saves a lot of panic later.', 'Easy Saturday.'],
      ['Short sessions count too.', 'One topic is enough.'],
      ['Light days keep long journeys going.', 'Pace yourself.'],
      ['Review the week, not the whole syllabus.', 'Gentle recap.'],
      ['Progress, not perfection.', 'Saturday rule.'],
      ['Do the easy chapter you keep postponing.', 'Small win.'],
      ['Study a bit, then go and have fun.', 'You earned it.'],
    ],
  },
  [SUNDAY]: {
    title: 'Rest, reset, recharge.',
    eyebrow: 'Sunday, rest day',
    headlines: ['Rest is part of the plan today.', 'No study target today. Recharge for the week ahead.',
      'A slow Sunday makes a strong Monday.', 'Today is for rest, family and a fresh mind.'],
    slogan: 'Rest is productive too.',
    note: 'No study target today. Only important revision, urgent backlog or something that truly cannot wait.',
    quotes: [
      ['Rest is not quitting. It is reloading.', 'Sunday reset.'],
      ['A tired mind revises nothing. Sleep in.', 'Recharge.'],
      ['Your streaks are safe. Take the day.', 'Rest day.'],
      ['Call someone you love today.', 'Sunday mood.'],
      ['Plan the week, then close the books.', 'Fresh start Monday.'],
      ['Even toppers take Sundays off.', 'Breathe.'],
      ['Go outside. The syllabus will wait.', 'Sun and fresh air.'],
    ],
    ideas: ['A long walk without your phone', 'Sleep in, guilt free', 'Cook or eat something you love', 'Call family or a friend',
      'Tidy your desk for Monday', 'A movie or a few episodes', 'Journal: what went well this week?', 'Stretch or yoga for 15 minutes',
      'Plan next week in 10 minutes', 'Read something that is not a module'],
  },
};
