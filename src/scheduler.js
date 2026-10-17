// =============================================================
// scheduler.js — La planification des révisions (courbe de l'oubli)
// =============================================================
// Principe :
//  - Chaque leçon a UNE SEULE révision "à faire" à la fois.
//  - Quand on crée une leçon, on programme l'étape 0 (J0) pour aujourd'hui.
//  - Quand on termine l'étape N, on programme l'étape N+1.
//    Le délai est l'écart entre les intervalles : avec [0, 1, 3, 7...],
//    après J1 on attend 3 - 1 = 2 jours avant J3.
//  - Le délai est compté À PARTIR DU JOUR OÙ ON A VRAIMENT RÉVISÉ.
//    Donc si tu rates une révision, elle reste simplement "en retard"
//    (et passe en tête de liste) ; le reste du planning se décale tout seul,
//    sans rien casser.
//
// Les dates sont stockées sous forme de texte "AAAA-MM-JJ" (date locale),
// ce qui évite les problèmes de fuseau horaire et se compare facilement.

import { db } from './db.js';
import { generateQuestions } from './generators/local.js';

// ---------- Petites fonctions sur les dates ----------

/** Transforme un objet Date en texte "AAAA-MM-JJ" (heure locale). */
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Date du jour, en texte "AAAA-MM-JJ". */
export function todayStr() {
  return toDateStr(new Date());
}

/** Transforme "AAAA-MM-JJ" en objet Date (à midi, pour éviter les soucis d'heure d'été). */
export function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Ajoute (ou retire) des jours à une date "AAAA-MM-JJ". */
export function addDays(dateStr, days) {
  const date = parseDateStr(dateStr);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

/** Nombre de jours entre deux dates (b - a). */
export function daysBetween(a, b) {
  return Math.round((parseDateStr(b) - parseDateStr(a)) / 86400000);
}

// ---------- Règles de planification (fonctions "pures", faciles à tester) ----------

/**
 * Date de la prochaine révision après avoir terminé l'étape `step` le jour `doneDate`.
 * Renvoie null s'il n'y a plus d'étape (la leçon est terminée).
 */
export function nextDueDate(intervals, step, doneDate) {
  if (step + 1 >= intervals.length) return null;
  const gap = Math.max(1, intervals[step + 1] - intervals[step]); // au moins 1 jour
  return addDays(doneDate, gap);
}

/** Libellé d'une étape, ex. "J3". */
export function stepLabel(intervals, step) {
  return `J${intervals[step] ?? '?'}`;
}

/** Méthode de révision à utiliser pour une étape. */
export function methodForStep(methods, step) {
  return methods[step] ?? methods[methods.length - 1] ?? 'recall';
}

/**
 * Trie les révisions par priorité :
 *  1. les plus en retard d'abord (plus on attend, plus on oublie) ;
 *  2. puis les étapes les plus précoces (un souvenir récent est plus fragile) ;
 *  3. puis par date de création de la révision.
 */
export function sortByPriority(reviews, today) {
  return [...reviews].sort((a, b) => {
    const lateA = daysBetween(a.dueDate, today);
    const lateB = daysBetween(b.dueDate, today);
    if (lateA !== lateB) return lateB - lateA;
    if (a.step !== b.step) return a.step - b.step;
    return a.id - b.id;
  });
}

/**
 * Durée estimée d'une révision, en minutes.
 * (Servira aussi pour respecter le temps disponible par jour.)
 *  - lecture : environ 150 mots par minute (lecture attentive + surlignage) ;
 *  - questions : environ 1 minute par question, au moins 5 minutes.
 */
export function estimateMinutes(method, wordCount, questionCount) {
  if (method === 'reading') return Math.max(5, Math.round(wordCount / 150));
  return Math.max(5, Math.min(30, questionCount));
}

// ---------- Actions sur la base de données ----------

/**
 * Crée une leçon, génère ses questions automatiques
 * et programme la première révision (J0) pour aujourd'hui.
 */
export async function createLessonWithPlan({ subjectId, title, text }, today = todayStr()) {
  return db.transaction('rw', db.lessons, db.reviews, db.questions, async () => {
    const lessonId = await db.lessons.add({
      subjectId,
      title: title.trim(),
      text,
      highlights: [], // phrases surlignées pendant la lecture guidée
      createdAt: Date.now(),
    });

    const questions = generateQuestions(text).map((q) => ({
      ...q,
      lessonId,
      source: 'auto',
      lastRating: null,
      ratings: { easy: 0, medium: 0, hard: 0 },
    }));
    await db.questions.bulkAdd(questions);

    await db.reviews.add({
      lessonId,
      step: 0,
      dueDate: today,
      status: 'pending',
      createdAt: Date.now(),
    });
    return lessonId;
  });
}

/**
 * Termine une révision et programme la suivante.
 * `result` résume la séance, ex. { easy: 3, medium: 1, hard: 2 }.
 */
export async function completeReview(reviewId, result, intervals, doneDate = todayStr()) {
  return db.transaction('rw', db.reviews, async () => {
    const review = await db.reviews.get(reviewId);
    if (!review || review.status !== 'pending') return null;

    await db.reviews.update(reviewId, { status: 'done', doneDate, result });

    const due = nextDueDate(intervals, review.step, doneDate);
    if (!due) return null; // dernière étape : leçon terminée 🎉

    return db.reviews.add({
      lessonId: review.lessonId,
      step: review.step + 1,
      dueDate: due,
      status: 'pending',
      createdAt: Date.now(),
    });
  });
}

/**
 * Révisions à faire aujourd'hui (et celles en retard), triées par priorité,
 * avec la leçon et la matière associées.
 */
export async function getDueReviews(today = todayStr()) {
  const due = await db.reviews
    .where('dueDate')
    .belowOrEqual(today)
    .and((r) => r.status === 'pending')
    .toArray();
  return attachDetails(sortByPriority(due, today));
}

/** Révisions prévues dans les `days` prochains jours (sans aujourd'hui). */
export async function getUpcomingReviews(days = 7, today = todayStr()) {
  const upcoming = await db.reviews
    .where('dueDate')
    .between(addDays(today, 1), addDays(today, days), true, true)
    .and((r) => r.status === 'pending')
    .sortBy('dueDate');
  return attachDetails(upcoming);
}

/** Ajoute la leçon et la matière à chaque révision (pour l'affichage). */
async function attachDetails(reviews) {
  const result = [];
  for (const review of reviews) {
    const lesson = await db.lessons.get(review.lessonId);
    if (!lesson) continue; // leçon supprimée entre-temps
    const subject = await db.subjects.get(lesson.subjectId);
    const questionCount = await db.questions.where('lessonId').equals(lesson.id).count();
    result.push({ ...review, lesson, subject, questionCount });
  }
  return result;
}
