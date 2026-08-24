// Rules engine + prompt construction.
//
// The rules engine is the product. It runs with no network, no model, no
// account, and it is what the reader sees first. The model call adds a
// paragraph of situated reasoning on top. If the model is slow, rate limited,
// or absent, the page is still complete and correct.

import { CLUSTERS, TASKS, NEW_PROFILE } from './tasks.js';

const LEAVING = new Set(['shift', 'automate', 'retire']);
const STAYING = new Set(['evolve', 'elevate']);

const byId = new Map(TASKS.map((t) => [t.id, t]));

/**
 * @param {{mode:'leader'|'dpm', marks:Record<string,string>, averages?:Record<string,{call:string,n:number}>}} input
 */
export function analyse(input) {
  const marks = input.marks || {};
  const averages = input.averages || null;
  const entries = Object.entries(marks).filter(([id, call]) => byId.has(id) && call);

  // Falls back to the author's seed position when no live tally is available
  // (no D1 binding, e.g. a preview env), so the page stays correct either way.
  const averageOf = (task) => (averages && averages[task.id] ? averages[task.id].call : task.post);
  const nOf = (task) => (averages && averages[task.id] ? averages[task.id].n : null);

  const counts = { shift: 0, automate: 0, retire: 0, evolve: 0, elevate: 0 };
  const buckets = { shift: [], automate: [], retire: [], evolve: [], elevate: [] };

  for (const [id, call] of entries) {
    if (!(call in counts)) continue;
    counts[call] += 1;
    buckets[call].push(byId.get(id));
  }

  const marked = entries.length;
  const leaving = counts.shift + counts.automate + counts.retire;
  const staying = counts.evolve + counts.elevate;
  const pct = (n) => (marked ? Math.round((n / marked) * 100) : 0);

  // Where the reader and the crowd average disagree. This is the interesting output.
  const divergence = entries
    .map(([id, call]) => ({ task: byId.get(id), call }))
    .filter(({ task, call }) => averageOf(task) !== call)
    .map(({ task, call }) => ({
      id: task.id,
      text: task.text,
      cluster: task.clusterName,
      you: call,
      average: averageOf(task),
      n: nOf(task),
    }));

  // Cluster-level rollup: which clusters are fully leaving, which are contested.
  const clusterRollup = CLUSTERS.map((c) => {
    const own = TASKS.filter((t) => t.cluster === c.id);
    const calls = own.map((t) => marks[t.id]).filter(Boolean);
    if (!calls.length) return null;
    const allLeaving = calls.every((x) => LEAVING.has(x));
    const allStaying = calls.every((x) => STAYING.has(x));
    return {
      id: c.id,
      name: c.name,
      post: c.post,
      marked: calls.length,
      total: own.length,
      state: allLeaving ? 'leaving' : allStaying ? 'staying' : 'split',
    };
  }).filter(Boolean);

  // Capability coverage against the eight-item profile the post argues for.
  const coverage = NEW_PROFILE.map((p) => {
    const relevant = TASKS.filter((t) => p.clusters.includes(t.cluster));
    const invested = relevant.filter((t) => STAYING.has(marks[t.id])).length;
    const total = relevant.length;
    return {
      id: p.id,
      label: p.label,
      invested,
      total,
      state: invested === 0 ? 'gap' : invested / total < 0.5 ? 'partial' : 'covered',
    };
  });

  const gaps = coverage.filter((c) => c.state === 'gap');
  const partial = coverage.filter((c) => c.state === 'partial');

  return {
    mode: input.mode === 'dpm' ? 'dpm' : 'leader',
    marked,
    total: TASKS.length,
    counts,
    buckets,
    leaving,
    staying,
    pctLeaving: pct(leaving),
    pctStaying: pct(staying),
    pctElevate: pct(counts.elevate),
    divergence,
    clusterRollup,
    coverage,
    gaps,
    partial,
    verdict: verdict(pct(leaving), pct(counts.elevate), marked),
    sequence: sequence(buckets),
  };
}

