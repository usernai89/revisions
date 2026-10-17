// =============================================================
// methods/recall.js — J3 : Rappel actif
// =============================================================
// Tu écris de mémoire, PUIS tu vois la correction.
// L'effort de se souvenir (même raté) est ce qui ancre le mieux.
//
// Les cartes proposées :
//  - « Cite les points importants que tu as surlignés » (si tu as surligné à J0) ;
//  - les listes du cours (« Cite : ... ») ;
//  - « Explique avec tes mots : <terme> » pour les définitions ;
//  - s'il y a trop peu de cartes : « Résume la leçon de mémoire ».

import { runCards, orderQuestions } from './cards.js';

const MAX_PER_SESSION = 10;

export function run(container, { lesson, questions }, finish) {
  const cards = [];

  if (lesson.highlights?.length) {
    cards.push({
      prompt: 'Cite de mémoire les points importants que tu as surlignés.',
      answer: lesson.highlights.map((h) => `• ${h}`).join('\n'),
    });
  }

  for (const q of orderQuestions(questions)) {
    if (cards.length >= MAX_PER_SESSION) break;
    cards.push({
      prompt: q.kind === 'list' ? q.prompt : `Explique avec tes mots : ${q.term}`,
      answer: q.answer,
      questionId: q.id,
    });
  }

  if (cards.length < 2) {
    cards.push({ prompt: `Résume la leçon « ${lesson.title} » de mémoire.`, answer: lesson.text });
  }

  runCards(container, cards, {
    writeAnswer: true,
    intro: 'Écris ce dont tu te souviens AVANT de regarder la correction.',
  }, finish);
}
