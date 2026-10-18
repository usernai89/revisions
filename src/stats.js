// =============================================================
// stats.js — Calcul des statistiques (fonctions "pures", faciles à tester)
// =============================================================
// Pour chaque matière (et pour l'ensemble) :
//  - leçons vues      : leçons dont au moins une révision est faite (J0 compris) ;
//  - leçons terminées : toutes les étapes faites ;
//  - taux de réussite : réponses notées "facile" ou "moyen" / toutes les réponses ;
//  - retards          : révisions à faire dont la date est passée ;
//  - ponctualité      : révisions faites le jour prévu (ou en avance) / révisions faites.
// Et l'activité des derniers jours (minutes de révision par jour).

import { addDays } from './scheduler.js';

/**
 * @param {object} data
 *   - subjects : [{ id, name, ... }]
 *   - lessons  : [{ id, subjectId }]
 *   - reviews  : [{ lessonId, status, dueDate, doneDate, result, spentMinutes, estimatedMinutes }]
 *   - today    : "AAAA-MM-JJ"
 *   - days     : nombre de jours d'activité à renvoyer
 */
export function computeStats({ subjects, lessons, reviews, today, days = 14 }) {
  const subjectOfLesson = new Map(lessons.map((l) => [l.id, l.subjectId]));

  // On range les révisions par matière.
  const reviewsBySubject = new Map(subjects.map((s) => [s.id, []]));
  for (const r of reviews) {
    const subjectId = subjectOfLesson.get(r.lessonId);
    reviewsBySubject.get(subjectId)?.push(r);
  }

  const bySubject = subjects.map((subject) => ({
    subject,
    ...summarize(
      lessons.filter((l) => l.subjectId === subject.id),
      reviewsBySubject.get(subject.id),
      today,
    ),
  }));

  return {
    global: summarize(lessons, reviews, today),
    bySubject,
    activity: activityByDay(reviews, today, days),
  };
}

/** Résumé d'un groupe de leçons et de leurs révisions. */
export function summarize(lessons, reviews, today) {
  const done = reviews.filter((r) => r.status === 'done');
  const pending = reviews.filter((r) => r.status === 'pending');

  const seen = new Set(done.map((r) => r.lessonId));
  const stillPending = new Set(pending.map((r) => r.lessonId));
  const finished = [...seen].filter((id) => !stillPending.has(id)).length;

  // Toutes les notes données pendant les révisions.
  const answers = { easy: 0, medium: 0, hard: 0 };
  for (const r of done) {
    answers.easy += r.result?.easy ?? 0;
    answers.medium += r.result?.medium ?? 0;
    answers.hard += r.result?.hard ?? 0;
  }
  const totalAnswers = answers.easy + answers.medium + answers.hard;
  const onTime = done.filter((r) => r.doneDate <= r.dueDate).length;

  return {
    lessonCount: lessons.length,
    lessonsSeen: seen.size,
    lessonsFinished: finished,
    answers,
    totalAnswers,
    // null = pas encore de données (on affichera "—" plutôt que 0 %).
    successRate: totalAnswers ? (answers.easy + answers.medium) / totalAnswers : null,
    overdue: pending.filter((r) => r.dueDate < today).length,
    dueToday: pending.filter((r) => r.dueDate === today).length,
    reviewsDone: done.length,
    onTimeRate: done.length ? onTime / done.length : null,
  };
}

/**
 * Minutes de révision par jour, des `days` derniers jours (aujourd'hui inclus).
 * On prend le temps réellement passé ; s'il est nul (séance très courte,
 * ou ancienne révision), on prend la durée estimée.
 */
export function activityByDay(reviews, today, days) {
  const minutes = new Map();
  for (const r of reviews) {
    if (r.status !== 'done') continue;
    const m = r.spentMinutes || r.estimatedMinutes || 0;
    minutes.set(r.doneDate, (minutes.get(r.doneDate) ?? 0) + m);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, minutes: minutes.get(date) ?? 0 };
  });
}

/** 0.8234 → "82 %", null → "—". */
export function formatPercent(rate) {
  return rate === null ? '—' : `${Math.round(rate * 100)} %`;
}
