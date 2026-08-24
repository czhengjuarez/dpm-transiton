// DPM Transition Worksheet. Front end.
// No framework, no build. State lives in memory plus one localStorage key so a
// refresh mid-sort does not lose forty clicks.

const STORE = 'ofw.dpm-transition.v1';
const CONTRIBUTED_KEY = 'ofw.dpm-transition.contributed';
const THEME_KEY = 'ofw.dpm-transition.theme';

const state = {
  marks: {},
  data: null,
  result: null,
  tab: 'role',
};

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// ---------------------------------------------------------------- persistence

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ marks: state.marks }));
  } catch { /* private mode, ignore */ }
}
function restore() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function clearStore() {
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- theme

function currentTheme() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit) return explicit;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode, ignore */ }
  $('#btn-theme').setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

function initTheme() {
  setTheme(currentTheme());
  $('#btn-theme').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
}

// ---------------------------------------------------------------- boot

async function boot() {
  initTheme();

  const res = await fetch('/api/tasks');
  state.data = await res.json();

  renderLegend($('#legend'));
  renderLegend($('#legend2'));
  renderSources();

  $('#btn-start').addEventListener('click', () => start());

  $('#btn-home').addEventListener('click', () => show('mode'));
  $('#btn-back').addEventListener('click', () => show('mode'));
  $('#btn-restart').addEventListener('click', () => {
    if (!confirm('Clear every call and start over?')) return;
    state.marks = {}; state.result = null; clearStore(); show('mode');
  });
  $('#btn-analyse').addEventListener('click', analyse);
  $('#btn-export').addEventListener('click', exportMd);
  $('#tab-role').addEventListener('click', () => setTab('role'));
  $('#tab-person').addEventListener('click', () => setTab('person'));

  const prev = restore();
  if (prev && prev.marks && Object.keys(prev.marks).length) {
    state.marks = prev.marks;
    start(true);
  }
}

function renderLegend(host) {
  if (!host) return;
  host.innerHTML = '';
  for (const c of state.data.calls) {
    const row = el('div', 'legend-item');
    row.append(el('div', `legend-key k-${c.id}`, c.label));
    const right = el('div');
    right.append(el('div', 'legend-verb', c.verb));
    right.append(el('div', 'legend-hint', c.hint));
    row.append(right);
    host.append(row);
  }
}

function renderSources() {
  const host = $('#sources');
  host.innerHTML = '';
  for (const s of state.data.sources) {
    host.append(el('div', null, `${s.company} · ${s.role} · ${s.status}`));
  }
}

// ---------------------------------------------------------------- screens

