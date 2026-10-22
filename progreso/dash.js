// Mentor dashboard (SPEC §7). Read-mostly: the only write is recording that a
// Sunday check-in happened. Replays the same derive() the student app uses,
// against the server's result log — one source of truth, one set of rules.

import { derive, dayKey, weekday, addDays } from '../src/js/derive.js';
import { generateProblem, FAMILY_IDS } from '../src/js/mathgen.js';
import { earnedBadges } from '../src/js/badges.js';
import { buildTimeline, lastSeen } from '../src/js/timeline.js';
import { missionReport } from '../src/js/misiones-logic.js';

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
  const [config, chapters, bank, templates, progress, misiones] = await Promise.all([
    fetch('../data/config.json').then(r => r.json()),
    fetch('../data/chapters.json').then(r => r.json()),
    fetch('../data/bank.json').then(r => r.json()),
    fetch('../data/math-templates.json').then(r => r.json()),
    fetch('/api/progress').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('../data/misiones.json').then(r => r.json()).catch(() => null),
  ]).catch(e => {
    app.replaceChildren(el('div', { class: 'card center' }, el('p', {}, `Could not load (${e.message}). Are you signed in as the mentor?`)));
    throw e;
  });

  const rows = (progress.results || []).map(r => ({
    ...r, detail: safeParse(r.detail_json),
  }));
  const today = dayKey(Date.now());
  const state = derive(rows, { config, chapters, bank }, today);
  render({ config, chapters, bank, templates, rows, state, aggregates: progress.aggregates, today, misiones });
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
  const { config, chapters, bank, templates, rows, state, aggregates, today, misiones } = ctx;
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

  // ---- last seen (spec 2026-07-06): the client flushes every 90s → near-live ----
  const seen = lastSeen(rows);
  if (seen) {
    const mins = Math.round((Date.now() - seen.ts) / 60_000);
    const ago = mins < 2 ? 'just now' : mins < 60 ? `${mins} min ago` : fmtTs(seen.ts);
    nodes.push(el('p', { class: 'note' }, `👁️ Last seen: ${ago} — ${seen.label}`));
  }

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
  const lastRowByDay = new Map();
  for (const r of rows) {
    const d = dayKey(r.ts);
    if (!lastRowByDay.has(d) || r.ts > lastRowByDay.get(d)) lastRowByDay.set(d, r.ts);
  }
  const limaHHMM = (ts) => new Date(ts - 5 * 3600e3).toISOString().slice(11, 16);
  const plannedEnd = config.schedule.sessions[config.schedule.sessions.length - 1]?.end || '18:00';
  const days = [];
  for (let k = today, n = 0; n < 7; k = addDays(k, -1)) {
    if (!config.schedule.study_days.includes(weekday(k))) continue;
    n++;
    const cls = state.dayLog.get(k) || 'perdido';
    // sin límite duro (§4.4): pasarse de la hora se ve, no se corta
    const last = lastRowByDay.get(k);
    const ranLate = last && limaHHMM(last) > plannedEnd;
    days.unshift(el('div', { class: `day ${cls}` }, `${k.slice(5)}`, el('br'), cls, ranLate ? el('span', { class: 'meta' }, el('br'), `→${limaHHMM(last)}`) : ''));
  }
  nodes.push(section('Last 7 study days', el('div', { class: 'days' }, ...days),
    el('p', { class: 'note' }, `Times are anchors, not limits — a "→HH:MM" marks a day he kept going past ${plannedEnd} (pacing signal for the check-in, never a problem).`)));

  // ---- activity timeline (spec 2026-07-06): days → sessions → entries ----
  const tl = buildTimeline(rows).slice(0, 7);
  const fmtHM = (ts) => new Date(ts).toLocaleTimeString('en-US', { timeZone: 'America/Lima', hour: 'numeric', minute: '2-digit' });
  if (tl.length) {
    nodes.push(section('Activity timeline (last 7 active days)', ...tl.map(d =>
      el('div', { class: 'entry' },
        el('div', { class: 'meta' }, el('b', {}, d.day)),
        ...d.sessions.map(s => [
          el('div', { class: 'meta' }, `— ${fmtHM(s.start)}–${fmtHM(s.end)} · ${s.minutes} min`),
          el('table', { class: 'plain' }, ...s.entries.map(e => el('tr', {},
            el('td', {}, fmtHM(e.ts)),
            el('td', {}, `${e.icon} ${e.label}${e.abandoned ? '  ⚠️ opened but never finished' : ''}`)))),
        ]).flat())),
      el('p', { class: 'note' }, 'Sessions split at 25 min of inactivity. 👁️ rows are navigation (opened, not necessarily worked); ⚠️ marks a lesson section he entered but never completed.')));
  }

  // ---- Vuelo en ruta missions (spec 2026-10-22): every step, every attempt ----
  if (misiones) nodes.push(missionsSection(rows, misiones));

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
      const reps = state.mathReps[f];
      return el('div', { class: 'tracker-row' },
        el('span', { class: 'tracker-label' }, FAMILY_LABELS[f],
          last ? el('span', { class: 'meta' }, ` — last: ${last.score}/10 (${last.day})`) : '',
          reps ? el('span', { class: 'meta' }, ` · ${reps.lifetime} reps, streak ${reps.streak}`) : ''),
        ...[1, 2, 3].map(t => el('span', { class: `cell ${t <= (L?.passedTier ?? 0) ? 'done' : ''}` }, String(t))));
    })),
    state.mathMaintenanceDue.length ? el('p', { class: 'note' }, `Maintenance due: ${state.mathMaintenanceDue.map(m => `${FAMILY_LABELS[m.family]} t${m.tier}`).join(' · ')}`) : ''));

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

  // ---- lessons (§5.8): where understanding breaks DURING teaching ----
  nodes.push(section('Lessons', el('table', { class: 'plain' },
    el('tr', {}, el('th', {}, 'Ch.'), el('th', {}, 'Sections'), el('th', {}, 'Time'), el('th', {}, 'Checks'), el('th', {}, 'Notebook')),
    ...chapters.chapters.filter(c => c.week).map(c => {
      const L = state.lessons.get(c.id);
      const total = c.sections?.length || 0;
      const secs = L ? [...L.secondsBySection.values()].reduce((a, b) => a + b, 0) : 0;
      const checkPct = L?.checks.n ? Math.round(100 * L.checks.ok / L.checks.n) : null;
      return el('tr', {},
        el('td', {}, `${c.id} — ${c.title}`),
        el('td', {}, L ? `${L.sectionsSeen.size}/${total || '?'}${L.completed ? ' ✅' : ''}` : '—'),
        el('td', {}, secs ? `${Math.round(secs / 60)} min` : '—'),
        el('td', {}, checkPct === null ? '—' : `${L.checks.ok}/${L.checks.n} (${checkPct}%)${checkPct < 70 ? ' ⚠️' : ''}`),
        el('td', {}, L?.notebooks.size ? `${L.notebooks.size} ✍️` : '—'));
    })),
    el('p', { class: 'note' }, 'Low check % = understanding breaking during teaching, before recall/questions confirm it. Notebook column = prompts he marked done — audit the physical cuaderno against it on Sunday.')));

  // ---- badges (§5.9) ----
  const badges = earnedBadges(state);
  if (badges.length) nodes.push(section(`Badges (${badges.length})`,
    el('div', { class: 'entry' }, badges.map(b => `${b.emoji} ${b.title}`).join(' · '))));

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

