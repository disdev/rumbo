// Mentor dashboard (SPEC §7). Read-mostly: the only write is recording that a
// Sunday check-in happened. Replays the same derive() the student app uses,
// against the server's result log — one source of truth, one set of rules.

import { derive, dayKey, weekday, addDays } from '../src/js/derive.js';
import { generateProblem, FAMILY_IDS } from '../src/js/mathgen.js';

const app = document.getElementById('app');

const FAMILY_LABELS = {
  carga: 'Load factor', altimetro: 'Altimeter', nubes: 'Cloud base',
  altitudes: 'PA / DA', peso_balance: 'Weight & balance', tvd: 'Time-speed-dist',
};

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) n.append(c?.nodeType ? c : document.createTextNode(c ?? ''));
  return n;
}

async function boot() {
  const [config, chapters, bank, templates, progress] = await Promise.all([
    fetch('../data/config.json').then(r => r.json()),
    fetch('../data/chapters.json').then(r => r.json()),
    fetch('../data/bank.json').then(r => r.json()),
    fetch('../data/math-templates.json').then(r => r.json()),
    fetch('/api/progress').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]).catch(e => {
    app.replaceChildren(el('div', { class: 'card center' }, el('p', {}, `Could not load (${e.message}). Are you signed in as the mentor?`)));
    throw e;
  });

  const rows = (progress.results || []).map(r => ({
    ...r, detail: safeParse(r.detail_json),
  }));
  const today = dayKey(Date.now());
  const state = derive(rows, { config, chapters, bank }, today);
  render({ config, chapters, bank, templates, rows, state, aggregates: progress.aggregates, today });
}

