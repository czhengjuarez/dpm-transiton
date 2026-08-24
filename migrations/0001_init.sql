-- Crowd tally for the divergence table. One row per (task, call), incremented
-- as readers submit. Seeded lazily from the author's original per-cluster
-- position in src/tasks.js, see src/tally.js. That seed is the only opinion
-- that exists until real answers accumulate and dilute it.
CREATE TABLE tally (
  task_id TEXT NOT NULL,
  call TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, call)
);
