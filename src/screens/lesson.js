// =============================================================
// screens/lesson.js — Une leçon : son trajet J0 → J30, ses questions, son texte
// =============================================================

import { db, getLesson, deleteLesson, listQuestions, subjectColor, addAiQuestions } from '../db.js';
import { isAiReady, generateQuestionsWithAI } from '../ai/index.js';
import { todayStr, daysBetween, stepLabel, nextDueDate, methodForStep } from '../scheduler.js';
import { getSettings } from '../settings.js';
import { escapeHtml, formatDateFr, go, lineBadge, relativeDay, toast, METHOD_LABELS } from '../ui.js';

// Étiquette de chaque type de question dans la liste.
const KIND_TAGS = { definition: 'DÉF', list: 'LISTE', qroc: 'QROC', qcm: 'QCM' };

export async function render(app, lessonId) {
  const lesson = await getLesson(lessonId);
  if (!lesson) return go('#/subjects');

  const settings = await getSettings();
  const subject = await db.subjects.get(lesson.subjectId);
  const color = subjectColor(subject);
  const reviews = await db.reviews.where('lessonId').equals(lessonId).sortBy('step');
  const questions = await listQuestions(lessonId);
  // Tes questions d'abord, puis celles de l'IA, puis celles générées automatiquement.
  const ORDER = { user: 0, ai: 1, auto: 2 };
  questions.sort((a, b) => (ORDER[a.source] ?? 2) - (ORDER[b.source] ?? 2));
  const fromAi = questions.filter((q) => q.source === 'ai').length;
  const aiReady = isAiReady(settings.ai);
  const pending = reviews.find((r) => r.status === 'pending');
  const today = todayStr();
  const mine = questions.filter((q) => q.source === 'user').length;

  app.innerHTML = `
    <a href="#/subject/${lesson.subjectId}" class="back">${escapeHtml(subject?.name ?? '')}</a>
    <div class="line-head">
      ${lineBadge(subject, color)}
      <h1 class="page-title">${escapeHtml(lesson.title)}</h1>
    </div>

    ${pending && pending.dueDate <= today
      ? `<a class="btn btn-go btn-block" href="#/review/${pending.id}">Réviser maintenant · ${stepLabel(settings.intervals, pending.step)}</a>`
      : ''}

    <h2 class="section">Trajet</h2>
    <ol class="route" style="--line:${color}">${routeStations(reviews, pending, settings, today)}</ol>

    <h2 class="section">Questions · ${questions.length}</h2>
    <a class="btn btn-ghost btn-block" href="#/lesson/${lessonId}/question">+ Écrire une question (QCM / QROC)</a>
    ${aiReady ? `
      <button id="ai-gen" class="btn btn-ghost btn-block" style="margin-top:8px">Générer ${settings.ai.count} questions avec l'IA</button>
      <p class="form-error" id="ai-status" role="status"></p>` : ''}
    ${questions.length ? `
      <p class="hint">${mine} écrite${mine > 1 ? 's' : ''} par toi${fromAi ? ` · ${fromAi} par l'IA` : ''} · ${questions.length - mine - fromAi} générée${questions.length - mine - fromAi > 1 ? 's' : ''} automatiquement. Touche une question pour la modifier.</p>
      <ul class="q-list">
        ${questions.map((q) => `
          <li><a href="#/question/${q.id}">
            <span class="q-tag ${q.source === 'user' ? 'mine' : q.source === 'ai' ? 'ai' : ''}">${q.source === 'ai' ? 'IA·' : ''}${KIND_TAGS[q.kind] ?? '?'}</span>
            <span class="q-text">${escapeHtml(q.prompt)}
              ${q.context ? '<small>avec cas clinique</small>' : ''}
              ${q.lastRating === 'hard' ? '<small>noté difficile la dernière fois</small>' : ''}</span>
          </a></li>`).join('')}
      </ul>` : '<p class="hint">Aucune définition ni liste détectée dans ce cours. Les révisions utiliseront les textes à trous et le rappel actif, ou tes propres questions.</p>'}

    ${lesson.highlights?.length ? `
      <details class="fold">
        <summary>Points surlignés · ${lesson.highlights.length}</summary>
        ${lesson.highlights.map((h) => `<p>${escapeHtml(h)}</p>`).join('')}
      </details>` : ''}

    <details class="fold">
      <summary>Texte du cours</summary>
      <div class="text-block">${escapeHtml(lesson.text)}</div>
    </details>

    <button id="delete" class="btn btn-danger btn-block">Supprimer la leçon</button>
  `;

  // --- Génération par IA (si activée dans les réglages) ---
  app.querySelector('#ai-gen')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const status = app.querySelector('#ai-status');
    btn.disabled = true;
    status.dataset.state = 'busy';
    status.textContent = "Génération en cours… (jusqu'à une minute ; garde l'appli ouverte)";
    try {
      const generated = await generateQuestionsWithAI(lesson, settings.ai, {
        subjectName: subject?.name,
        existingPrompts: questions.map((q) => q.prompt).slice(0, 60),
      });
      await addAiQuestions(lessonId, generated);
      toast(`${generated.length} question(s) ajoutée(s) par l'IA`);
      render(app, lessonId);
    } catch (err) {
      status.dataset.state = '';
      status.textContent = err.message;
      btn.disabled = false;
    }
  });

  app.querySelector('#delete').onclick = async () => {
    if (!confirm(`Supprimer « ${lesson.title} » ? C'est définitif.`)) return;
    await deleteLesson(lessonId);
    toast('Leçon supprimée');
    go(`#/subject/${lesson.subjectId}`);
  };
}

/**
 * Le trajet de la leçon : une station par étape.
 *  - étapes faites : station pleine + date ;
 *  - étape en cours : station qui clignote ;
 *  - étapes suivantes : date prévue si tout se passe à l'heure.
 */
function routeStations(reviews, pending, settings, today) {
  const stations = [];
  const last = settings.intervals.length - 1;
  const method = (step) => METHOD_LABELS[methodForStep(settings.methods, step)] ?? '';

  for (const r of reviews.filter((r) => r.status === 'done')) {
    stations.push(stationHtml('done', r.step, method(r.step), `fait ${formatDateFr(r.doneDate, false)}`, '', settings, r.step === last));
  }

  if (pending) {
    const days = daysBetween(today, pending.dueDate);
    const cls = days < 0 ? 'late' : days === 0 ? 'now' : '';
    const when = days < 0 ? `retard ${-days} j` : relativeDay(days);
    stations.push(stationHtml(days <= 0 ? 'here' : 'future', pending.step, method(pending.step), when, cls, settings, pending.step === last));

    // Prévisions des étapes suivantes.
    let date = pending.dueDate < today ? today : pending.dueDate;
    for (let step = pending.step; ; step++) {
      date = nextDueDate(settings.intervals, step, date);
      if (!date) break;
      stations.push(stationHtml('future', step + 1, method(step + 1), formatDateFr(date, false), '', settings, step + 1 === last));
    }
  }
  return stations.join('');
}

function stationHtml(state, step, methodLabel, when, whenClass, settings, isLast) {
  return `
    <li class="stn ${state}">
      <span class="stn-dot"></span>
      <span class="stn-name">${stepLabel(settings.intervals, step)}<span class="stn-sub">${methodLabel}${isLast ? ' · terminus' : ''}</span></span>
      <span class="stn-when ${whenClass}">${when}</span>
    </li>`;
}