const safeParse = (s) => { try { return JSON.parse(s) ?? {}; } catch { return {}; } };
const fmtTs = (ts) => new Date(ts).toLocaleString('en-US', { timeZone: 'America/Lima', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function checkinInfo(rows, today) {
  const checkins = rows.filter(r => r.detail?.type === 'checkin').map(r => dayKey(r.ts));
  let missed = 0;
  for (let k = today, seen = 0; seen < 3; k = addDays(k, -1)) {
    if (weekday(k) !== 0) continue;
    seen++;
    if (checkins.includes(k) || checkins.some(c => Math.abs((new Date(c) - new Date(k)) / 864e5) <= 1)) break;
    missed++;
  }
  return { checkins, missedConsecutive: missed };
}

function render(ctx) {
  const { config, chapters, bank, templates, rows, state, aggregates, today } = ctx;
  const nodes = [el('h1', {}, 'Progreso — Mentor')];

  // ---- last sync + red flags (SPEC §7, §8) ----
  const lastSync = aggregates?.last_sync_ts;
  const hoursSince = lastSync ? (Date.now() - lastSync) / 36e5 : Infinity;
  if (hoursSince > 30) {
    nodes.push(el('div', { class: 'stale' }, `⚠️ Last sync: ${lastSync ? fmtTs(lastSync) : 'never'} — the accountability loop may be down (expired session or offline).`));
  } else {
    nodes.push(el('p', { class: 'note' }, `Last sync: ${fmtTs(lastSync)}`));
  }
  const ck = checkinInfo(rows, today);
  if (ck.missedConsecutive >= 2) nodes.push(el('div', { class: 'stale' }, '🔴 Two consecutive Sunday check-ins missed.'));

  // ---- KPIs ----
  const s = state.streaks;
  nodes.push(el('div', { class: 'kpi-row' },
    kpi('Week', state.week),
    kpi('Day streak', s.overall, s.overall === 0),
    kpi('Math', s.math, s.math === 0),
    kpi('Regs', s.regla, s.regla === 0),
    kpi('Phraseo', s.fraseo, s.fraseo === 0),
    kpi('Error deck', state.errorDeck.length)));
  if (state.listo) nodes.push(el('div', { class: 'badge-listo' }, '🏅 READY-FOR-EXAM badge earned'));
  if (state.reanudacion || state.missedRun >= config.reanudacion.missed_days_trigger) {
    nodes.push(el('div', { class: 'stale' }, `⚠️ ${state.missedRun} consecutive study days missed — reanudación mode.`));
  }

  // ---- last 7 study days ----
  const days = [];
  for (let k = today, n = 0; n < 7; k = addDays(k, -1)) {
    if (!config.schedule.study_days.includes(weekday(k))) continue;
    n++;
    const cls = state.dayLog.get(k) || 'perdido';
    days.unshift(el('div', { class: `day ${cls}` }, `${k.slice(5)}`, el('br'), cls));
  }
  nodes.push(section('Last 7 study days', el('div', { class: 'days' }, ...days)));

  // ---- skipped blocks ----
  if (state.skips.length) {
    nodes.push(section('Skipped blocks (with reasons)', el('table', { class: 'plain' },
      el('tr', {}, el('th', {}, 'When'), el('th', {}, 'Block'), el('th', {}, 'Reason')),
      ...state.skips.slice(-15).reverse().map(r => el('tr', {},
        el('td', {}, fmtTs(r.ts)), el('td', {}, r.detail.type), el('td', {}, r.detail.reason))))));
  }

  // ---- math tracker ----
  nodes.push(section('Math ladder', el('div', { class: 'tracker' },
    ...FAMILY_IDS.map(f => {
      const L = state.ladder[f];
      const last = L?.attempts[L.attempts.length - 1];
      return el('div', { class: 'tracker-row' },
        el('span', { class: 'tracker-label' }, FAMILY_LABELS[f], last ? el('span', { class: 'meta' }, ` — last: ${last.score}/10 (${last.day})`) : ''),
        ...[1, 2, 3].map(t => el('span', { class: `cell ${t <= (L?.passedTier ?? 0) ? 'done' : ''}` }, String(t))));
    }))));

  // ---- chapter progress ----
  nodes.push(section('Chapters', el('table', { class: 'plain' },
    el('tr', {}, el('th', {}, 'Ch.'), el('th', {}, 'Read'), el('th', {}, 'Recall'), el('th', {}, 'Questions'), el('th', {}, 'Closed')),
    ...chapters.chapters.filter(c => c.week).map(c => {
      const cs = state.chapterState.get(c.id);
      const seenQ = cs?.latest.size || 0;
      const okQ = cs ? [...cs.latest.values()].filter(Boolean).length : 0;
      return el('tr', {},
        el('td', {}, `${c.id} — ${c.title} (w${c.week})`),
        el('td', {}, cs?.read ? '✅' : '—'),
        el('td', {}, cs?.recalled ? '✅' : '—'),
        el('td', {}, seenQ ? `${okQ}/${seenQ} (${Math.round(100 * okQ / seenQ)}%)` : '—'),
        el('td', {}, cs?.closedDay || '—'));
    }))));
  const zeroCov = chapters.chapters.filter(c => c.week && !c.categories.length);
  if (zeroCov.length) nodes.push(el('p', { class: 'note' }, `No bank coverage (probe these in teach-back): ${zeroCov.map(c => `ch. ${c.id} ${c.title}`).join(' · ')}`));

  // ---- free recall entries (Sunday audit material) ----
  nodes.push(section(`Free-recall entries (${state.recalls.length})`, ...state.recalls.slice(-10).reverse().map(r => {
    const fb = state.feedbackByEntry.get(r.id);
    const flags = fb?.flags ? Object.entries(fb.flags).filter(([, v]) => v).map(([k]) => k) : [];
    return el('div', { class: 'entry' },
      el('div', { class: 'meta' }, `${fmtTs(r.ts)} · ch. ${r.chapter} · ${r.detail.chars} chars`,
        ...flags.map(f => el('span', { class: 'flag' }, f))),
      el('pre', {}, r.detail.text || ''),
      fb?.missing?.length ? el('p', { class: 'missing' }, `AI: missing — ${fb.missing.join(' · ')}`) : '');
  })));

  // ---- scenarios + distractor explanations ----
  if (state.scenarios.length) nodes.push(section('Vuelo de escritorio answers', ...state.scenarios.slice(-6).reverse().map(r =>
    el('div', { class: 'entry' }, el('div', { class: 'meta' }, `${fmtTs(r.ts)} · ${r.detail.scenario_id}`), el('pre', {}, r.detail.text || '')))));
  if (state.distractorExplains.length) nodes.push(section(`Distractor explanations (${state.distractorExplains.length})`, ...state.distractorExplains.slice(-6).reverse().map(r =>
    el('div', { class: 'entry' }, el('div', { class: 'meta' }, fmtTs(r.ts)),
      el('pre', {}, (r.detail.explanations || []).map(x => `«${x.option}» → ${x.why}`).join('\n'))))));

  // ---- teach-back audio ----
  const audios = state.teachbacks.filter(t => t.detail.audio_id);
  if (audios.length) nodes.push(section('Teach-back recordings', ...audios.slice(-6).reverse().map(r =>
    el('div', { class: 'entry' },
      el('div', { class: 'meta' }, `${fmtTs(r.ts)} · ch. ${r.detail.chapter || '—'}`),
      el('audio', { controls: '', src: `/api/audio/${r.detail.audio_id}` })))));

  // ---- error deck + simulacros ----
  if (state.errorDeck.length) nodes.push(section(`Error deck (${state.errorDeck.length})`, el('table', { class: 'plain' },
    ...state.errorDeck.map(e => {
      if (e.type === 'math') return el('tr', {}, el('td', {}, `Math: ${FAMILY_LABELS[e.family]} tier ${e.tier}`));
      const q = bank.find(b => b.id === e.qid);
      return el('tr', {}, el('td', {}, q ? `${q.category}: ${q.question.slice(0, 90)}…` : e.qid));
    }))));
  if (state.simulacros.length) nodes.push(section('Simulacros', el('table', { class: 'plain' },
    el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Score'), el('th', {}, 'By category')),
    ...state.simulacros.map(sm => el('tr', {},
      el('td', {}, sm.day), el('td', {}, `${sm.pct}%${sm.deckEmptyBefore ? '' : ' (deck not empty)'}`),
      el('td', {}, Object.entries(sm.byCategory).map(([c, v]) => `${c.split(' ')[0]} ${Math.round(100 * v.ok / v.n)}%`).join(' · ')))))));

  // ---- live spot-check generator (§7) ----
  nodes.push(section('Sunday spot-check', spotCheck(state, templates)));

  // ---- Sunday checklist ----
  nodes.push(section('Sunday check-in protocol', el('div', { class: 'checklist-box' },
    el('ol', {},
      el('li', {}, 'Review registro & streaks (above).'),
      el('li', {}, 'Audit 2–3 free-recall entries — genuine recall, not transcription? Check AI flags.'),
      el('li', {}, 'Live math spot-check: generate 3 problems below, he solves them on camera/in person.'),
      el('li', {}, 'Teach-back: pick a concept (prefer zero-coverage chapters listed above).'),
      el('li', {}, 'Lightning round: 5 fraseología phrases.'),
      el('li', {}, 'Set next week; confirm phone alarms / calendar cues still exist (the app sends no notifications).')),
    el('button', { class: 'primary', onclick: recordCheckin }, 'Record check-in as done'))));

  app.replaceChildren(el('div', {}, ...nodes));

  async function recordCheckin() {
    const row = { id: crypto.randomUUID(), ts: Date.now(), kind: 'block', detail_json: JSON.stringify({ type: 'checkin' }) };
    const res = await fetch('/api/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
    alert(res.ok ? 'Check-in recorded.' : 'Failed to record.');
  }
}

function kpi(label, value, red = false) {
  return el('div', { class: `kpi ${red ? 'red' : ''}` }, el('b', {}, String(value)), label);
}

function section(title, ...content) {
  return el('details', { open: '' }, el('summary', {}, title), ...content);
}

function spotCheck(state, templates) {
  const box = el('div', {});
  const btn = el('button', { class: 'ghost', onclick: gen }, 'Generate 3 fresh problems (highest claimed tiers)');
  box.append(btn);
  function gen() {
    const claimed = FAMILY_IDS.map(f => ({ f, t: state.ladder[f]?.passedTier ?? 0 })).filter(x => x.t > 0)
      .sort((a, b) => b.t - a.t).slice(0, 3);
    const pool = claimed.length ? claimed : [{ f: 'carga', t: 1 }];
    const out = el('div', {});
    for (let i = 0; i < 3; i++) {
      const { f, t } = pool[i % pool.length];
      const p = generateProblem(templates, f, Math.max(1, t));
      const ans = el('span', { class: 'answer-hidden' }, ` ${p.answer} ${p.unit} — ${p.worked}`);
      out.append(el('div', { class: 'entry' },
        el('div', { class: 'meta' }, `${FAMILY_LABELS[f]} · tier ${Math.max(1, t)}`),
        el('p', {}, p.text),
        el('button', { class: 'skip', onclick: () => ans.classList.toggle('answer-hidden') }, 'toggle answer'), ans));
    }
    box.replaceChildren(btn, out);
  }
  return box;
}

boot();
