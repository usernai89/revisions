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
import { countWords } from './text.js';

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
 * Durée estimée d'une révision, en minutes (au moins 5 minutes).
 * Sert à respecter ton temps disponible par jour.
 *  - lecture guidée : environ 150 mots par minute (lecture attentive + surlignage) ;
 *  - QROC / flashcards : environ 1 minute par question (15 questions maximum) ;
 *  - rappel actif : environ 1 min 30 par question, car on écrit (10 maximum) ;
 *  - texte à trous : une dizaine de phrases → environ 8 minutes ;
 *  - mélange : une quinzaine de cartes → environ 12 minutes.
 */
export function estimateMinutes(method, wordCount, questionCount) {
  let minutes;
  if (method === 'reading') minutes = Math.round(wordCount / 150);
  else if (method === 'recall') minutes = Math.round(Math.min(10, questionCount + 1) * 1.5);
  else if (method === 'cloze') minutes = 8;
  else if (method === 'mix') minutes = 12;
  else minutes = Math.min(15, questionCount);
  return Math.max(5, minutes);
}

/** Est-ce un samedi ou un dimanche ? */
export function isWeekend(dateStr) {
  const day = parseDateStr(dateStr).getDay(); // 0 = dimanche, 6 = samedi
  return day === 0 || day === 6;
}

/** Temps disponible (en minutes) pour une date, selon les réglages. */
export function budgetForDate(budget, dateStr) {
  return isWeekend(dateStr) ? budget.weekend : budget.weekday;
}

/**
 * Répartit les révisions sur les prochains jours en respectant le temps disponible.
 *
 * Pour chaque jour, en partant d'aujourd'hui :
 *  1. on prend les révisions arrivées à échéance (dont celles reportées la veille),
 *     triées par priorité ;
 *  2. on les ajoute tant qu'elles rentrent dans le temps du jour.
 *     Une révision trop longue est sautée, et on essaie la suivante (plus courte) ;
 *  3. ce qui ne rentre pas est reporté au lendemain, en tête de liste.
 *
 * Exception : une révision plus longue que le temps d'une journée entière
 * (ex. un très long cours à lire) est acceptée si la journée est encore vide,
 * sinon elle ne serait jamais faite. Un jour à 0 minute reste un jour de repos.
 *
 * Pour prévoir les jours suivants, quand une révision est placée un jour donné,
 * on "simule" l'étape suivante (ex. J1 placé le 18 → J3 prévu le 20).
 *
 * @param {Array} reviews — révisions en attente : { id, step, dueDate, wordCount, questionCount }
 * @param {object} options
 *   - today : date de départ "AAAA-MM-JJ"
 *   - days : nombre de jours à prévoir
 *   - intervals, methods : réglages des étapes
 *   - budget : { weekday, weekend } en minutes
 *   - usedToday : minutes déjà révisées aujourd'hui
 * @returns {Array<{ date, budget, used, items }>} un élément par jour ;
 *   chaque item est la révision + { minutes, method, simulated }
 */
export function planDays(reviews, { today, days, intervals, methods, budget, usedToday = 0 }) {
  let fakeId = 1e9; // identifiants des révisions simulées (après les vraies)
  let pool = reviews.map((r) => ({ ...r, simulated: false }));
  const plan = [];

  for (let d = 0; d < days; d++) {
    const date = addDays(today, d);
    const dayBudget = budgetForDate(budget, date);
    const day = { date, budget: dayBudget, used: d === 0 ? usedToday : 0, items: [] };

    const available = sortByPriority(pool.filter((r) => r.dueDate <= date), date);
    for (const review of available) {
      const method = methodForStep(methods, review.step);
      const minutes = estimateMinutes(method, review.wordCount, review.questionCount);
      const fits = day.used + minutes <= dayBudget;
      const aloneOnEmptyDay = dayBudget > 0 && day.used === 0 && day.items.length === 0;
      if (!fits && !aloneOnEmptyDay) continue; // reporté (on essaie la suivante)

      day.items.push({ ...review, method, minutes });
      day.used += minutes;
      pool = pool.filter((r) => r !== review);

      // Étape suivante simulée, pour la prévision des jours suivants.
      const next = nextDueDate(intervals, review.step, date);
      if (next) {
        pool.push({ ...review, id: fakeId++, step: review.step + 1, dueDate: next, simulated: true });
      }
    }
    plan.push(day);
  }
  return plan;
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
 * `durations` = { estimatedMinutes, spentMinutes } : temps prévu et temps réel,
 * pour décompter le temps déjà utilisé aujourd'hui (et pour les statistiques).
 */
export async function completeReview(reviewId, result, intervals, doneDate = todayStr(), durations = {}) {
  return db.transaction('rw', db.reviews, async () => {
    const review = await db.reviews.get(reviewId);
    if (!review || review.status !== 'pending') return null;

    await db.reviews.update(reviewId, { status: 'done', doneDate, result, ...durations });

    const due = nextDueDate(intervals, review.step, doneDate);
    if (!due) return null; // dernière étape : leçon terminée

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
 * Toutes les révisions en attente (aujourd'hui, en retard et futures),
 * avec la leçon, la matière et ce qu'il faut pour estimer leur durée.
 */
export async function getPendingReviews() {
  const pending = await db.reviews.where('status').equals('pending').toArray();
  return attachDetails(pending);
}

/** Révisions à faire aujourd'hui (et celles en retard), triées par priorité. */
export async function getDueReviews(today = todayStr()) {
  const due = (await getPendingReviews()).filter((r) => r.dueDate <= today);
  return sortByPriority(due, today);
}

/** Minutes de révision déjà faites un jour donné (selon la durée estimée). */
export async function usedMinutesOn(dateStr) {
  const done = await db.reviews
    .where('status').equals('done')
    .and((r) => r.doneDate === dateStr)
    .toArray();
  return done.reduce((sum, r) => sum + (r.estimatedMinutes ?? 0), 0);
}

/** Ajoute la leçon et la matière à chaque révision (pour l'affichage). */
async function attachDetails(reviews) {
  const result = [];
  for (const review of reviews) {
    const lesson = await db.lessons.get(review.lessonId);
    if (!lesson) continue; // leçon supprimée entre-temps
    const subject = await db.subjects.get(lesson.subjectId);
    const questionCount = await db.questions.where('lessonId').equals(lesson.id).count();
    result.push({ ...review, lesson, subject, questionCount, wordCount: countWords(lesson.text) });
  }
  return result;
}
