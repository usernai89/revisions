// =============================================================
// methods/qroc.js — J1 : Questions à réponse courte (QROC)
// =============================================================
// On pose les questions générées à partir des définitions et listes du cours.
// On répond dans sa tête, on regarde la réponse, puis on se note.
// (Les QCM écrits par toi arriveront dans une prochaine étape.)

import { runCards, orderQuestions } from './cards.js';
import * as recall from './recall.js';

const MAX_PER_SESSION = 15;

export function run(container, { lesson, questions }, finish) {
  // Pas de question détectée dans ce cours → on bascule sur le rappel actif.
  if (!questions.length) return recall.run(container, { lesson, questions }, finish);

  const cards = orderQuestions(questions)
    .slice(0, MAX_PER_SESSION)
    .map((q) => ({ prompt: q.prompt, answer: q.answer, questionId: q.id }));

  runCards(container, cards, {
    writeAnswer: false,
    intro: 'Réponds dans ta tête (ou à voix basse), puis regarde la réponse.',
  }, finish);
}