function verdict(pctLeaving, pctElevate, marked) {
  if (marked < 8) {
    return {
      key: 'thin',
      headline: 'Not enough marked yet',
      body: 'Mark at least eight tasks before reading anything into the result. Fewer than that and you are looking at your mood, not your org.',
    };
  }
  if (pctLeaving >= 70) {
    return {
      key: 'hollow',
      headline: 'The role as written has hollowed out',
      body: `You marked ${pctLeaving}% of the work as shifting, automating, or retiring. What is left is not a job description, it is a queue. This is the case where a leader should stop backfilling the title and spend the headcount on a capability the org actually lacks. It is also the case where the person currently holding the title needs a real conversation, quickly, because the ground is moving under them whether or not anyone says so.`,
    };
  }
  if (pctElevate >= 40) {
    return {
      key: 'strategic',
      headline: 'This is already a strategic operations role',
      body: `${pctElevate}% of what you marked is work you want more of, not less. The automation conversation is a distraction here. The useful move is protecting that share, which almost always means taking file structure, meeting scheduling, and status reporting off the person rather than adding to them.`,
    };
  }
  if (pctLeaving >= 40) {
    return {
      key: 'transition',
      headline: 'The role is mid-transition',
      body: `${pctLeaving}% is leaving and ${100 - pctLeaving}% is staying or growing. That is a design problem, not a hiring problem. You have enough remaining work to justify a role and enough departing work that the job description is now wrong. Rewrite the role before you next open the req.`,
    };
  }
  return {
    key: 'intact',
    headline: 'The bundle still holds here',
    body: `Only ${pctLeaving}% of what you marked is leaving. That is a real answer and it is allowed. Stable roadmaps, heavy documentation or regulatory load, genuinely complex multi-team dependencies, or no TPM function to absorb the work. If that is your situation, do not let an AI argument talk you out of a role that is working.`,
  };
}

