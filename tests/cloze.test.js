// Tests du générateur de textes à trous.
import { describe, it, expect } from 'vitest';
import { generateCloze, makeCloze } from '../src/generators/cloze.js';

/** Recompose la phrase avec des trous "___" (pour lire les tests facilement). */
const show = (ex) => ex.parts.map((p) => (typeof p === 'string' ? p : '___')).join('');
const hidden = (ex) => ex.parts.filter((p) => typeof p !== 'string').map((p) => p.hidden);

describe('makeCloze', () => {
  it('cache en priorité les nombres', () => {
    const ex = makeCloze('La tachycardie correspond à une fréquence supérieure à 100 par minute.');
    expect(hidden(ex)).toEqual(['100']);
    expect(show(ex)).toBe('La tachycardie correspond à une fréquence supérieure à ___ par minute.');
  });
  it('cache les sigles', () => {
    const ex = makeCloze("L'HTA est un facteur de risque majeur.");
    expect(hidden(ex)).toEqual(['HTA']);
  });
  it('sinon cache le terme le plus technique', () => {
    const ex = makeCloze("L'orthopnée est une dyspnée en position couchée.");
    expect(hidden(ex)).toEqual(['orthopnée']);
    expect(show(ex)).toBe("L'___ est une dyspnée en position couchée.");
  });
  it('ne cache jamais les petits mots', () => {
    expect(makeCloze('il y a et de la')).toBeNull();
  });
});

describe('generateCloze', () => {
  const text = [
    'Introduction générale au cours de cardiologie.',
    'Le souffle cardiaque peut être entendu au stéthoscope.',
    'La dyspnée est une sensation de gêne respiratoire.',
  ].join('\n');

  it('commence par les phrases surlignées, puis les définitions', () => {
    const exs = generateCloze(text, ['Le souffle cardiaque peut être entendu au stéthoscope.']);
    expect(show(exs[0])).toContain('souffle');
    expect(show(exs[1])).toContain('sensation de gêne');
  });
  it('respecte le nombre maximum', () => {
    expect(generateCloze(text, [], 1)).toHaveLength(1);
  });
});

describe('mots du titre', () => {
  it('évite de cacher les mots du titre de la leçon', () => {
    const [ex] = generateCloze("L'HTA est la première cause d'insuffisance cardiaque gauche.", [], 1, 'Insuffisance cardiaque');
    expect(hidden(ex)).toEqual(['HTA']);
  });
});
