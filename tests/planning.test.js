// Tests de la répartition des révisions selon le temps disponible par jour.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { planDays, estimateMinutes, isWeekend } from '../src/scheduler.js';

const OPTIONS = {
  today: '2026-10-19', // un lundi
  days: 7,
  intervals: [0, 1, 3, 7, 14, 30],
  methods: ['reading', 'qroc', 'recall', 'cloze', 'mix', 'mix'],
  budget: { weekday: 60, weekend: 180 },
};

// Une révision J1 (QROC) de 10 questions = 10 minutes.
let nextId = 1;
const qroc = (dueDate = '2026-10-19') => ({ id: nextId++, step: 1, dueDate, wordCount: 500, questionCount: 10 });

describe('estimateMinutes', () => {
  it('estime selon la méthode', () => {
    expect(estimateMinutes('reading', 3000, 0)).toBe(20);
    expect(estimateMinutes('qroc', 0, 10)).toBe(10);
    expect(estimateMinutes('qroc', 0, 1)).toBe(5); // minimum 5 minutes
    expect(estimateMinutes('mix', 0, 0)).toBe(12);
  });
});

describe('planDays', () => {
  it('ne dépasse jamais le temps du jour et reporte le reste au lendemain', () => {
    const reviews = Array.from({ length: 8 }, () => qroc()); // 8 × 10 min = 80 min
    const plan = planDays(reviews, OPTIONS);
    expect(plan[0].items).toHaveLength(6); // 60 min
    expect(plan[0].used).toBe(60);
    // Mardi : seulement les 2 reportées (les J3 des 6 faites lundi tombent mercredi).
    expect(plan[1].items.map((r) => r.simulated)).toEqual([false, false]);
  });

  it('les révisions reportées passent en tête le lendemain', () => {
    const late = qroc('2026-10-19');
    const fresh = qroc('2026-10-20');
    const plan = planDays([late, fresh], { ...OPTIONS, usedToday: 60 }); // lundi déjà rempli
    expect(plan[0].items).toHaveLength(0);
    expect(plan[1].items.map((r) => r.id)).toEqual([late.id, fresh.id]);
  });

  it('tient compte du temps déjà révisé aujourd\'hui', () => {
    const plan = planDays([qroc(), qroc()], { ...OPTIONS, usedToday: 50 });
    expect(plan[0].items).toHaveLength(1);
  });

  it('remplit les trous avec une révision plus courte', () => {
    const long = { id: 100, step: 0, dueDate: '2026-10-19', wordCount: 7500, questionCount: 0 }; // 50 min
    const reviews = [qroc(), long, qroc()]; // 10 + 50 + 10
    const plan = planDays(reviews, OPTIONS);
    // Priorité : J0 (long) d'abord, puis une QROC de 10 min ; la 2e QROC ne rentre plus.
    expect(plan[0].items.map((r) => r.minutes)).toEqual([50, 10]);
  });

  it('accepte une révision plus longue que la journée si la journée est vide', () => {
    const huge = { id: 200, step: 0, dueDate: '2026-10-19', wordCount: 15000, questionCount: 0 }; // 100 min
    const plan = planDays([huge], OPTIONS);
    expect(plan[0].items).toHaveLength(1);
  });

  it('ne place rien un jour de repos (0 minute)', () => {
    const plan = planDays([qroc()], { ...OPTIONS, budget: { weekday: 0, weekend: 180 } });
    expect(plan[0].items).toHaveLength(0);
    expect(plan[5].items).toHaveLength(1); // samedi
  });

  it('prévoit les étapes suivantes (J1 lundi → J3 mercredi)', () => {
    const plan = planDays([qroc()], OPTIONS);
    expect(plan[2].items[0]).toMatchObject({ step: 2, simulated: true });
  });

  it('utilise le temps du week-end le samedi', () => {
    expect(isWeekend('2026-10-24')).toBe(true);
    expect(isWeekend('2026-10-23')).toBe(false);
    const reviews = Array.from({ length: 12 }, () => qroc('2026-10-24'));
    const plan = planDays(reviews, OPTIONS);
    expect(plan[5].items).toHaveLength(12); // 120 min < 180 min
  });
});
