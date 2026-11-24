# CA INTER HQ

A cosy study planner for CA Inter students: daily, weekly and monthly plans, a revision tracker for all six papers,
habits, goals with a vision board, and a focus room where an owl wakes up when you start studying and keeps an eye on you.

It is a plain static website (HTML, CSS, JavaScript) with no build step. Sign in with Google to sync across devices.

## Pages

| Page | What it does |
|---|---|
| Dashboard | Exam countdown, today's progress rings, top 3, schedule, week strip, habit check-in, mini owl |
| Main tracker | Type a task once and it appears on every page. Filters, inline edits, mood/sleep, notes and water logs |
| Daily planner | Hourly time blocks, top 3, to-do, mood and affirmation, wake/bed time, water glasses, meals, workout, notes |
| Week at a glance | Hour-by-day grid, weekly donut, tasks grouped by priority |
| Month at a glance | Calendar with tasks and events, monthly progress, upcoming events |
| Papers and revision | P1 to P6 with chapter-wise Read, R1, R2, R3 and MTP/Qs ticks, exam countdown |
| Focus room and owl | Pomodoro timer, an owl that sleeps, wakes, watches the pointer, notices tab switches and celebrates finished sessions |
| Habit tracker | Monthly grid for up to 12 habits, six KPI donuts, daily progress line, reflection notes |
| Goals and vision | Goals in six life areas with steps, year at a glance, vision board images |
| Analytics | Study hours, focus by paper, habit consistency, task completion |
| Settings and backup | Name, exam date, timer lengths, sounds, Google sync, download/restore backup |

## Your data and sync

The planner always saves to the browser first, so it is instant and works offline. After **Settings > Sign in with Google**,
it also keeps a copy in Firebase (Firestore) and updates every signed-in device live, even after being offline.

- One Firestore document per Google account (`users/{uid}`). `firestore.rules` lets only that account read or write it.
- Vision board photos stay on the device that added them (too big for the cloud document).
- If two devices both edit before syncing, the newest edit wins.
- First sign-in on a device that already has its own data asks which copy to keep, and downloads the other one as a backup file.
- The Firebase web config in `js/firebaseConfig.js` is public by design. The rules are what protect the data.

### One-time Firebase setup (already done for `ca-inter-hq`)

1. Authentication: enable the Google provider and add the site's domain under Settings > Authorized domains.
2. Firestore: create the database in production mode, then paste `firestore.rules` into the Rules tab and **Publish**.

## Run it locally

```bash
python3 -m http.server 8765
# open http://localhost:8765
```

(Opening `index.html` straight from the file system does not work, because browsers block JavaScript modules on `file://`.)

## Publish on GitHub Pages

Repository **Settings > Pages > Build and deployment > Deploy from a branch > `main` / root**.
The site appears at `https://<username>.github.io/<repo>/` within a minute or two. It can also be installed
to a phone's home screen ("Add to Home Screen"), and it opens offline after the first visit.

## Code layout

```
index.html            page shell and navigation
css/base.css          theme, layout, shared components
css/pages.css         planner grids, calendars, tables, habit grid, goals
css/owl.css           the owl character and the study room
js/app.js             boot, routing, header
js/store.js           the single source of truth (localStorage), backup/restore
js/sync.js            Google sign-in and Firestore sync (SDK loaded from Google's CDN)
js/syncCore.js        pure sync decisions (push, take cloud copy, ask), unit tested
js/firebaseConfig.js  public Firebase web config
firestore.rules       access rules to paste into the Firebase console
js/tasks.js           task model and shared task UI
js/focusTimer.js      pomodoro engine (timestamp based, survives refresh)
js/owl.js             SVG owl with moods, blinking and eye tracking
js/pages/*.js         one module per page
```
