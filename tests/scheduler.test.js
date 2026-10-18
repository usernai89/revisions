// Tests de la planification. "fake-indexeddb" simule la base du navigateur.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db.js';
import {
  addDays, daysBetween, nextDueDate, sortByPriority,
  createLessonWithPlan, completeReview, getDueReviews,
} from '../src/scheduler.js';

const INTERVALS = [0, 1, 3, 7, 14, 30];

describe('dates', () => {
  it('ajoute des jours, y compris en changeant de mois', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(daysBetween('2026-03-28', '2026-04-02')).toBe(5); // passage à l'heure d'été
  });
});

describe('nextDueDate', () => {
  it('suit les écarts entre intervalles', () => {
    expect(nextDueDate(INTERVALS, 0, '2026-10-01')).toBe('2026-10-02'); // J0 → J1
    expect(nextDueDate(INTERVALS, 1, '2026-10-02')).toBe('2026-10-04'); // J1 → J3
    expect(nextDueDate(INTERVALS, 2, '2026-10-04')).toBe('2026-10-08'); // J3 → J7
  });
  it('renvoie null après la dernière étape', () => {
    expect(nextDueDate(INTERVALS, 5, '2026-10-01')).toBeNull();
  });
});

describe('sortByPriority', () => {
  it('met les révisions en retard en premier, puis les étapes précoces', () => {
    const today = '2026-10-10';
    const sorted = sortByPriority([
      { id: 1, step: 0, dueDate: '2026-10-10' },
      { id: 2, step: 2, dueDate: '2026-10-07' },
      { id: 3, step: 1, dueDate: '2026-10-10' },
    ], today);
    expect(sorted.map((r) => r.id)).toEqual([2, 1, 3]);
  });
});

describe('cycle complet dans la base', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('crée J0, puis J1, et reporte sans casser si on est en retard', async () => {
    const subjectId = await db.subjects.add({ name: 'Anatomie' });
    await createLessonWithPlan(
      { subjectId, title: 'Le cœur', text: 'Le cœur est un muscle creux.' },
      '2026-10-01',
    );

    let due = await getDueReviews('2026-10-01');
    expect(due).toHaveLength(1);
    expect(due[0].step).toBe(0);
    expect(due[0].questionCount).toBe(1);

    // J0 fait le 1er → J1 prévu le 2.
    await completeReview(due[0].id, {}, INTERVALS, '2026-10-01');
    expect(await getDueReviews('2026-10-01')).toHaveLength(0);

    // On "oublie" de réviser le 2 : le 5, J1 est toujours là, en retard.
    due = await getDueReviews('2026-10-05');
    expect(due[0].step).toBe(1);
    expect(due[0].dueDate).toBe('2026-10-02');

    // Fait le 5 → J3 prévu 2 jours APRÈS le 5 (et non après le 2).
    await completeReview(due[0].id, {}, INTERVALS, '2026-10-05');
    const next = await db.reviews.where('status').equals('pending').first();
    expect(next).toMatchObject({ step: 2, dueDate: '2026-10-07' });
  });
});
