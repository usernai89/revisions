// @vitest-environment jsdom
// Tests de l'import Word et PowerPoint, sur de vrais fichiers d'exemple.
// ("jsdom" simule le navigateur, car on utilise DOMParser.)
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractText } from '../src/import/index.js';
import { generateQuestions } from '../src/generators/local.js';

const fixture = (name) => new File([readFileSync(join(process.cwd(), 'tests/fixtures', name))], name);

describe('import Word (.docx)', () => {
  let text;
  beforeAll(async () => { text = await extractText(fixture('cours.docx')); });

  it('garde les titres, paragraphes et tableaux', () => {
    expect(text).toContain('Sémiologie respiratoire');
    expect(text).toContain('La dyspnée est une sensation de gêne respiratoire.');
    expect(text).toContain('Fréquence | 16/min');
  });
  it('transforme les listes en puces reconnues par le générateur', () => {
    expect(text).toContain('- asthme');
    const list = generateQuestions(text).find((q) => q.kind === 'list');
    expect(list.prompt).toBe('Cite : Les causes de toux chronique');
    expect(list.answer.split('\n')).toHaveLength(3);
  });
});

describe('import PowerPoint (.pptx)', () => {
  let text;
  beforeAll(async () => { text = await extractText(fixture('cours.pptx')); });

  it('lit les diapositives dans l\'ordre, avec les notes', () => {
    expect(text.indexOf('Anatomie du cœur')).toBeLessThan(text.indexOf('Les cavités cardiaques'));
    expect(text).toContain('Le myocarde est le muscle du cœur.');
  });
  it('titre + puces → liste à citer', () => {
    const list = generateQuestions(text).find((q) => q.kind === 'list');
    expect(list.prompt).toBe('Cite : Les cavités cardiaques');
    expect(list.answer.split('\n')).toHaveLength(4);
  });
});

describe('formats non pris en charge', () => {
  it('explique quoi faire pour un ancien .doc', () => {
    expect(() => extractText(new File(['x'], 'vieux.doc'))).toThrow(/\.docx/);
  });
});
