// Tests des flashcards.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { flashcardCards } from '../src/methods/flashcards.js';
import { withoutArticle } from '../src/text.js';

describe('flashcards', () => {
  it('retire l\'article du terme', () => {
    expect(withoutArticle('La dyspnée')).toBe('Dyspnée');
    expect(withoutArticle("L'orthopnée")).toBe('Orthopnée');
    expect(withoutArticle('Tachycardie')).toBe('Tachycardie');
  });
  it('inverse une carte de définition sur deux, en cachant le terme', () => {
    const qs = [
      { id: 1, kind: 'definition', term: 'La dyspnée', answer: 'La dyspnée est une gêne respiratoire.' },
      { id: 2, kind: 'definition', term: 'Tachycardie', answer: 'Tachycardie : pouls > 100.' },
    ];
    const [recto, inverse] = flashcardCards(qs, 10);
    expect(recto.promptHtml).toContain('Dyspnée');
    expect(inverse.prompt).toBe('… : pouls > 100.');
    expect(inverse.answerHtml).toContain('Tachycardie');
  });
});
