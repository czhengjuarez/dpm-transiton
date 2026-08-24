# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npx wrangler dev                                # local dev, http://localhost:8787
npx wrangler deploy                              # deploy to Cloudflare
npx wrangler d1 migrations apply TALLY --local   # apply schema to the local D1 sim (run once, or after adding a migration)
npx wrangler d1 migrations apply TALLY --remote  # same, against production
```

There is no lint or test suite. Verify changes by running `wrangler dev`, checking `node --check <file>` for syntax, and driving the app with a headless browser (Playwright is not a project dependency but is commonly available; install it ad hoc if needed) — click through mode select → sort → analyse, and check `console --errors` / page errors, since this is a hand-written vanilla JS front end with no build step to catch mistakes early.

Workers AI (`env.AI`) does not run in local `wrangler dev` by default; requests fall back to the rules engine (`aiError: "no-ai-binding"` is the correct, expected local behavior). Use `wrangler dev --remote` to exercise the model locally. D1 (`env.TALLY`) does run locally by default, no flag needed, but needs the local migration applied first (see above) or every request silently falls back to seed-only values.

## Architecture

**Request flow:** `src/index.js` is the only Worker entry point. It routes `/api/tasks` and `/api/advise`, and hands everything else to the static assets binding (`public/`). `src/tasks.js` is the single source of truth for content (39 tasks, 13 clusters, 4 categories); `src/advice.js` is a pure rules engine (no I/O) that turns a reader's marks into a verdict, sequence, coverage, and divergence; `src/tally.js` is the only other I/O module, wrapping the D1-backed crowd tally.

**The rules engine is the product, the model is a bonus.** `analyse()` in `advice.js` computes a complete, correct result with no network call. `/api/advise` calls Workers AI on top of that to generate four paragraphs of prose, but if the AI binding is missing, times out, or returns something unparseable, the JSON rules-engine result is still returned and the front end renders it with an "unavailable" note instead of breaking. Preserve this fallback chain when touching either file — nothing should ever hard-depend on `env.AI`.

**Crowd average, not a fixed answer.** Each task carries a `post` field in `tasks.js`, set per cluster. That field is now only a *seed*, not the displayed answer: `src/tally.js` maintains a D1 table `(task_id, call, count)`, lazily seeded per task (`ensureSeeded`, weight 3) from `post` on first read, then incremented (`recordContribution`) when a browser submits with `contribute: true`. `readAverages` returns the plurality call per task, ties broken toward the seed. `advice.js`'s `analyse()` takes an optional `averages` map and falls back to the static `post` field when it's absent (no `TALLY` binding, or a D1 error) — same fallback discipline as the AI binding. `/api/tasks` returns a fresh `averages` snapshot with a short (2 min) cache, since it's live data; `/api/advise` computes the divergence table against an averages snapshot taken *before* recording the current submission's contribution, so a reader is never compared against a tally that already includes their own just-submitted answer.

**Task IDs are load-bearing.** IDs are `<clusterId>-<index within cluster>` (see `TASKS` in `tasks.js`), and they're used as: the localStorage key for in-progress marks (`ofw.dpm-transition.v1`), the D1 primary key for tallies, and the deep-link target for per-task DOM elements in `app.js`. Inserting a task in the middle of a cluster shifts every later index and silently corrupts both saved browser state and historical tally data for that cluster. Append new tasks to the end of a cluster; promote a task to its own cluster rather than reordering.

**Contribution is a soft, client-side-only guard.** The server trusts a `contribute: true` flag from the client and never verifies it; the one-contribution-per-browser rule lives entirely in `localStorage` (`ofw.dpm-transition.contributed`) in `app.js`. This is a known, accepted limitation consistent with the project's no-accounts stance, not a bug to "fix" with server-side enforcement unless asked.

**Front end (`public/app.js`)** is a single vanilla JS file with no framework and no build step, driven by a module-level `state` object and a `show(screenName)` function toggling `.hidden` on three screens (mode select, sort, result). Task clusters render grouped under `CATEGORIES` (from `/api/tasks`), with a defensive fallback to one flat ungrouped list if a stale cached API response lacks the `categories`/`averages` fields — the API responses are cached (`/api/tasks` publicly, for 2 minutes) so the front end must tolerate slightly stale shapes, not just the current one.

**Adding a task or cluster:** everything flows from `src/tasks.js` — `TASKS`, the `/api/tasks` payload, the progress denominator, and the sequence/coverage/divergence calculations all derive from `CLUSTERS`. A new cluster needs a `category` (must match an id in `CATEGORIES`) and a `post` (the seed call). Nothing needs to be pre-populated in D1 by hand; `ensureSeeded` handles it lazily.