function show(which) {
  $('#screen-mode').classList.toggle('hidden', which !== 'mode');
  $('#screen-sort').classList.toggle('hidden', which !== 'sort');
  $('#screen-result').classList.toggle('hidden', which !== 'result');
  $('#btn-restart').classList.toggle('hidden', which === 'mode');
  $('#btn-export').classList.toggle('hidden', which !== 'result');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function start(silent) {
  if (!silent) save();
  renderClusters();
  updateProgress();
  show('sort');
}

function renderClusters() {
  const host = $('#clusters');
  host.innerHTML = '';

  // Tolerate a browser still holding the previous shape of the cached
  // /api/tasks response (no `categories`): fall back to one flat group.
  const categories = state.data.categories && state.data.categories.length
    ? state.data.categories
    : [{ id: null, name: null }];

  const byCategory = new Map();
  for (const c of state.data.clusters) {
    const key = categories.some((cat) => cat.id === c.category) ? c.category : null;
    const list = byCategory.get(key) || [];
    list.push(c);
    byCategory.set(key, list);
  }

  for (const cat of categories) {
    const clusters = byCategory.get(cat.id);
    if (!clusters || !clusters.length) continue;

    const catSec = el('section', 'category');
    if (cat.name) catSec.append(el('h2', 'category-head', cat.name));
    host.append(catSec);

    for (const c of clusters) {
      const sec = el('section', 'cluster');
      const head = el('div', 'cluster-head');
      head.append(el('h3', null, c.name));
      head.append(el('div', 'cluster-note', c.note));
      sec.append(head);

      c.tasks.forEach(([text, source], i) => {
        const id = `${c.id}-${i}`;
        const avg = (state.data.averages && state.data.averages[id]) || { call: c.post, n: null };
        const row = el('div', 'task');
        row.append(el('div', 'task-text', text));
        row.append(el('div', 'task-meta', source));

        const calls = el('div', 'task-calls');
        for (const call of state.data.calls) {
          const b = el('button', 'call-btn', call.label);
          b.dataset.call = call.id;
          b.dataset.task = id;
          b.type = 'button';
          b.setAttribute('aria-pressed', state.marks[id] === call.id ? 'true' : 'false');
          b.setAttribute('aria-label', `${call.label}: ${text}`);
          b.addEventListener('click', () => mark(id, call.id, avg, row));
          calls.append(b);
        }
        row.append(calls);

        const take = el('div', 'post-take');
        take.dataset.for = id;
        row.append(take);
        if (state.marks[id]) paintTake(take, state.marks[id], avg);

        sec.append(row);
      });

      catSec.append(sec);
    }
  }
}

function mark(id, call, avg, row) {
  if (state.marks[id] === call) delete state.marks[id];
  else state.marks[id] = call;

  row.querySelectorAll('.call-btn').forEach((b) => {
    b.setAttribute('aria-pressed', state.marks[id] === b.dataset.call ? 'true' : 'false');
  });
  paintTake(row.querySelector('.post-take'), state.marks[id], avg);
  save();
  updateProgress();
}

const CALL_LABEL = { shift: 'Shift', automate: 'Automate', retire: 'Retire', evolve: 'Evolve', elevate: 'Elevate' };

function paintTake(node, call, avg) {
  if (!node) return;
  if (!call) { node.innerHTML = ''; return; }
  const n = avg.n != null ? ` <span class="post-n">(n=${avg.n})</span>` : '';
  if (call === avg.call) {
    node.innerHTML = `The average agrees. <b class="k-${avg.call}">${CALL_LABEL[avg.call]}</b>${n}`;
  } else {
    node.innerHTML = `The average says <b class="k-${avg.call}">${CALL_LABEL[avg.call]}</b>${n}. You know your org, so the disagreement is the interesting part.`;
  }
}

function updateProgress() {
  const total = state.data.count;
  const n = Object.keys(state.marks).length;
  $('#pfill').style.width = `${(n / total) * 100}%`;
  $('#pcount').textContent = `${n} / ${total}`;

  const counts = { shift: 0, automate: 0, retire: 0, evolve: 0, elevate: 0 };
  for (const v of Object.values(state.marks)) if (v in counts) counts[v]++;

  const tally = $('#tally');
  tally.innerHTML = '';
  for (const c of state.data.calls) {
    const chip = el('span', `tally-chip k-${c.id}`, `${c.label.slice(0, 3).toUpperCase()} ${counts[c.id]}`);
    chip.dataset.n = counts[c.id];
    tally.append(chip);
  }

  const ok = n >= 8;
  $('#btn-analyse').disabled = !ok;
  $('#dock-note').textContent = ok
    ? `${n} marked. More is better, but this is enough to read.`
    : `Mark at least eight before the result means anything. ${8 - n} to go.`;
}

// ---------------------------------------------------------------- analyse

async function analyse() {
  $('#btn-analyse').disabled = true;
  $('#btn-analyse').textContent = 'Working';

  let contributed = false;
  try { contributed = localStorage.getItem(CONTRIBUTED_KEY) === '1'; } catch { /* private mode, ignore */ }

  let payload;
  try {
    const res = await fetch('/api/advise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ marks: state.marks, contribute: !contributed }),
    });
    payload = await res.json();
    if (!contributed && payload.analysis && payload.analysis.marked >= 8) {
      try { localStorage.setItem(CONTRIBUTED_KEY, '1'); } catch { /* private mode, ignore */ }
    }
  } catch (e) {
    payload = { analysis: null, ai: null, aiError: 'network' };
  }

  $('#btn-analyse').disabled = false;
  $('#btn-analyse').textContent = 'See the plan';

  if (!payload.analysis) {
    alert('Could not reach the server. Your calls are saved, try again in a moment.');
    return;
  }

  state.result = payload;
  renderResult();
  show('result');
}

function renderResult() {
  const a = state.result.analysis;
  const ai = state.result.ai;

  // stats
  const stats = $('#stats');
  stats.innerHTML = '';
  const cards = [
    [`${a.pctLeaving}%`, 'Leaving the role'],
    [`${a.pctStaying}%`, 'Staying or growing'],
    [String(a.counts.elevate), 'Marked elevate'],
    [String(a.divergence.length), 'Where you disagreed with the average'],
  ];
  for (const [n, l] of cards) {
    const s = el('div', 'stat');
    s.append(el('div', 'stat-n', n));
    s.append(el('div', 'stat-l', l));
    stats.append(s);
  }

  // verdict
  const v = $('#verdict');
  v.innerHTML = '';
  v.append(el('h2', null, a.verdict.headline));
  v.append(el('p', null, a.verdict.body));

  renderRolePanel(a, ai);
  renderPersonPanel(a, ai);
  setTab('role');
}

function aiBlock(tag, title, text) {
  const b = el('details', 'ai-block');
  const summary = el('summary');
  summary.append(el('span', 'ai-tag', tag));
  summary.append(el('span', 'ai-block-title', title));
  b.append(summary);
  for (const para of String(text).split(/\n{2,}|\n/).map((s) => s.trim()).filter(Boolean)) {
    b.append(el('p', null, para));
  }
  return b;
}

