# The DPM Transition Worksheet

Companion tool for **Design roles are shifting. So should the DPM role.** (Ops Forward).

A reader sorts 38 tasks, drawn from eight real Design Program Manager job postings, into five calls. They get back the role rewritten and sequenced, plus a transition plan for the person holding it.

## What changed from the first version

The first worksheet asked *is this still one person's job*. That is the wrong question, and it is not the question the post asks. This version asks **where does each piece of the work go**, which is the post's actual argument, and it treats the reader as someone who has to move the work rather than score it.

Four calls became five, matching the post's table:

| Call | Means |
|---|---|
| **Shift** | Goes to a TPM or another program function |
| **Automate** | A tool does this reliably today |
| **Retire** | Stop producing it |
| **Evolve** | Stays, but changes shape |
| **Elevate** | Becomes more valuable, invest here |

Every task carries a position, revealed **after** the reader makes their own call, so the tool collects an honest answer first and argues second. Disagreements are surfaced in their own table at the end, framed as the interesting result rather than an error.

That position used to be fixed: the essay author's call, baked into the data. It is now a **crowd average**, tallied in D1 across everyone who has run the worksheet. It still starts from the author's original call, seeded with a small weight so a task with zero real answers has an opinion, but real answers dilute and eventually outweigh that seed. See `src/tally.js`.

There also used to be a "Leader mode" and "DPM mode" chosen up front. They looked different but computed the same result: the rules engine never branched on mode, only the pronouns, the AI prompt's audience framing, and which result tab opened first did. That was too thin a difference to justify a choice screen, so there is now one flow. The copy is written to work either way, whether the reader is sorting their own job or one they lead, rather than assuming one and bolting the other on.

## Deploy

```bash
npm install
npx wrangler login                          # once
npx wrangler d1 create dpm-transition-tally # once, then paste the database_id into wrangler.toml
npx wrangler d1 migrations apply TALLY --remote
npx wrangler deploy
```

Workers AI needs no separate provisioning, the `[ai]` binding in `wrangler.toml` is enough. D1 does: create the database once, apply the migration, and paste the returned `database_id` over the placeholder in `wrangler.toml`.

To point it at a custom domain, add to `wrangler.toml`:

```toml
routes = [
  { pattern = "dpm.changyingart.com", custom_domain = true }
]
```

### Local development

```bash
npx wrangler d1 migrations apply TALLY --local   # once, creates the local tally table
npx wrangler dev
```

Workers AI does **not** run in local mode. You will see `Binding AI needs to be run remotely` and the page falls back to the rules engine, which is the correct behaviour and worth seeing at least once. To exercise the model locally:

```bash
npx wrangler dev --remote
```

D1 runs locally by default (a SQLite file under `.wrangler/state`), no `--remote` needed. If you skip the migration, `env.TALLY` still works but every request falls back to the static seed position, since the query errors are caught rather than surfaced, see `getAverages` in `src/index.js`.

## Architecture

```
src/index.js     Worker. Routes /api/*, hands everything else to the assets binding.
src/tasks.js     Task inventory. 38 tasks, 13 clusters, 8 sources. Single source of truth.
src/advice.js    Rules engine + prompt construction. No I/O.
src/tally.js     D1-backed crowd average: seed, record, read. The only I/O outside advice.js.
migrations/      D1 schema for the tally table.
public/          Static front end. No framework, no build step.
```

**The rules engine is the product.** It computes the verdict, the sequence, the capability coverage, and the divergence table with no network call and no model. The model adds four paragraphs of situated reasoning on top. If Workers AI is slow, rate limited, or absent, the page is still complete and correct, and it says so plainly rather than showing a broken state.

That ordering is deliberate. A worksheet that only works when an LLM is up is not a worksheet.

### The `/api/advise` contract

Request:

```json
{
  "marks": { "<taskId>": "shift|automate|retire|evolve|elevate" },
  "contribute": true
}
```