const mmss = (sec) => `${Math.floor((sec || 0) / 60)}:${String(Math.round(sec || 0) % 60).padStart(2, '0')}`;
const pct = ({ n, ok }) => (n ? `${ok}/${n} (${Math.round(100 * ok / n)}%)` : '—');

/** One attempt → readable English, from the answer shape the step kind logs. */
function attemptText(step, a) {
  const ans = a.answer || {};
  const signed = (v, u) => `${v > 0 ? '+' : ''}${v}${u}`;
  if (step.kind === 'number') {
    const unit = step.unit === 'deg' ? '°' : step.unit === 'nm' ? ' NM' : ' ft';
    const v = step.unit === 'deg' ? String(Math.round(ans.value)).padStart(3, '0') : ans.value;
    return `${v}${unit}${a.off_by ? ` (off ${signed(a.off_by, unit)})` : ''}`;
  }
  if (step.kind === 'place') return `dropped plane ${a.off_by} NM from target (${ans.lat?.toFixed(3)}, ${ans.lon?.toFixed(3)})`;
  if (step.kind === 'tap') return `tapped ${ans.feature}`;
  if (step.kind === 'choice') return `chose “${step.options?.[ans.option] ?? ans.option}”`;
  return JSON.stringify(ans);
}

function missionsSection(rows, misiones) {
  const report = missionReport(rows, misiones.missions);
  const byId = Object.fromEntries(misiones.missions.map(m => [m.id, m]));
  const detail = el('div', { class: 'mis-detail' });
  const blocks = report.missions.map(r => {
    const m = byId[r.id];
    if (!m.live) return el('div', { class: 'mis-row soon' }, el('b', {}, `M${m.n} · ${m.title}`), ' — not built yet');
    const status = { done: '✅ done', in_progress: '⏳ in progress', not_started: '○ not started' }[r.status];
    const head = el('div', { class: 'meta' },
      `${status} · ${mmss(r.seconds)} total`,
      r.prueba ? ` · prueba ${r.prueba.score}/${r.prueba.total}` : '',
      r.status === 'done' ? ` · first-attempt accuracy on its ${m.questions.length} bank questions: before ${pct(r.accuracy.before)} → after ${pct(r.accuracy.after)}` : '');
    const cells = r.steps.map((st, i) => {
      const step = m.steps[i];
      const mark = st.status !== 'done' ? '' : st.revealed ? '↺' : st.first_try_correct ? '✓' : '✗';
      return el('button', {
        class: `mis-cell ${st.status}`, title: `${st.id} · ${st.title}`,
        onclick: () => detail.replaceChildren(
          el('h4', {}, `M${m.n} · step ${i + 1} — ${st.title}`),
          el('p', { class: 'meta' }, `${st.status} · ${mmss(st.seconds)} · ${st.tries} attempt${st.tries === 1 ? '' : 's'}${st.revealed ? ' · answer was revealed' : ''}`),
          st.attempts.length ? el('table', { class: 'plain' },
            el('tr', {}, el('th', {}, 'When'), el('th', {}, 'Answer'), el('th', {}, ''), el('th', {}, 'Took'), el('th', {}, 'Hint')),
            ...st.attempts.map(a => el('tr', {},
              el('td', {}, fmtTs(a.ts)), el('td', {}, attemptText(step, a)), el('td', {}, a.correct ? '✅' : '❌'),
              el('td', {}, a.ms_to_answer != null ? `${Math.round(a.ms_to_answer / 1000)} s` : '—'), el('td', {}, a.hint_shown ? 'seen' : ''))))
            : el('p', { class: 'note' }, 'No answers yet.')),
      }, el('span', { class: 'n' }, String(i + 1)), el('span', { class: 'meta' }, st.status === 'not_started' ? '' : `${mmss(st.seconds)} · ${st.tries}× ${mark}`));
    });
    return el('div', { class: 'mis-row' }, el('b', {}, `M${m.n} · ${m.title}`), head, el('div', { class: 'mis-grid' }, ...cells));
  });
  const stuck = report.stuck.length
    ? el('div', {}, el('h4', {}, 'Stuck — dig here at the Sunday check-in'),
      el('table', { class: 'plain' }, ...report.stuck.map(s => el('tr', {},
        el('td', {}, `M${byId[s.mission].n} · ${s.title}`), el('td', {}, `${s.tries} attempts`), el('td', {}, s.revealed ? 'answer revealed' : '')))))
    : el('p', { class: 'note' }, 'Nothing stuck yet (a step shows up here after 2+ attempts or a revealed answer).');
  return section('Vuelo en ruta missions', ...blocks,
    el('p', { class: 'note' }, 'Cells: step number, time spent, attempts, ✓ first try · ✗ needed a retry · ↺ answer revealed. Click a cell for every answer he gave.'),
    detail, stuck);
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