function renderRolePanel(a, ai) {
  const p = $('#panel-role');
  p.innerHTML = '';

  const intro = el('p');
  intro.style.color = 'var(--of-fg-muted)';
  intro.style.maxWidth = '62ch';
  intro.textContent =
    'Sequenced by how much agreement each move needs. Retire needs nobody. Shifting work to a TPM needs a named counterpart and their manager. Do them in this order or the easy wins get held hostage by the hard ones.';
  p.append(intro);

  for (const s of a.sequence) {
    const step = el('details', 'step');
    const summary = el('summary');
    summary.append(el('span', 'step-when', s.when));
    summary.append(el('span', 'step-title', `${s.title} · ${s.items.length}`));
    step.append(summary);
    step.append(el('p', 'step-why', s.why));
    const ul = el('ul');
    for (const it of s.items) {
      const li = el('li');
      li.append(document.createTextNode(it.text + ' '));
      li.append(el('span', null, `[${it.source}]`));
      ul.append(li);
    }
    step.append(ul);
    const ask = el('div', 'step-ask');
    ask.append(el('b', null, 'The move'));
    ask.append(document.createTextNode(s.ask));
    step.append(ask);
    p.append(step);
  }

  if (ai && ai.read) p.append(aiBlock('Written for your result', 'What your answers say', ai.read));
  if (ai && ai.hardest) p.append(aiBlock('Written for your result', 'The move that will stall', ai.hardest));
  if (!ai) p.append(unavailable(state.result.aiError));

  if (a.divergence.length) {
    const d = el('details', 'diverge');
    const n = a.divergence.length;
    d.append(el('summary', null, `${n} ${n === 1 ? 'task' : 'tasks'} where you split from the average`));
    const note = el('p');
    note.style.cssText = 'color:var(--of-fg-muted);font-size:.875rem;margin:0 0 12px';
    note.textContent = 'This is the useful part. The average is everyone who has run this worksheet so far, starting from a single seed opinion. You have a specific org in front of you.';
    d.append(note);
    const scroller = el('div', 'scroller');
    const t = el('table');
    t.innerHTML = '<thead><tr><th>Task</th><th>You</th><th>Average</th></tr></thead>';
    const tb = el('tbody');
    for (const row of a.divergence) {
      const tr = el('tr');
      tr.append(el('td', null, row.text));
      const y = el('td'); y.append(el('code', `k-${row.you}`, CALL_LABEL[row.you])); tr.append(y);
      const o = el('td');
      o.append(el('code', `k-${row.average}`, CALL_LABEL[row.average]));
      if (row.n != null) o.append(el('span', 'post-n', ` n=${row.n}`));
      tr.append(o);
      tb.append(tr);
    }
    t.append(tb);
    scroller.append(t);
    d.append(scroller);
    p.append(d);
  }
}

function renderPersonPanel(a, ai) {
  const p = $('#panel-person');
  p.innerHTML = '';

  const intro = el('p');
  intro.style.color = 'var(--of-fg-muted)';
  intro.style.maxWidth = '62ch';
  intro.textContent =
    'Measured against the eight capabilities the post argues the role becomes. A gap is not a verdict, it is a list of what to go learn, or what to help someone else grow into, while there is still runway for it.';
  p.append(intro);

  const h = el('h3'); h.style.cssText = 'font-size:1.0625rem;margin:24px 0 8px';
  h.textContent = 'Capability coverage';
  p.append(h);

  const cov = el('div', 'coverage');
  const stateLabel = { gap: 'No investment', partial: 'Thin', covered: 'Invested' };
  for (const c of a.coverage) {
    const row = el('div', 'cov-row');
    row.dataset.state = c.state;
    row.append(el('div', 'cov-label', c.label));
    row.append(el('div', 'cov-state', `${stateLabel[c.state]} · ${c.invested}/${c.total}`));
    cov.append(row);
  }
  p.append(cov);

  // 30/60/90 built from the sequence
  const plan = el('div');
  const ph = el('h3'); ph.style.cssText = 'font-size:1.0625rem;margin:32px 0 8px';
  ph.textContent = 'The next ninety days';
  plan.append(ph);

  const bucket = (k) => a.buckets[k] || [];
  const windows = [
    ['Days 1 to 30', 'Stop producing what nobody reads and hand off what a tool does.', [...bucket('retire'), ...bucket('automate')]],
    ['Days 31 to 60', 'Start the handover conversations. One named counterpart per item, in writing.', bucket('shift')],
    ['Days 61 to 90', 'Take on the work the role is actually for, in the space the first sixty days made.', [...bucket('evolve'), ...bucket('elevate')]],
  ];
  for (const [when, why, items] of windows) {
    const step = el('details', 'step');
    const summary = el('summary');
    summary.append(el('span', 'step-when', when));
    summary.append(el('span', 'step-title', `${items.length} ${items.length === 1 ? 'item' : 'items'}`));
    step.append(summary);
    step.append(el('p', 'step-why', why));
    if (items.length) {
      const ul = el('ul');
      for (const it of items.slice(0, 8)) ul.append(el('li', null, it.text));
      if (items.length > 8) ul.append(el('li', null, `and ${items.length - 8} more`));
      step.append(ul);
    } else {
      step.append(el('p', 'step-why', 'Nothing marked for this window. That is a finding, not a blank.'));
    }
    plan.append(step);
  }
  p.append(plan);

  if (ai && ai.conversation) {
    p.append(aiBlock('Written for your result', 'Opening the conversation', ai.conversation));
  }
  if (ai && ai.blindspot) p.append(aiBlock('Written for your result', 'Go find this out', ai.blindspot));
  if (!ai) p.append(unavailable(state.result.aiError));

  const warn = el('div', 'step-ask');
  warn.style.marginTop = '24px';
  warn.append(el('b', null, 'Before this leaves your hands'));
  warn.append(document.createTextNode(
    'If you are handing these calls to someone else, they will work out what the exercise is. Say upfront whether a decision has already been made. If one has not, say that too, and mean it.'
  ));
  p.append(warn);
}