`contribute` records this browser's marks into the crowd tally. The client sends it `true` exactly once, tracked in `localStorage` under `ofw.dpm-transition.contributed`, so re-reading your own result does not inflate the average you are compared to. This is a soft client-side guard, not enforcement, consistent with the no-accounts design below.

Response:

```json
{
  "analysis": { "verdict": {...}, "sequence": [...], "coverage": [...], "divergence": [...], "counts": {...} },
  "ai": { "read": "...", "hardest": "...", "conversation": "...", "blindspot": "..." } | null,
  "aiError": "no-ai-binding" | "unparseable" | "too-few-marks" | "<message>"
}
```

Fewer than eight marks short-circuits before the model call. Nothing is worth saying about five clicks.

### Privacy

No accounts, no cookies, no analytics. Marks persist in `localStorage` under `ofw.dpm-transition.v1` so a refresh mid-sort does not cost forty clicks. The only thing that reaches the server is the map of task IDs to calls, which is needed to compute the result. No free text, no identity, nothing about the reader's employer. The task text itself is already public, it comes from job postings.

The tally table stores less than that: a per-task, per-call integer count, with no link back to who cast it, when, or from where. A contribution is one increment to one counter per marked task. There is no way to reconstruct an individual's answers from it.

### The model

`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, set in `wrangler.toml` under `[vars] MODEL` so it can be swapped without touching code.

The system prompt carries the post's argument and a hard style contract, including the no-em-dash rule. That rule is also **enforced at the boundary** in `src/index.js` rather than trusted to the model, because models ignore that instruction roughly a third of the time.

## Changing the task inventory

Everything lives in `src/tasks.js`. Adding a task to a cluster automatically:

- extends the flat `TASKS` list and the `/api/tasks` payload
- updates the progress denominator
- feeds the sequence, coverage, and divergence calculations

Task IDs are `<clusterId>-<index>`, so **inserting a task in the middle of a cluster invalidates saved localStorage state** for everyone mid-sort. Append rather than insert, or bump the `STORE` key in `public/app.js`.

`post` is set per cluster, not per task, and is now only the **seed** position, used to give a brand-new task an opinion before real answers arrive (see `src/tally.js`). If a single task inside a cluster deserves a different starting position, promote it to its own cluster rather than adding a per-task override, because the cluster note is what explains the position to the reader.

Appending a task also means it starts with zero rows in the tally table. `ensureSeeded` inserts its seed weight lazily on first request, so nothing needs to be pre-populated in D1 by hand.

## Front end notes

- **Categories.** The 13 clusters in `src/tasks.js` are grouped under 4 broader categories (`CATEGORIES` export: strategy and governance, coordination and communication, tooling and documentation, people and process), rendered as section headers on the sort screen. Add a cluster's `category` field when adding a cluster; nothing else needs to change.
- **Theme toggle.** Light/dark is a manual override on top of the OS preference, not a replacement for it. An inline script in `index.html`'s `<head>` applies any saved choice before first paint (no flash), the toggle button lives in the masthead, and the choice persists in `localStorage` under `ofw.dpm-transition.theme`. It works by forcing `color-scheme` on `:root`, everything else already used the `light-dark()` CSS function so no color needed to change.
- **Home link.** The masthead title ("DPM Transition Worksheet") is a button, not a link, it calls the same `show('mode')` the back button uses, so it returns to the mode screen without touching saved marks.

## Verification status of the sources

See `SOURCES.md`. Short version: eight postings, read 22 to 23 August 2026, two open at the time of reading. Task text is **paraphrased** from posting bullets, not quoted, so it is ours to edit. The three verbatim quotes that appear in the post itself are checked separately there.

## Open items

- The post's companion teaser still says "Thirty two tasks ... and four calls to make on each one." It is now **38 tasks and five calls.** That line needs updating before publication.
- The Indeed exact-phrase counts in the post need re-running on a single day.
