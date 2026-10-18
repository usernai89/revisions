// =============================================================
// methods/flashcards.js — Flashcards (recto / verso)
// =============================================================
// Recto : un terme (ou le titre d'une liste, ou ta question). Verso : la réponse.
// Parfois la carte est inversée : on voit la définition et il faut trouver le terme,
// ce qui oblige à se souvenir dans les deux sens.

import { escapeHtml } from '../ui.js';
import { maskTerm, withoutArticle } from '../text.js';
import { runCards, orderQuestions } from './cards.js';
import * as recall from './recall.js';

/** Transforme les questions de la leçon en flashcards. */
export function flashcardCards(questions, max) {
  const usable = orderQuestions(questions).filter((q) => q.kind !== 'qcm'); // un QCM n'a pas de verso
  return usable.slice(0, max).map((q, i) => {
    // Tes QROC : la question au recto, ta réponse au verso.
    if (q.kind === 'qroc') {
      return { type: 'Flashcard', prompt: q.prompt, answer: q.answer, context: q.context, questionId: q.id };
    }
    // Une définition sur deux est inversée (sauf les listes, inversables difficilement).
    const reversed = q.kind === 'definition' && i % 2 === 1;
    if (reversed) {
      // On cache le terme dans la définition pour ne pas donner la réponse.
      const hint = maskTerm(q.answer, q.term);
      return {
        type: 'Flashcard · retrouve le terme',
        prompt: hint,
        answerHtml: `<strong>${escapeHtml(withoutArticle(q.term))}</strong>`,
        questionId: q.id,
      };
    }
    return {
      type: 'Flashcard',
      promptHtml: `<strong>${escapeHtml(q.kind === 'list' ? q.term : withoutArticle(q.term))}</strong>`,
      answer: q.answer,
      questionId: q.id,
    };
  });
}

export function run(container, { lesson, questions }, finish) {
  const cards = flashcardCards(questions, 15);
  if (!cards.length) return recall.run(container, { lesson, questions }, finish);

  runCards(container, cards, {
    writeAnswer: false,
    flashcard: true,
    intro: 'Pense à la réponse, puis retourne la carte.',
    showLabel: 'Retourner la carte',
  }, finish);
}
