// =============================================================
// methods/cards.js — Moteur commun "question → réponse → note"
// =============================================================
// Utilisé par toutes les méthodes à cartes : QROC, rappel actif,
// texte à trous, flashcards et mélange.
// Déroulé pour chaque carte :
//  1. on affiche la question (et éventuellement une zone pour écrire) ;
//  2. "Voir la réponse" ;
//  3. on se note : facile / moyen / difficile.
// À la fin, on renvoie le bilan { easy, medium, hard } via `finish`.
//
// Une carte = { prompt, answer, questionId?, promptHtml?, answerHtml? }
// - questionId permet d'enregistrer la note sur la question elle-même ;
// - promptHtml / answerHtml (facultatifs) : version déjà mise en forme
//   (ex. texte à trous), à utiliser à la place du texte simple.

import { db } from '../db.js';
import { escapeHtml } from '../ui.js';

/**
 * @param {HTMLElement} container
 * @param {Array} cards
 * @param {{ writeAnswer: boolean, intro: string, showLabel?: string, flashcard?: boolean }} options
 * @param {(result) => void} finish
 */
export function runCards(container, cards, options, finish) {
  const result = { easy: 0, medium: 0, hard: 0 };
  let index = 0;

  function showCard() {
    if (index >= cards.length) return finish(result);
    const card = cards[index];

    container.innerHTML = `
      <div class="muted">Question ${index + 1} / ${cards.length}</div>
      <div class="progress"><div style="width:${(index / cards.length) * 100}%"></div></div>
      ${index === 0 && options.intro ? `<p class="muted">${options.intro}</p>` : ''}
      <div class="card ${options.flashcard ? 'flashcard' : ''}">
        ${card.type ? `<div class="muted">${card.type}</div>` : ''}
        <div class="question">${card.promptHtml ?? escapeHtml(card.prompt)}</div>
        ${options.writeAnswer ? '<textarea id="mine" placeholder="Écris ta réponse de mémoire…"></textarea>' : ''}
        <div id="answer-zone">
          <button class="btn-primary btn-block" id="show">${options.showLabel ?? '👀 Voir la réponse'}</button>
        </div>
      </div>
    `;

    container.querySelector('#show').onclick = () => {
      container.querySelector('#answer-zone').innerHTML = `
        <div class="muted" style="margin-top:12px">Correction :</div>
        <div class="answer">${card.answerHtml ?? escapeHtml(card.answer)}</div>
        <p class="muted" style="margin-top:16px">C'était comment ?</p>
        <div class="btn-row">
          <button class="rate-easy" data-rate="easy">😀 Facile</button>
          <button class="rate-medium" data-rate="medium">😐 Moyen</button>
          <button class="rate-hard" data-rate="hard">😣 Difficile</button>
        </div>
      `;
      container.querySelectorAll('[data-rate]').forEach((btn) => {
        btn.onclick = async () => {
          const rate = btn.dataset.rate;
          result[rate]++;
          if (card.questionId) await rateQuestion(card.questionId, rate);
          index++;
          showCard();
        };
      });
    };
  }

  showCard();
}

/** Enregistre la note sur la question (servira à faire revenir plus vite les difficiles). */
async function rateQuestion(questionId, rate) {
  const q = await db.questions.get(questionId);
  if (!q) return;
  const ratings = { easy: 0, medium: 0, hard: 0, ...q.ratings };
  ratings[rate]++;
  await db.questions.update(questionId, { ratings, lastRating: rate, lastSeen: Date.now() });
}

/** Mélange une liste au hasard (algorithme de Fisher-Yates). */
export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Ordre des questions : d'abord celles notées "difficile" la dernière fois,
 * puis celles jamais vues, puis "moyen", puis "facile".
 */
export function orderQuestions(questions) {
  const weight = { hard: 0, null: 1, undefined: 1, medium: 2, easy: 3 };
  return [...questions].sort((a, b) => weight[a.lastRating] - weight[b.lastRating]);
}
