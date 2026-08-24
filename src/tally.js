// Crowd tally over D1. Each task's "average" is the plurality call across
// everyone who has run the worksheet, seeded from the author's original
// per-cluster position so a task with zero real answers still has an opinion.
// As real answers accumulate they dilute, then outweigh, that seed.

import { TASKS } from './tasks.js';

const SEED_WEIGHT = 3;

const byId = new Map(TASKS.map((t) => [t.id, t]));

// Idempotent: only inserts a seed row for a task that has no rows yet, so
// calling this on every request costs one no-op statement per task after
// the first time.
export async function ensureSeeded(db, taskIds) {
  const stmts = taskIds
    .filter((id) => byId.has(id))
    .map((id) => {
      const task = byId.get(id);
      return db
        .prepare(
          `INSERT INTO tally (task_id, call, count)
           SELECT ?, ?, ?
           WHERE NOT EXISTS (SELECT 1 FROM tally WHERE task_id = ?)`
        )
        .bind(id, task.post, SEED_WEIGHT, id);
    });
  if (stmts.length) await db.batch(stmts);
}

export async function recordContribution(db, marks) {
  const stmts = Object.entries(marks)
    .filter(([id, call]) => byId.has(id) && call)
    .map(([id, call]) =>
      db
        .prepare(
          `INSERT INTO tally (task_id, call, count) VALUES (?, ?, 1)
           ON CONFLICT(task_id, call) DO UPDATE SET count = count + 1`
        )
        .bind(id, call)
    );
  if (stmts.length) await db.batch(stmts);
}

// Returns { [taskId]: { call, n } } for every id in taskIds. `n` is the total
// weight behind that task, seed included. Ties fall back to the seed call so
// the result is deterministic while real answers are still thin.
export async function readAverages(db, taskIds) {
  const ids = taskIds.filter((id) => byId.has(id));
  if (!ids.length) return {};

  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT task_id, call, count FROM tally WHERE task_id IN (${placeholders})`)
    .bind(...ids)
    .all();

  const byTask = new Map();
  for (const row of results) {
    const list = byTask.get(row.task_id) || [];
    list.push(row);
    byTask.set(row.task_id, list);
  }

  const out = {};
  for (const id of ids) {
    const rows = byTask.get(id) || [];
    const seedCall = byId.get(id).post;
    let best = null;
    let n = 0;
    for (const row of rows) {
      n += row.count;
      if (
        !best ||
        row.count > best.count ||
        (row.count === best.count && row.call === seedCall)
      ) {
        best = row;
      }
    }
    out[id] = { call: best ? best.call : seedCall, n };
  }
  return out;
}
