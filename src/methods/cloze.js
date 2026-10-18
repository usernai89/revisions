// =============================================================
// methods/cloze.js — J7 : Texte à trous
// =============================================================
// Des phrases du cours avec des mots-clés cachés.
// Tu cherches le mot manquant de tête, puis tu révèles la phrase complète.
// Les phrases sont choisies en priorité parmi celles que tu as surlignées.

import { generateCloze } from '../generators/cloze.js';
import { escapeHtml } from '../ui.js';
import { runCards } from './cards.js';
import * as recall from './recall.js';

/** Transforme les exercices à trous en cartes question/réponse. */
export function clozeCards(lesson, max) {
  return generateCloze(lesson.text, lesson.highlights ?? [], max, lesson.title).map(({ parts }) => ({
    type: '🧩 Texte à trous',
    // Question : les mots cachés deviennent "_____".
    promptHtml: parts
      .map((p) => (typeof p === 'string' ? escapeHtml(p) : '<span class="blank">_____</span>'))
      .join(''),
    // Réponse : la phrase complète, mots cachés mis en valeur.
    answerHtml: parts
      .map((p) => (typeof p === 'string' ? escapeHtml(p) : `<mark>${escapeHtml(p.hidden)}</mark>`))
      .join(''),
  }));
}

export function run(container, { lesson, questions }, finish) {
  const cards = clozeCards(lesson, 12);
  // Cours trop court pour faire des trous → rappel actif.
  if (!cards.length) return recall.run(container, { lesson, questions }, finish);

  runCards(container, cards, {
    writeAnswer: false,
    intro: 'Trouve le ou les mots manquants de tête, puis révèle la phrase.',
    showLabel: '👀 Révéler',
  }, finish);
}
