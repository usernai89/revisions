// =============================================================
// methods/mix.js — J14 et plus : Mélange
// =============================================================
// Pour les révisions espacées, on varie les exercices, mélangés au hasard :
//  - tes cas cliniques (questions avec un énoncé) et tes QCM ;
//  - des flashcards ;
//  - des textes à trous.
// Les questions notées "difficile" passent en priorité.

import { runCards, orderQuestions } from './cards.js';
import { flashcardCards } from './flashcards.js';
import { clozeCards } from './cloze.js';
import { shuffle, toQuestionCard } from '../generators/qcm.js';
import * as recall from './recall.js';

const MAX_PER_SESSION = 15;
const MAX_USER_CARDS = 6; // cas cliniques + QCM

export function run(container, { lesson, questions, subjectTerms }, finish) {
  // 1. Tes cas cliniques et tes QCM (posés tels quels).
  const userPicked = orderQuestions(questions)
    .filter((q) => q.source === 'user' && (q.context || q.kind === 'qcm'))
    .slice(0, MAX_USER_CARDS);
  const userCards = userPicked.map((q) => toQuestionCard(q, subjectTerms));

  // 2. Des flashcards sur les autres questions, 3. des textes à trous pour compléter.
  const others = questions.filter((q) => !userPicked.includes(q));
  const flash = flashcardCards(others, Math.ceil((MAX_PER_SESSION - userCards.length) / 2));
  const cloze = clozeCards(lesson, MAX_PER_SESSION - userCards.length - flash.length);
  const cards = shuffle([...userCards, ...flash, ...cloze]);

  if (!cards.length) return recall.run(container, { lesson, questions }, finish);

  runCards(container, cards, {
    writeAnswer: false,
    intro: 'Révision mélangée : cas cliniques, QCM, flashcards et textes à trous.',
  }, finish);
}