function unavailable(reason) {
  const b = el('div', 'ai-block');
  b.append(el('span', 'ai-tag', 'Written read unavailable'));
  const msg = reason === 'no-ai-binding'
    ? 'The model is not wired up on this deployment. Everything above is the rules engine, which is the part that matters.'
    : 'The written read did not come back this time. Everything above is the rules engine and it is complete on its own. Reload to try again.';
  b.append(el('p', null, msg));
  return b;
}

function setTab(which) {
  state.tab = which;
  $('#tab-role').setAttribute('aria-selected', which === 'role');
  $('#tab-person').setAttribute('aria-selected', which === 'person');
  $('#panel-role').classList.toggle('hidden', which !== 'role');
  $('#panel-person').classList.toggle('hidden', which !== 'person');
}

// ---------------------------------------------------------------- export

function exportMd() {
  const a = state.result.analysis;
  const ai = state.result.ai || {};
  const L = [];

  L.push('# DPM Transition Worksheet');
  L.push('');
  L.push(`Marked: ${a.marked} of ${a.total} tasks`);
  L.push('');
  L.push(`Leaving the role: ${a.pctLeaving}%. Staying or growing: ${a.pctStaying}%.`);
  L.push(`Shift ${a.counts.shift} · Automate ${a.counts.automate} · Retire ${a.counts.retire} · Evolve ${a.counts.evolve} · Elevate ${a.counts.elevate}`);
  L.push('');
  L.push(`## ${a.verdict.headline}`);
  L.push('');
  L.push(a.verdict.body);
  L.push('');
  L.push('## The role, redesigned');
  for (const s of a.sequence) {
    L.push('');
    L.push(`### ${s.when}. ${s.title}`);
    L.push('');
    L.push(s.why);
    L.push('');
    for (const it of s.items) L.push(`- ${it.text} [${it.source}]`);
    L.push('');
    L.push(`**The move.** ${s.ask}`);
  }

  if (a.divergence.length) {
    L.push('');
    L.push('## Where you disagreed with the average');
    L.push('');
    L.push('| Task | You | Average |');
    L.push('| --- | --- | --- |');
    for (const d of a.divergence) {
      const avg = d.n != null ? `${CALL_LABEL[d.average]} (n=${d.n})` : CALL_LABEL[d.average];
      L.push(`| ${d.text} | ${CALL_LABEL[d.you]} | ${avg} |`);
    }
  }

  L.push('');
  L.push('## Capability coverage');
  L.push('');
  for (const c of a.coverage) L.push(`- ${c.label}: ${c.state} (${c.invested}/${c.total})`);

  if (ai.read) { L.push(''); L.push('## What your answers say'); L.push(''); L.push(ai.read); }
  if (ai.hardest) { L.push(''); L.push('## The move that will stall'); L.push(''); L.push(ai.hardest); }
  if (ai.conversation) { L.push(''); L.push('## The conversation'); L.push(''); L.push(ai.conversation); }
  if (ai.blindspot) { L.push(''); L.push('## Go find this out'); L.push(''); L.push(ai.blindspot); }

  L.push('');
  L.push('---');
  L.push('');
  L.push('It counts tasks, not hours. Compare against the calendar for the same week.');
  L.push('');
  L.push('Companion to "Design roles are shifting. So should the DPM role." Ops Forward.');

  const md = L.join('\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement('a');
  a2.href = url;
  a2.download = 'dpm-transition.md';
  a2.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

boot();
