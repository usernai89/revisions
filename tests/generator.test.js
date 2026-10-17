// Tests du générateur de questions (sans IA).
import { describe, it, expect } from 'vitest';
import { generateQuestions } from '../src/generators/local.js';
import { cleanText } from '../src/text.js';

const COURS = `Sémiologie cardiaque
La dyspnée est une sensation de gêne respiratoire.
Tachycardie : fréquence cardiaque supérieure à 100 battements par minute.
On parle de fièvre lorsque la température dépasse 38 °C le matin.
Les signes de l'insuffisance cardiaque gauche :
- dyspnée d'effort
- orthopnée
- toux nocturne
Exemple : un patient de 60 ans.
Il est important de bien examiner le patient.`;

describe('generateQuestions', () => {
  const qs = generateQuestions(COURS);
  const prompts = qs.map((q) => q.prompt);

  it('détecte "X est un/une ..."', () => {
    expect(prompts).toContain('Définis : La dyspnée');
  });
  it('détecte "Terme : explication"', () => {
    const q = qs.find((q) => q.term === 'Tachycardie');
    expect(q.answer).toMatch(/supérieure à 100/);
  });
  it('détecte "On parle de X lorsque"', () => {
    expect(prompts).toContain('Quand parle-t-on de fièvre ?');
  });
  it('détecte les listes à puces', () => {
    const q = qs.find((q) => q.kind === 'list');
    expect(q.prompt).toBe("Cite : Les signes de l'insuffisance cardiaque gauche");
    expect(q.answer.split('\n')).toHaveLength(3);
  });
  it('ignore "Exemple :" et les phrases commençant par "Il"', () => {
    expect(prompts.some((p) => /Exemple|^Définis : Il/.test(p))).toBe(false);
  });
});

describe('cleanText', () => {
  it('recolle les lignes coupées et garde les puces', () => {
    const raw = 'La dyspnée est une\nsensation de gêne.\n- toux\n- fièvre';
    expect(cleanText(raw)).toBe('La dyspnée est une sensation de gêne.\n- toux\n- fièvre');
  });
});

describe('listes séparées par des lignes vides', () => {
  it('détecte quand même la liste', () => {
    const qs = generateQuestions('Les causes :\n\n- infection\n\n- traumatisme');
    expect(qs[0]).toMatchObject({ kind: 'list', answer: '• infection\n• traumatisme' });
  });
});
