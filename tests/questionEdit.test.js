// Tests de la vérification d'une question écrite à la main.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { validateQuestion } from '../src/screens/questionEdit.js';

describe('validateQuestion', () => {
  it('QROC : question et réponse obligatoires', () => {
    expect(validateQuestion({ kind: 'qroc', prompt: '', answer: 'x' })).toMatch(/question/);
    expect(validateQuestion({ kind: 'qroc', prompt: 'Q ?', answer: '' })).toMatch(/réponse/);
    expect(validateQuestion({ kind: 'qroc', prompt: 'Q ?', answer: 'R' })).toBeNull();
  });
  it('QCM : au moins 2 propositions dont une juste', () => {
    const opt = (text, correct = false) => ({ text, correct });
    expect(validateQuestion({ kind: 'qcm', prompt: 'Q ?', options: [opt('A', true)] })).toMatch(/2 propositions/);
    expect(validateQuestion({ kind: 'qcm', prompt: 'Q ?', options: [opt('A'), opt('B')] })).toMatch(/bonne réponse/);
    expect(validateQuestion({ kind: 'qcm', prompt: 'Q ?', options: [opt('A', true), opt('B')] })).toBeNull();
  });
});
