// =============================================================
// screens/review.js — Faire une révision
// =============================================================
// Choisit la méthode selon l'étape (réglable), la lance,
// puis enregistre la révision comme faite et programme la suivante.

import { db, getLesson, subjectColor } from '../db.js';
import { completeReview, stepLabel, methodForStep, todayStr, estimateMinutes } from '../scheduler.js';
import { countWords } from '../text.js';
import { getSettings } from '../settings.js';
import { escapeHtml, formatDateFr, go, lineBadge, METHOD_LABELS } from '../ui.js';

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
  const subject = await db.subjects.get(lesson.subjectId);
  const color = subjectColor(subject);
  const questions = await db.questions.where('lessonId').equals(lesson.id).toArray();
  const subjectTerms = await getSubjectTerms(lesson.subjectId);
  const methodName = methodForStep(settings.methods, review.step);
  const method = METHODS[methodName] ?? recall;

  // La couleur de la ligne colore toute la séance (bord des cartes, trajet…).
  app.style.setProperty('--line', color);

  app.innerHTML = `
    <a href="#/today" class="back">Départs</a>
    <div class="review-head">
      ${lineBadge(subject, color)}
      <div>
        <div class="t">${escapeHtml(lesson.title)}</div>
        <div class="s">${stepLabel(settings.intervals, review.step)} · ${METHOD_LABELS[methodName] ?? methodName}</div>
      </div>
    </div>
    <div id="method"></div>
  `;

  // Durée : estimée (pour le temps du jour) et réelle (pour les statistiques).
  const estimatedMinutes = estimateMinutes(methodName, countWords(lesson.text), questions.length);
  const startedAt = Date.now();

  method.run(app.querySelector('#method'), { lesson, questions, review, subjectTerms }, async (result) => {
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

/** Écran de fin : panneau "arrivée" avec le bilan et la prochaine étape. */
function showSummary(app, lesson, result, next, settings) {
  const total = (result.easy ?? 0) + (result.medium ?? 0) + (result.hard ?? 0);
  app.innerHTML = `
    <section class="arrival">
      <div class="arrival-sign">${next ? 'Arrivée' : 'Terminus'}</div>
      <div class="arrival-sub">${escapeHtml(lesson.title)}</div>
      ${total ? `
        <div class="tally">
          <div style="--c:var(--easy)"><strong>${result.easy}</strong>facile</div>
          <div style="--c:var(--medium)"><strong>${result.medium}</strong>moyen</div>
          <div style="--c:var(--hard)"><strong>${result.hard}</strong>difficile</div>
        </div>` : ''}
      ${result.highlights !== undefined ? `<div class="next-stop">${result.highlights} point(s) surligné(s)</div>` : ''}
      <div class="next-stop">
        ${next
          ? `Prochain arrêt · ${stepLabel(settings.intervals, next.step)} · ${formatDateFr(next.dueDate)}`
          : 'Toutes les étapes de cette leçon sont faites.'}
      </div>
    </section>
    <a class="btn btn-go btn-block" href="#/today">Retour aux départs</a>
  `;
  window.scrollTo(0, 0);
}

/**
 * Tous les termes définis dans la matière (toutes leçons confondues).
 * Ils servent de mauvaises réponses pour les QCM automatiques.
 */
async function getSubjectTerms(subjectId) {
  const lessonIds = await db.lessons.where('subjectId').equals(subjectId).primaryKeys();
  const questions = await db.questions.where('lessonId').anyOf(lessonIds).toArray();
  return questions.filter((q) => q.kind === 'definition').map((q) => q.term);
}
