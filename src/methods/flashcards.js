// =============================================================
// methods/flashcards.js — Flashcards (recto / verso)
// =============================================================
// Recto : un terme (ou le titre d'une liste). Verso : sa définition (ou la liste).
// Parfois la carte est inversée : on voit la définition et il faut trouver le terme,
// ce qui oblige à se souvenir dans les deux sens.

import { escapeHtml } from '../ui.js';
import { runCards, orderQuestions } from './cards.js';
import * as recall from './recall.js';

/** Transforme les questions de la leçon en flashcards. */
export function flashcardCards(questions, max) {
  return orderQuestions(questions).slice(0, max).map((q, i) => {
    // Une définition sur deux est inversée (sauf les listes, inversables difficilement).
    const reversed = q.kind === 'definition' && i % 2 === 1;
    if (reversed) {
      // On cache le terme dans la définition pour ne pas donner la réponse.
      const hint = q.answer.replace(new RegExp(escapeRegExp(q.term), 'gi'), '…');
      return {
        type: '🃏 Flashcard · retrouve le terme',
        prompt: hint,
        answerHtml: `<strong>${escapeHtml(withoutArticle(q.term))}</strong>`,
        questionId: q.id,
      };
    }
    return {
      type: '🃏 Flashcard',
      promptHtml: `<strong>${escapeHtml(q.kind === 'list' ? q.term : withoutArticle(q.term))}</strong>`,
      answer: q.answer,
      questionId: q.id,
    };
  });
}

/** "La dyspnée" → "Dyspnée", "L'orthopnée" → "Orthopnée" (plus lisible sur une carte). */
export function withoutArticle(term) {
  const bare = term.replace(/^(le|la|les|l['’]|un|une|des)\s*/i, '');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function run(container, { lesson, questions }, finish) {
  const cards = flashcardCards(questions, 15);
  if (!cards.length) return recall.run(container, { lesson, questions }, finish);

  runCards(container, cards, {
    writeAnswer: false,
    flashcard: true,
    intro: 'Pense à la réponse, puis retourne la carte.',
    showLabel: '🔄 Retourner la carte',
  }, finish);
}
