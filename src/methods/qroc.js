// =============================================================
// methods/qroc.js — J1 : QCM ou QROC
// =============================================================
// L'appli choisit le format le plus adapté pour chaque question
// (voir generators/qcm.js) :
//  - tes propres QCM et QROC tels que tu les as écrits ;
//  - les définitions en QCM (quand la matière contient assez d'autres termes) ;
//  - les listes à citer en QROC.

import { runCards, orderQuestions } from './cards.js';
import { toQuestionCard } from '../generators/qcm.js';
import * as recall from './recall.js';

const MAX_PER_SESSION = 15;

export function run(container, { lesson, questions, subjectTerms }, finish) {
  // Pas de question pour ce cours → on bascule sur le rappel actif.
  if (!questions.length) return recall.run(container, { lesson, questions }, finish);

  const cards = orderQuestions(questions)
    .slice(0, MAX_PER_SESSION)
    .map((q) => toQuestionCard(q, subjectTerms));

  runCards(container, cards, {
    writeAnswer: false,
    intro: 'Réponds de tête, puis vérifie. Pour les QCM, coche puis valide.',
  }, finish);
}
