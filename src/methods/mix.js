// =============================================================
// methods/mix.js — J14 et plus : Mélange
// =============================================================
// Pour les révisions espacées, on varie les exercices :
// flashcards + textes à trous + questions, mélangés au hasard.
// Les questions notées "difficile" passent en priorité.
// (Les cas cliniques viendront avec tes propres questions ou une IA.)

import { runCards, shuffle } from './cards.js';
import { flashcardCards } from './flashcards.js';
import { clozeCards } from './cloze.js';
import * as recall from './recall.js';

const MAX_PER_SESSION = 15;

export function run(container, { lesson, questions }, finish) {
  // Moitié flashcards (sur les questions), moitié textes à trous.
  const flash = flashcardCards(questions, Math.ceil(MAX_PER_SESSION / 2));
  const cloze = clozeCards(lesson, MAX_PER_SESSION - flash.length);
  const cards = shuffle([...flash, ...cloze]);

  if (!cards.length) return recall.run(container, { lesson, questions }, finish);

  runCards(container, cards, {
    writeAnswer: false,
    intro: 'Révision mélangée : flashcards et textes à trous.',
  }, finish);
}
