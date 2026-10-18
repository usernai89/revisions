// =============================================================
// methods/cards.js — Moteur commun "question → réponse → note"
// =============================================================
// Utilisé par toutes les méthodes à cartes : QCM/QROC, rappel actif,
// texte à trous, flashcards et mélange.
//
// Déroulé pour chaque carte :
//  1. on affiche la question (+ l'énoncé du cas clinique s'il y en a un) ;
//  2. QROC / flashcard : "Voir la réponse"
//     QCM : on coche une ou plusieurs options, puis "Valider" → correction ;
//  3. on se note : facile / moyen / difficile.
// À la fin, on renvoie le bilan { easy, medium, hard } via `finish`.
//
// Une carte = {
//   prompt, answer,            texte de la question et de la réponse
//   promptHtml?, answerHtml?   version déjà mise en forme (ex. texte à trous)
//   type?                      petit libellé ("QCM", "Texte à trous"…)
//   context?                   énoncé de cas clinique, affiché au-dessus
//   options?, explanation?     pour un QCM : [{ text, correct }] et l'explication
//   questionId?                pour enregistrer la note sur la question
// }

import { db } from '../db.js';
import { escapeHtml } from '../ui.js';
import { gradeQcm } from '../generators/qcm.js';

const LETTERS = 'ABCDEFGH';

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
    const isQcm = Array.isArray(card.options);

    container.innerHTML = `
      ${track(index, cards.length)}
      ${index === 0 && options.intro ? `<p class="hint">${options.intro}</p>` : ''}
      <article class="q-card ${options.flashcard ? 'flash' : ''}">
        ${card.type ? `<div class="q-type">${card.type}</div>` : ''}
        ${card.context ? `<div class="context"><div class="context-label">Cas clinique</div>${escapeHtml(card.context)}</div>` : ''}
        <div class="question">${card.promptHtml ?? escapeHtml(card.prompt)}</div>
        ${isQcm ? qcmOptions(card) : ''}
        ${options.writeAnswer && !isQcm ? '<textarea id="mine" placeholder="Écris ta réponse de mémoire…"></textarea>' : ''}
        <div id="answer-zone">
          ${isQcm
            ? '<button class="btn btn-go btn-block" id="validate" disabled>Valider</button>'
            : `<button class="btn btn-go btn-block" id="show">${options.showLabel ?? 'Voir la réponse'}</button>`}
        </div>
      </article>
    `;

    if (isQcm) setupQcm(card);
    else container.querySelector('#show').onclick = () => reveal(card, null);
  }

  /** QCM : cocher / décocher les options, puis valider. */
  function setupQcm(card) {
    const selected = new Set();
    const validate = container.querySelector('#validate');
    container.querySelectorAll('.opt').forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        if (selected.has(i)) selected.delete(i);
        else selected.add(i);
        btn.classList.toggle('selected');
        btn.setAttribute('aria-pressed', selected.has(i));
        validate.disabled = selected.size === 0;
      };
    });
    validate.onclick = () => {
      const grade = gradeQcm(card.options, selected);
      // Correction affichée sur chaque option.
      container.querySelectorAll('.opt').forEach((btn) => {
        const i = Number(btn.dataset.i);
        const opt = card.options[i];
        btn.disabled = true;
        if (opt.correct && selected.has(i)) btn.classList.add('right');
        else if (!opt.correct && selected.has(i)) btn.classList.add('wrong');
        else if (opt.correct) btn.classList.add('missed');
      });
      reveal(card, grade);
    };
  }

  /** Affiche la correction et les boutons de note. */
  function reveal(card, grade) {
    // Pour un QCM, on suggère une note selon le résultat (tu restes libre).
    const suggested = !grade ? null : grade.perfect ? 'easy' : grade.errors === 1 ? 'medium' : 'hard';
    const verdict = !grade ? '' : grade.perfect
      ? '<div class="verdict ok">Tout juste</div>'
      : `<div class="verdict ko">${grade.errors} erreur${grade.errors > 1 ? 's' : ''}</div>`;
    const correction = card.answerHtml ?? (card.answer ? escapeHtml(card.answer) : '');
    const explanation = card.explanation ? escapeHtml(card.explanation) : '';

    container.querySelector('#answer-zone').innerHTML = `
      ${verdict}
      ${correction ? `<div class="answer"><div class="answer-label">Correction</div>${correction}</div>` : ''}
      ${explanation ? `<div class="answer"><div class="answer-label">Explication</div>${explanation}</div>` : ''}
      <div class="rate-label">C'était comment ?</div>
      <div class="rate">
        ${rateButton('easy', 'Facile', suggested)}
        ${rateButton('medium', 'Moyen', suggested)}
        ${rateButton('hard', 'Difficile', suggested)}
      </div>
    `;
    container.querySelectorAll('[data-rate]').forEach((btn) => {
      btn.onclick = async () => {
        const rate = btn.dataset.rate;
        result[rate]++;
        if (card.questionId) await rateQuestion(card.questionId, rate, grade);
        index++;
        showCard();
      };
    });
    container.querySelector('#answer-zone').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showCard();
}

/** Les options d'un QCM : A, B, C… à toucher. */
function qcmOptions(card) {
  return `
    <div class="hint">Une ou plusieurs bonnes réponses</div>
    <div class="options">
      ${card.options.map((opt, i) => `
        <button class="opt" data-i="${i}" aria-pressed="false">
          <span class="opt-letter">${LETTERS[i]}</span>
          <span class="opt-text">${escapeHtml(opt.text)}</span>
        </button>`).join('')}
    </div>`;
}

function rateButton(rate, label, suggested) {
  return `<button class="btn-rate ${rate} ${suggested === rate ? 'suggested' : ''}" data-rate="${rate}">
    <span class="lamp"></span>${label}</button>`;
}

/**
 * Le trajet de la séance : une station par question.
 * Stations passées pleines, station actuelle qui clignote, suivantes vides.
 */
function track(index, total) {
  const stops = Array.from({ length: total }, (_, i) =>
    `<span class="stop ${i < index ? 'passed' : i === index ? 'here' : ''}"></span>`).join('');
  return `
    <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${index}">
      <div class="track-stops">${stops}</div>
      <div class="track-count">${index + 1}<span>/${total}</span></div>
    </div>`;
}

/** Enregistre la note (et, pour un QCM, s'il était juste) sur la question. */
async function rateQuestion(questionId, rate, grade) {
  const q = await db.questions.get(questionId);
  if (!q) return;
  const ratings = { easy: 0, medium: 0, hard: 0, ...q.ratings };
  ratings[rate]++;
  const changes = { ratings, lastRating: rate, lastSeen: Date.now() };
  if (grade) changes.lastCorrect = grade.perfect;
  await db.questions.update(questionId, changes);
}

/**
 * Ordre des questions : d'abord celles notées "difficile" la dernière fois,
 * puis celles jamais vues, puis "moyen", puis "facile".
 */
export function orderQuestions(questions) {
  const weight = { hard: 0, null: 1, undefined: 1, medium: 2, easy: 3 };
  return [...questions].sort((a, b) => weight[a.lastRating] - weight[b.lastRating]);
}
