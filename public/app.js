// DPM Transition Worksheet. Front end.
// No framework, no build. State lives in memory plus one localStorage key so a
// refresh mid-sort does not lose forty clicks.

const STORE = 'ofw.dpm-transition.v1';

const state = {
  mode: null,
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
    localStorage.setItem(STORE, JSON.stringify({ mode: state.mode, marks: state.marks }));
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

// ---------------------------------------------------------------- boot

async function boot() {
  const res = await fetch('/api/tasks');
  state.data = await res.json();

  renderLegend($('#legend'));
  renderLegend($('#legend2'));
  renderSources();

  document.querySelectorAll('.mode-card').forEach((b) => {
    b.addEventListener('click', () => start(b.dataset.mode));
  });

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
  if (prev && prev.mode && prev.marks && Object.keys(prev.marks).length) {
    state.mode = prev.mode;
    state.marks = prev.marks;
    start(prev.mode, true);
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

const LEDE = {
  leader:
    'Mark each task the way it actually is in your org today, not the way the job description says. You are the one who can move any of it, so the honest answer is the useful one.',
  dpm:
    'Mark each task the way you actually spend the week, not the way your job description reads. The result is only as good as your willingness to mark something you do as retire.',
};

function start(mode, silent) {
  state.mode = mode;
  if (!silent) save();
  $('#sort-mode-label').textContent = mode === 'dpm' ? 'DPM mode' : 'Leader mode';
  $('#sort-title').textContent = mode === 'dpm' ? 'Sort your own week' : 'Sort the work';
  $('#sort-lede').textContent = LEDE[mode];
  renderClusters();
  updateProgress();
  show('sort');
}

function renderClusters() {
  const host = $('#clusters');
  host.innerHTML = '';

  for (const c of state.data.clusters) {
    const sec = el('section', 'cluster');
    const head = el('div', 'cluster-head');
    head.append(el('h3', null, c.name));
    head.append(el('div', 'cluster-note', c.note));
    sec.append(head);

    c.tasks.forEach(([text, source], i) => {
      const id = `${c.id}-${i}`;
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
        b.addEventListener('click', () => mark(id, call.id, c.post, row));
        calls.append(b);
      }
      row.append(calls);

      const take = el('div', 'post-take');
      take.dataset.for = id;
      row.append(take);
      if (state.marks[id]) paintTake(take, state.marks[id], c.post);

      sec.append(row);
    });

    host.append(sec);
  }
}

function mark(id, call, post, row) {
  if (state.marks[id] === call) delete state.marks[id];
  else state.marks[id] = call;

  row.querySelectorAll('.call-btn').forEach((b) => {
    b.setAttribute('aria-pressed', state.marks[id] === b.dataset.call ? 'true' : 'false');
  });
  paintTake(row.querySelector('.post-take'), state.marks[id], post);
  save();
  updateProgress();
}

const CALL_LABEL = { shift: 'Shift', automate: 'Automate', retire: 'Retire', evolve: 'Evolve', elevate: 'Elevate' };

function paintTake(node, call, post) {
  if (!node) return;
  if (!call) { node.innerHTML = ''; return; }
  if (call === post) {
    node.innerHTML = `The post agrees. <b class="k-${post}">${CALL_LABEL[post]}</b>`;
  } else {
    node.innerHTML = `The post says <b class="k-${post}">${CALL_LABEL[post]}</b>. You know your org, so the disagreement is the interesting part.`;
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

  let payload;
  try {
    const res = await fetch('/api/advise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: state.mode, marks: state.marks }),
    });
    payload = await res.json();
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

  $('#result-mode-label').textContent = a.mode === 'dpm' ? 'DPM mode' : 'Leader mode';

  // stats
  const stats = $('#stats');
  stats.innerHTML = '';
  const cards = [
    [`${a.pctLeaving}%`, 'Leaving the role'],
    [`${a.pctStaying}%`, 'Staying or growing'],
    [String(a.counts.elevate), 'Marked elevate'],
    [String(a.divergence.length), 'Where you disagreed with the post'],
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
  setTab(a.mode === 'dpm' ? 'person' : 'role');
}

function aiBlock(tag, title, text) {
  const b = el('div', 'ai-block');
  b.append(el('span', 'ai-tag', tag));
  b.append(el('h3', null, title));
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
    const step = el('div', 'step');
    step.dataset.key = s.key;
    step.append(el('div', 'step-when', s.when));
    step.append(el('h3', null, `${s.title} · ${s.items.length}`));
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
    const d = el('div', 'diverge');
    d.append(el('h3', null, `You disagreed with the post on ${a.divergence.length} ${a.divergence.length === 1 ? 'task' : 'tasks'}`));
    const note = el('p');
    note.style.cssText = 'color:var(--of-fg-muted);font-size:.875rem;margin:0 0 12px';
    note.textContent = 'This is the useful part. The post is one practitioner making a general argument. You have a specific org in front of you.';
    d.append(note);
    const scroller = el('div', 'scroller');
    const t = el('table');
    t.innerHTML = '<thead><tr><th>Task</th><th>You</th><th>The post</th></tr></thead>';
    const tb = el('tbody');
    for (const row of a.divergence) {
      const tr = el('tr');
      tr.append(el('td', null, row.text));
      const y = el('td'); y.append(el('code', `k-${row.you}`, CALL_LABEL[row.you])); tr.append(y);
      const o = el('td'); o.append(el('code', `k-${row.post}`, CALL_LABEL[row.post])); tr.append(o);
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
    a.mode === 'dpm'
      ? 'Measured against the eight capabilities the post argues the role becomes. A gap is not a verdict, it is a list of what to go learn while you still have the runway to learn it.'
      : 'Measured against the eight capabilities the post argues the role becomes. Where you invested nothing, you are asking the person to grow into something the job is not currently letting them practise.';
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
  ph.textContent = a.mode === 'dpm' ? 'Your next ninety days' : 'Their next ninety days';
  plan.append(ph);

  const who = a.mode === 'dpm' ? 'You' : 'They';
  const bucket = (k) => a.buckets[k] || [];
  const windows = [
    ['Days 1 to 30', `${who} stop producing what nobody reads and hand off what a tool does.`, [...bucket('retire'), ...bucket('automate')]],
    ['Days 31 to 60', `${who} start the handover conversations. One named counterpart per item, in writing.`, bucket('shift')],
    ['Days 61 to 90', `${who} take on the work the role is actually for, in the space the first sixty days made.`, [...bucket('evolve'), ...bucket('elevate')]],
  ];
  for (const [when, why, items] of windows) {
    const step = el('div', 'step');
    step.dataset.key = when.includes('1 to 30') ? 'retire' : when.includes('31') ? 'shift' : 'elevate';
    step.append(el('div', 'step-when', when));
    step.append(el('h3', null, `${items.length} ${items.length === 1 ? 'item' : 'items'}`));
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
    p.append(aiBlock('Written for your result', a.mode === 'dpm' ? 'Opening it with your manager' : 'Opening it with them', ai.conversation));
  }
  if (ai && ai.blindspot) p.append(aiBlock('Written for your result', 'Go find this out', ai.blindspot));
  if (!ai) p.append(unavailable(state.result.aiError));

  if (a.mode === 'leader') {
    const warn = el('div', 'step-ask');
    warn.style.marginTop = '24px';
    warn.append(el('b', null, 'Before you run this with them'));
    warn.append(document.createTextNode(
      'Somebody asked to help sort their own responsibilities into automate and retire will work out what the exercise is. If a decision has already been made, say so before you start. If one has not, say that too, and mean it.'
    ));
    p.append(warn);
  }
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
  L.push(`Mode: ${a.mode === 'dpm' ? 'DPM, run on own role' : 'Leader, run on a role they own'}`);
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
    L.push('## Where you disagreed with the post');
    L.push('');
    L.push('| Task | You | The post |');
    L.push('| --- | --- | --- |');
    for (const d of a.divergence) L.push(`| ${d.text} | ${CALL_LABEL[d.you]} | ${CALL_LABEL[d.post]} |`);
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
