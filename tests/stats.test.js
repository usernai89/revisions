// Tests des statistiques.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { computeStats, formatPercent } from '../src/stats.js';

const TODAY = '2026-10-18';
const subjects = [{ id: 1, name: 'Cardiologie' }, { id: 2, name: 'Anatomie' }];
const lessons = [
  { id: 10, subjectId: 1 }, // vue, en cours
  { id: 11, subjectId: 1 }, // jamais vue, J0 en retard
  { id: 20, subjectId: 2 }, // terminée
];
const reviews = [
  { lessonId: 10, status: 'done', step: 0, dueDate: '2026-10-15', doneDate: '2026-10-15', result: { highlights: 3 }, estimatedMinutes: 10 },
  { lessonId: 10, status: 'done', step: 1, dueDate: '2026-10-16', doneDate: '2026-10-17', result: { easy: 6, medium: 2, hard: 2 }, spentMinutes: 12, estimatedMinutes: 8 },
  { lessonId: 10, status: 'pending', step: 2, dueDate: '2026-10-19' },
  { lessonId: 11, status: 'pending', step: 0, dueDate: '2026-10-16' },
  { lessonId: 20, status: 'done', step: 0, dueDate: '2026-10-17', doneDate: '2026-10-17', result: { easy: 1, medium: 0, hard: 1 }, estimatedMinutes: 5 },
];

describe('computeStats', () => {
  const stats = computeStats({ subjects, lessons, reviews, today: TODAY, days: 7 });
  const cardio = stats.bySubject[0];
  const anat = stats.bySubject[1];

  it('compte les leçons vues et terminées', () => {
    expect(cardio).toMatchObject({ lessonCount: 2, lessonsSeen: 1, lessonsFinished: 0 });
    expect(anat).toMatchObject({ lessonCount: 1, lessonsSeen: 1, lessonsFinished: 1 });
  });

  it('calcule le taux de réussite (facile + moyen) / total', () => {
    expect(cardio.successRate).toBeCloseTo(0.8);
    expect(anat.successRate).toBeCloseTo(0.5);
    expect(stats.global.answers).toEqual({ easy: 7, medium: 2, hard: 3 });
  });

  it('compte les retards (date passée, pas aujourd\'hui)', () => {
    expect(cardio.overdue).toBe(1);
    expect(anat.overdue).toBe(0);
  });

  it('calcule la ponctualité', () => {
    expect(cardio.onTimeRate).toBeCloseTo(0.5); // J1 fait avec un jour de retard
    expect(anat.onTimeRate).toBe(1);
  });

  it('additionne les minutes par jour (temps réel, sinon estimé)', () => {
    expect(stats.activity).toHaveLength(7);
    expect(stats.activity.at(-1)).toEqual({ date: TODAY, minutes: 0 });
    expect(stats.activity.find((d) => d.date === '2026-10-17').minutes).toBe(17); // 12 réel + 5 estimé
    expect(stats.activity.find((d) => d.date === '2026-10-15').minutes).toBe(10);
  });

  it('affiche "—" quand il n\'y a pas encore de données', () => {
    const empty = computeStats({ subjects, lessons: [], reviews: [], today: TODAY });
    expect(empty.global.successRate).toBeNull();
    expect(formatPercent(empty.global.successRate)).toBe('—');
    expect(formatPercent(0.825)).toBe('83 %');
  });
});