function sequence(buckets) {
  const steps = [];
  if (buckets.retire.length) {
    steps.push({
      key: 'retire',
      when: 'This week',
      title: 'Stop producing these',
      why: 'No negotiation, no counterpart, no budget. Retire is the only call that costs nothing to act on, so it is the only one you can do before anyone agrees with you.',
      items: buckets.retire,
      ask: 'Announce the stop, name a date, and see who complains. Nobody complaining is the confirmation.',
    });
  }
  if (buckets.automate.length) {
    steps.push({
      key: 'automate',
      when: 'This month',
      title: 'Move these to a tool',
      why: 'Inside your control, and the failure mode is recoverable. Verify each one end to end before you count the time back. Measured trials keep finding that people overestimate how much time automation saved them.',
      items: buckets.automate,
      ask: 'Pick the noisiest one, run it for two weeks in parallel with the manual version, then cut over or admit it did not work.',
    });
  }
  if (buckets.shift.length) {
    steps.push({
      key: 'shift',
      when: 'Next planning cycle',
      title: 'Negotiate these across',
      why: 'This is the slow part, because it needs a named counterpart and their manager to agree. It is also where most of the bundle actually goes.',
      items: buckets.shift,
      ask: 'You need one named TPM or program counterpart per item, not a general agreement that TPMs could help. Get the name written down.',
    });
  }
  if (buckets.evolve.length) {
    steps.push({
      key: 'evolve',
      when: 'Rewrite the role',
      title: 'These change shape',
      why: 'The work survives and the description of it does not. Usually the shift is from administering something to deciding something.',
      items: buckets.evolve,
      ask: 'Write the new sentence for each one. If you cannot, it is not evolving, it is shifting or retiring and you are being polite about it.',
    });
  }
  if (buckets.elevate.length) {
    steps.push({
      key: 'elevate',
      when: 'Protect and fund',
      title: 'This is the role',
      why: 'Context, judgment, and standing in the room. The part that gets quietly crowded out by everything above it, which is the actual reason to do the rest of this exercise.',
      items: buckets.elevate,
      ask: 'Put these in the job description first and let the rest fill in behind them.',
    });
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Model layer
// ---------------------------------------------------------------------------

const SYSTEM = `You are advising on a design operations role transition. You are grounded in one specific argument, which you should apply rather than restate:

Design program management is a bundle of work that used to travel together, and the bundle has come apart. Coordination, intake, ritual facilitation and risk escalation can usually move to a TPM or another program function. Documentation and tool administration are increasingly automated. Status artifacts often disappear entirely. Vendor and budget work survives but changes from administration to resource decisions. Quality stewardship, resourcing judgment, workflow improvement, and AI enablement become more valuable. The traditional DPM role made the design org run smoothly. The evolving role should make the wider organization better at working with design.

WRITING RULES, these are strict:
- Never use an em dash. Start a new sentence or use a comma.
- Short paragraphs, one to three sentences.
- No bullet lists in your output. The page already has lists. You write prose.
- Plain words. No "leverage" as a verb, "unlock", "journey", "landscape", "robust", "seamless", "empower", "at the end of the day".
- Do not open with "Based on your results" or any restatement of the input.
- Do not flatter the reader or praise their answers.
- Concrete over abstract. Name the actual clusters they marked.
- Say the uncomfortable thing if the data supports it.
- If the reader disagreed with what other respondents landed on, engage with their reasoning as possibly correct, especially where the sample behind that average is still small. They know their org and you do not.

Return ONLY valid JSON matching the requested shape. No preamble, no code fence.`;

export function buildPrompt(a) {
  const top = (bucket, n = 4) =>
    (a.buckets[bucket] || []).slice(0, n).map((t) => `${t.clusterName}: ${t.text}`).join('; ') || 'none';

  const disagreements = a.divergence.length
    ? a.divergence
        .slice(0, 6)
        .map((d) => `"${d.text}" (they said ${d.you}, other respondents landed on ${d.average}${d.n != null ? `, n=${d.n}` : ''})`)
        .join('; ')
    : 'none, they matched the crowd average on every task';

  const gapList = a.gaps.length ? a.gaps.map((g) => g.label).join('; ') : 'none';
  const partialList = a.partial.length ? a.partial.map((g) => g.label).join('; ') : 'none';

  const audience =
    a.mode === 'dpm'
      ? 'The reader IS the design program manager, running this on their own role. Write to them directly as "you". They are deciding what to stop doing and what to argue for. Be useful to someone whose job security is genuinely in question, without either reassuring them falsely or catastrophising.'
      : 'The reader is a design leader who owns this role and may own the person in it. Write to them as "you". They are deciding how to redesign the role, and separately how to help a real person through the change. Never let them treat the second part as an afterthought.';

  const user = `${audience}

They sorted ${a.marked} of ${a.total} tasks drawn from eight real Design Program Manager job postings.

Their calls: shift to a TPM or other function ${a.counts.shift}, automate ${a.counts.automate}, retire ${a.counts.retire}, evolve ${a.counts.evolve}, elevate ${a.counts.elevate}. That is ${a.pctLeaving}% leaving the role and ${a.pctStaying}% staying or growing.

Marked to shift: ${top('shift')}
Marked to automate: ${top('automate')}
Marked to retire: ${top('retire')}
Marked to elevate: ${top('elevate')}

Where they disagreed with what other respondents landed on: ${disagreements}

Capability gaps against the evolving profile, meaning they invested nothing in these areas: ${gapList}
Thin coverage: ${partialList}

Return JSON with exactly these keys:
{
  "read": "Two or three paragraphs. What their pattern of answers actually says about this org and this role. Name specific clusters. If their answers are internally inconsistent, say so.",
  "hardest": "One paragraph. The single hardest move on their list and why it will stall. Be specific about who will resist and what they will say.",
  "conversation": "Two paragraphs. ${a.mode === 'dpm' ? 'How to open the conversation with their manager about changing the shape of their job, including one sentence they could actually say out loud.' : 'How to open the conversation with the person in this role. Include one sentence they could actually say out loud. Assume the person has worked out what the exercise is.'}",
  "blindspot": "One paragraph. What this worksheet did not ask that they should go find out. It counts tasks, not hours, and that is a real limitation."
}`;

  return { system: SYSTEM, user };
}

export function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}
