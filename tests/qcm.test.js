// Tests du choix QCM / QROC et de la correction des QCM.
import { describe, it, expect } from 'vitest';
import { toQuestionCard, gradeQcm } from '../src/generators/qcm.js';

const definition = {
  id: 1, kind: 'definition', term: 'La dyspnée',
  prompt: 'Définis : La dyspnée', answer: 'La dyspnée est une gêne respiratoire.',
};
const TERMS = ['La dyspnée', 'Orthopnée', 'La tachycardie', "L'œdème", 'Bradycardie'];

describe('toQuestionCard', () => {
  it('fait un QCM pour une définition quand la matière a assez de termes', () => {
    const card = toQuestionCard(definition, TERMS);
    expect(card.options).toHaveLength(4);
    expect(card.options.filter((o) => o.correct)).toEqual([{ text: 'Dyspnée', correct: true }]);
    expect(card.prompt).toBe('Quel terme correspond à : « … est une gêne respiratoire. » ?');
    // Le bon terme n'apparaît pas deux fois parmi les distracteurs.
    expect(card.options.map((o) => o.text.toLowerCase()).filter((t) => t === 'dyspnée')).toHaveLength(1);
  });

  it('reste en QROC s\'il manque des termes', () => {
    const card = toQuestionCard(definition, ['La dyspnée', 'Orthopnée']);
    expect(card.options).toBeUndefined();
    expect(card.answer).toBe(definition.answer);
  });

  it('garde les listes en QROC', () => {
    const card = toQuestionCard({ id: 2, kind: 'list', term: 'Signes', prompt: 'Cite : Signes', answer: '• a\n• b' }, TERMS);
    expect(card.options).toBeUndefined();
  });

  it('respecte tes propres QCM, avec leur cas clinique', () => {
    const mine = {
      id: 3, kind: 'qcm', source: 'user', prompt: 'Quels signes ?', context: 'Homme de 60 ans…',
      options: [{ text: 'A', correct: true }, { text: 'B', correct: false }], explanation: 'Parce que.',
    };
    expect(toQuestionCard(mine, TERMS)).toMatchObject({
      prompt: 'Quels signes ?', context: 'Homme de 60 ans…', options: mine.options, explanation: 'Parce que.',
    });
  });
});

describe('gradeQcm', () => {
  const options = [{ correct: true }, { correct: false }, { correct: true }, { correct: false }];
  it('tout juste', () => {
    expect(gradeQcm(options, new Set([0, 2]))).toEqual({ perfect: true, errors: 0 });
  });
  it('compte les oublis et les mauvaises cases', () => {
    expect(gradeQcm(options, new Set([0, 1]))).toEqual({ perfect: false, errors: 2 });
  });
});
