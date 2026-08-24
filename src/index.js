import { CLUSTERS, CATEGORIES, CALLS, TASKS, NEW_PROFILE, SOURCES } from './tasks.js';
import { analyse, buildPrompt, extractJson } from './advice.js';
import { ensureSeeded, recordContribution, readAverages } from './tally.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/tasks') {
      const allIds = TASKS.map((t) => t.id);
      const averages = await getAverages(env, allIds);
      return json(
        { clusters: CLUSTERS, categories: CATEGORIES, calls: CALLS, profile: NEW_PROFILE, sources: SOURCES, count: TASKS.length, averages },
        200,
        // Short cache: this reflects a live crowd tally, not a static inventory.
        { 'cache-control': 'public, max-age=120' }
      );
    }

    if (url.pathname === '/api/advise') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      return handleAdvise(request, env, ctx);
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, ai: Boolean(env.AI), model: env.MODEL || DEFAULT_MODEL, tasks: TASKS.length });
    }

    // Everything else is served by the static assets binding.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};

async function handleAdvise(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const marks = body && typeof body.marks === 'object' && body.marks ? body.marks : null;
  if (!marks) return json({ error: 'marks required' }, 400);
  if (Object.keys(marks).length > 200) return json({ error: 'too many marks' }, 400);

  const averages = await getAverages(env, Object.keys(marks));
  const analysis = analyse({ mode: body.mode, marks, averages });

  if (analysis.marked < 8) {
    return json({ analysis, ai: null, aiError: 'too-few-marks' });
  }

  // One tally contribution per browser, flagged client-side, so re-reading
  // your own result does not inflate the average you are being compared to.
  if (body.contribute === true && env.TALLY) {
    try {
      await recordContribution(env.TALLY, marks);
    } catch { /* tally is a nice-to-have, never block the result on it */ }
  }

  if (!env.AI) {
    return json({ analysis, ai: null, aiError: 'no-ai-binding' });
  }

  const { system, user } = buildPrompt(analysis);
  const model = env.MODEL || DEFAULT_MODEL;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const result = await env.AI.run(
      model,
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 1400,
        temperature: 0.6,
      },
      { signal: controller.signal }
    );

    clearTimeout(timer);

    const raw = typeof result === 'string' ? result : result?.response ?? '';
    const parsed = extractJson(raw);

    if (!parsed) return json({ analysis, ai: null, aiError: 'unparseable' });

    // Enforce the no-em-dash rule at the boundary rather than trusting the model.
    const clean = {};
    for (const k of ['read', 'hardest', 'conversation', 'blindspot']) {
      if (typeof parsed[k] === 'string') {
        clean[k] = parsed[k].replace(/\s*[—–]\s*/g, '. ').replace(/\.\s*\./g, '.').trim();
      }
    }

    return json({ analysis, ai: clean, model });
  } catch (err) {
    return json({ analysis, ai: null, aiError: String(err && err.message ? err.message : err) });
  }
}

// Falls back to {} (which makes advice.js use each task's static seed
// position) when there is no TALLY binding, e.g. a preview build.
async function getAverages(env, taskIds) {
  if (!env.TALLY || !taskIds.length) return {};
  try {
    await ensureSeeded(env.TALLY, taskIds);
    return await readAverages(env.TALLY, taskIds);
  } catch {
    return {};
  }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extra },
  });
}
