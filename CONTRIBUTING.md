# Contributing to SyncScribe

This guide is for anyone joining the project. Read it once before you start; it takes five minutes.

## 1. Get access

1. Send your GitHub username to the repo owner. They add you under **Settings → Collaborators**, and you accept the email invite.
2. Install **Node.js 20 or newer** and **Git**.

## 2. One-time setup

```bash
git clone https://github.com/Sangitaswain/SyncScribe.git
cd SyncScribe
npm install
```

**Set your own name and email.** Your commits are counted under whoever is set here, so do this before your first commit:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"   # the email on your GitHub account
```

Check that it works:

```bash
npm run dev      # web app on http://localhost:5173, server on http://localhost:4000
npm test         # all tests should pass
```

## 3. How the work is organised

- **`docs/IMPLEMENTATION_PLAN.md` is the to-do list.** It is split into steps and substeps. Each substep has a "Done when" check and an exact commit message.
- Work **top to bottom**: the next task is always the first unchecked substep (`- [ ]`).
- **One substep = one commit.** Tick its box (`- [x]`) in the plan and include that change in the same commit.
- The design is locked (git tag `design-v1`). Reuse the existing styles; don't change colours, fonts or the landing page.

## 4. Every time you work

We take turns, so only one person works at a time. Always start by pulling the latest code.

```bash
git pull                 # 1. get the latest code
npm install              # 2. only needed if package.json changed
npm run dev              # 3. run the app
```

Then, for each substep:

1. Implement it and check its **"Done when"** in the browser.
2. Run `npm test` and `npm run lint`. Both must pass.
3. Tick the substep in `docs/IMPLEMENTATION_PLAN.md`.
4. Commit with the **exact** message from the plan, then push:

```bash
git add -A
git commit -m "feat(web): add network monitor with debounced status"   # the plan's message
git push
```

When you finish your turn, tell the team which substep you stopped at.

## 5. Commit rules

- Use the plan's commit message word for word.
- **No AI attribution.** No `Co-Authored-By: Claude`, no "Generated with Claude". This repo's `.claude/settings.json` already turns that off for Claude Code, but check `git log -1` after each commit anyway.
- Never commit `.env`, tokens or the database file (`apps/server/data/`). `.gitignore` already handles this.

## 6. Using Claude Code

Open Claude Code in the project folder. It reads `CLAUDE.md` automatically, which tells it the project rules. Start each session with this prompt:

> Read the implementation plan before starting. Let's start implementing our steps one by one. Use the simplest approach. The fewer lines of code, the better. Stop after each step. Go back and review if it's working correctly. Make sure not to break any other working functionality. Provide a detailed summary. Ask me to manually check and ask me to move forward to the next step.

Then, after each substep:

1. Test it yourself in the browser, following what Claude asks you to check.
2. If it works, tell Claude to commit and push. If it doesn't, describe what you saw (a screenshot helps).

## 7. If something goes wrong

| Problem                                    | Fix                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `git push` is rejected                     | Someone pushed first. Run `git pull`, then push again.                          |
| Merge conflict in `IMPLEMENTATION_PLAN.md` | Keep both sets of ticked boxes, save, `git add` the file, `git commit`.         |
| Sign-up says "Can't reach SyncScribe"      | The server isn't running. Use `npm run dev`, not only the web app.              |
| Tests fail before you changed anything     | Run `git pull` and `npm install`, then try again. Still failing? Tell the team. |
| GitHub asks for a password                 | Use a Personal Access Token (GitHub → Settings → Developer settings → Tokens).  |

## Useful docs

| Document                                                                                          | What it's for                                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)                                      | The task list: read first, every time                                 |
| [`docs/SyncScribe-PRD.md`](docs/SyncScribe-PRD.md)                                                | What the app should do                                                |
| [`docs/FRONTEND_PLAN.md`](docs/FRONTEND_PLAN.md) / [`docs/BACKEND_PLAN.md`](docs/BACKEND_PLAN.md) | How the app is built; substeps reference their sections (FP-x / BP-x) |
| [`CLAUDE.md`](CLAUDE.md)                                                                          | Rules Claude Code follows in this repo                                |
