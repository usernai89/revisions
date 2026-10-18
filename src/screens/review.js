// =============================================================
// screens/review.js — Faire une révision
// =============================================================
// Choisit la méthode selon l'étape (réglable), la lance,
// puis enregistre la révision comme faite et programme la suivante.

import { db, getLesson } from '../db.js';
import { completeReview, stepLabel, methodForStep, todayStr, estimateMinutes } from '../scheduler.js';
import { countWords } from '../text.js';
import { getSettings } from '../settings.js';
import { escapeHtml, formatDateFr, go, METHOD_LABELS } from '../ui.js';

import * as reading from '../methods/reading.js';
import * as qroc from '../methods/qroc.js';
import * as recall from '../methods/recall.js';
import * as cloze from '../methods/cloze.js';
import * as flashcards from '../methods/flashcards.js';
import * as mix from '../methods/mix.js';

// Méthode (nom dans les réglages) → module qui la réalise.
const METHODS = { reading, qroc, recall, cloze, flashcards, mix };

export async function render(app, reviewId) {
  const review = await db.reviews.get(reviewId);
  if (!review || review.status !== 'pending') return go('#/today');

  const settings = await getSettings();
  const lesson = await getLesson(review.lessonId);
  const questions = await db.questions.where('lessonId').equals(lesson.id).toArray();
  const methodName = methodForStep(settings.methods, review.step);
  const method = METHODS[methodName] ?? recall;

  app.innerHTML = `
    <a href="#/today" class="muted">‹ Aujourd'hui</a>
    <h1>${escapeHtml(lesson.title)}</h1>
    <p class="subtitle">${stepLabel(settings.intervals, review.step)} · ${METHOD_LABELS[methodName] ?? methodName}</p>
    <div id="method"></div>
  `;

  // Durée : estimée (pour le temps du jour) et réelle (pour les statistiques).
  const estimatedMinutes = estimateMinutes(methodName, countWords(lesson.text), questions.length);
  const startedAt = Date.now();

  method.run(app.querySelector('#method'), { lesson, questions, review }, async (result) => {
    // Temps réel plafonné à 3 h (au cas où l'appli serait restée ouverte).
    const spentMinutes = Math.min(180, Math.round((Date.now() - startedAt) / 60000));
    const nextId = await completeReview(reviewId, result, settings.intervals, todayStr(), {
      estimatedMinutes,
      spentMinutes,
    });
    const next = nextId ? await db.reviews.get(nextId) : null;
    showSummary(app, lesson, result, next, settings);
  });
}

/** Écran de fin : bilan + date de la prochaine révision. */
function showSummary(app, lesson, result, next, settings) {
  const total = (result.easy ?? 0) + (result.medium ?? 0) + (result.hard ?? 0);
  app.innerHTML = `
    <div class="empty">
      <div class="big">💪</div>
      <h1>Révision terminée !</h1>
      <p>${escapeHtml(lesson.title)}</p>
    </div>
    ${total ? `
      <div class="card">
        <div class="row"><div class="grow">😀 Facile</div><strong>${result.easy}</strong></div>
        <div class="row"><div class="grow">😐 Moyen</div><strong>${result.medium}</strong></div>
        <div class="row"><div class="grow">😣 Difficile</div><strong>${result.hard}</strong></div>
      </div>` : ''}
    <div class="card">
      ${next
        ? `Prochaine révision (${stepLabel(settings.intervals, next.step)}) : <strong>${formatDateFr(next.dueDate)}</strong>`
        : '🏁 Toutes les étapes de cette leçon sont terminées !'}
    </div>
    <a class="btn btn-primary btn-block" href="#/today">Retour à aujourd'hui</a>
  `;
  window.scrollTo(0, 0);
}
