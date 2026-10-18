// =============================================================
// generators/qcm.js — Choisir QCM ou QROC, et fabriquer les QCM sans IA
// =============================================================
// Pour chaque question, l'appli choisit le format le plus adapté :
//
//  - TES questions : on respecte ton choix (QCM ou QROC) ;
//  - une LISTE à citer ("Cite : ...") : QROC, car il faut restituer
//    plusieurs éléments, un QCM serait trop facile ;
//  - une DÉFINITION : QCM si on trouve au moins 3 autres termes de la même
//    matière pour servir de mauvaises réponses ("distracteurs") ;
//    sinon QROC.
//
// Le QCM automatique montre la définition (avec le terme caché)
// et demande : « Quel terme correspond à cette définition ? »

import { maskTerm, withoutArticle } from '../text.js';

const DISTRACTORS = 3;

/**
 * Transforme une question de la base en "carte" prête à être posée.
 * @param {object} q — la question
 * @param {string[]} subjectTerms — termes définis dans toute la matière
 * @param {() => number} random — tirage au sort (remplaçable dans les tests)
 * @returns {object} carte : { prompt, answer, questionId, context?, options?, explanation? }
 */
export function toQuestionCard(q, subjectTerms = [], random = Math.random) {
  const base = { questionId: q.id, context: q.context };

  if (q.kind === 'qcm') {
    return { ...base, type: 'QCM', prompt: q.prompt, options: q.options, explanation: q.explanation };
  }
  if (q.kind === 'qroc') {
    return { ...base, type: 'QROC', prompt: q.prompt, answer: q.answer };
  }

  if (q.kind === 'definition') {
    const term = withoutArticle(q.term);
    const others = uniqueTerms(subjectTerms).filter((t) => t.toLowerCase() !== term.toLowerCase());
    if (others.length >= DISTRACTORS) {
      const wrong = pick(others, DISTRACTORS, random);
      const options = shuffle([
        { text: term, correct: true },
        ...wrong.map((text) => ({ text, correct: false })),
      ], random);
      return {
        ...base,
        type: 'QCM',
        prompt: `Quel terme correspond à : « ${maskTerm(q.answer, q.term)} » ?`,
        options,
        explanation: q.answer,
      };
    }
  }

  // Liste à citer, ou définition sans assez de distracteurs : QROC.
  return { ...base, type: 'QROC', prompt: q.prompt, answer: q.answer };
}

/** Termes sans article ni doublon : ["Dyspnée", "Orthopnée", ...]. */
function uniqueTerms(terms) {
  const seen = new Map();
  for (const t of terms) {
    const clean = withoutArticle(t);
    if (!seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean);
  }
  return [...seen.values()];
}

/** Tire `n` éléments au hasard. */
function pick(list, n, random) {
  return shuffle(list, random).slice(0, n);
}

/** Mélange une liste (algorithme de Fisher-Yates). */
export function shuffle(list, random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Corrige un QCM.
 * @param {Array<{correct: boolean}>} options
 * @param {Set<number>} selected — indices des options cochées
 * @returns {{ perfect: boolean, errors: number }} errors = cases mal cochées + bonnes réponses oubliées
 */
export function gradeQcm(options, selected) {
  let errors = 0;
  options.forEach((opt, i) => {
    if (opt.correct !== selected.has(i)) errors++;
  });
  return { perfect: errors === 0, errors };
}
