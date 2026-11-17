# SyncScribe — 5-minute demo script

Shows the core idea (local-first: work offline, merge automatically), then collaboration, sharing and history.
Every step below is also run automatically by `apps/web/e2e/demo.spec.ts`, so the script stays in step with the app.

## Before you start (2 minutes, not part of the demo)

1. Start the server and the **built** app (the offline reload needs the service worker, which `npm run dev` doesn't install):
   ```bash
   npm run dev -w apps/server                                  # terminal 1
   npm run build -w apps/web && npm run preview -w apps/web   # terminal 2
   ```
   Open <http://localhost:4173> in **two browser windows side by side**: a normal window (Priya) and a second browser or profile (Ali). Visit once while online so the app is cached.
2. Sign up as **Priya** in the left window and **Ali** in the right one. Skip the welcome tour in both.
3. Open DevTools → **Network** in both windows, so you can switch **Offline** quickly.
4. Zoom both windows to about 80 % so the status badge and the sidebar are visible.

## 1. It works offline (1 min)

> "Most web apps stop working when the Wi-Fi drops. SyncScribe saves everything on the device first."

1. Priya: **New doc**, title **Group Report**, type `Introduction: rivers shape cities.`
2. Point at the badge: **Synced**.
3. Priya: switch DevTools to **Offline**. Within a few seconds the badge says **Offline** and a banner says the work is saved on this device.
4. Keep typing: `Floods are getting worse.` A dot appears next to the doc in the sidebar: unsynced changes.
5. **Reload the page** while still offline. The app and the text are still there.

## 2. It syncs by itself (30 s)

1. Priya: switch back to **Online**.
2. The badge goes **Syncing → Synced** and the dot disappears. No clicks.

> "No Save button, no Sync button needed. It just catches up."

## 3. Sharing and live collaboration (1 min)

1. Priya: **Share** → enter Ali's email → **Editor** → **Invite**. Ali's bell shows a notification.
2. Ali: **Shared with me** → **Group Report**.
3. Type in both windows. Each sees the other's **cursor with their name and colour** and an avatar in the top bar.

## 4. Two people offline, same paragraph (1.5 min) — the highlight

> "What if both people edit the same document while offline? Most tools show a conflict dialog or lose someone's work."

1. Turn **both** windows **Offline**.
2. Priya: rewrite the introduction, e.g. add ` Priya's new intro.`
3. Ali: add a new line `Conclusion: build levees.`
4. Show that Priya's window does **not** have Ali's text: they really are apart.
5. Turn Priya **Online** (badge → Synced), then Ali.
6. Both windows now show **exactly the same text**, with both people's changes. No dialog, nothing lost.

## 5. Version history (1 min)

1. Priya: the **clock icon** (Version history). Versions are listed with time and authors.
2. Type a name in **Name the current version**, e.g. `Before review`, and save it.
3. Select an older version: a read-only preview.
4. **Restore this version**: the text goes back, and today's text was saved as a named version first, so nothing is lost. Ali's window updates too.

## If something goes wrong

- Badge stuck on **Offline** with Wi-Fi on: the server isn't running. Restart `npm run dev -w apps/server`.
- A window shows **Please sign in again**: the session expired; sign in, nothing is lost.
- To reset everything: stop the server and delete `apps/server/data/`, then clear site data in both browsers.

## Rehearsal log

| Date       | How                                                                  | Result |
| ---------- | -------------------------------------------------------------------- | ------ |
| 2026-11-18 | Automated run of every step (`npx playwright test e2e/demo.spec.ts`) | Pass   |
