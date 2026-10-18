// =============================================================
// generators/cloze.js — Génération de textes à trous SANS IA
// =============================================================
// Idée : on prend des phrases du cours et on cache 1 ou 2 mots-clés.
//
// Comment choisir les phrases ?
//  1. d'abord celles que tu as surlignées (tu les as jugées importantes) ;
//  2. puis les phrases de définition (« X est un… », « X : … ») ;
//  3. puis les autres phrases de longueur moyenne.
//
// Comment choisir le mot à cacher ? On donne des points à chaque mot :
//  - les nombres (38, 100, 3/4…)       → souvent ce qu'il faut retenir ;
//  - les mots longs (termes médicaux)   → « tachycardie », « orthopnée »… ;
//  - les mots qui reviennent plusieurs fois dans le cours (thème central) ;
//  - les mots qui commencent par une majuscule au milieu d'une phrase (noms propres) ;
//  - jamais les petits mots courants (le, de, avec, est…) ;
//  - presque jamais les mots du titre de la leçon (trop faciles à deviner).

import { splitSentences, countWords, BULLET_RE } from '../text.js';

// Mots trop courants pour être des mots-clés.
const STOP_WORDS = new Set(`
  alors aussi autre autres avant avec avoir beaucoup bien cela celle celles celui cependant
  certains ces cette ceux chez comme comment dans depuis donc dont elle elles encore entre
  être fait faire peut peuvent leur leurs lors lorsque mais même moins notamment nous
  parce pendant peu plus plusieurs pour pourquoi quand quel quelle quelles quels
  quelque sans selon sera seront sont sous souvent surtout tandis tous tout toute toutes
  très trop une vers votre vous ainsi après assez avoir deux trois être était sont
  chaque contre exemple niveau partie points point type types patient patients
`.split(/\s+/).filter(Boolean));

const MAX_SENTENCES = 12;

/**
 * Génère des textes à trous.
 * @param {string} text — le texte de la leçon
 * @param {string[]} highlights — les phrases surlignées pendant la lecture
 * @param {number} max — nombre maximum d'exercices
 * @param {string} title — titre de la leçon (ses mots sont trop évidents pour être cachés)
 * @returns {Array<{ parts: Array<string | {hidden: string}> }>}
 *   Chaque exercice est une liste de morceaux : du texte visible
 *   ou un mot caché { hidden: 'mot' }.
 */
export function generateCloze(text, highlights = [], max = MAX_SENTENCES, title = '') {
  const frequencies = wordFrequencies(text);
  const obvious = new Set(wordFrequencies(title).keys());

  // Toutes les phrases du cours (sans les puces), avec une priorité.
  const highlighted = new Set(highlights);
  const candidates = [];
  for (const line of text.split('\n')) {
    for (const sentence of splitSentences(line.replace(BULLET_RE, ''))) {
      const words = countWords(sentence);
      if (words < 5 || words > 45) continue;
      let priority = 0;
      if (highlighted.has(sentence)) priority = 3;
      else if (/\s(est|sont|correspond|désigne|se définit)\s|^[^:]{2,60}:\s/i.test(sentence)) priority = 2;
      else priority = 1;
      candidates.push({ sentence, priority });
    }
  }

  // Les plus prioritaires d'abord (à priorité égale, on garde l'ordre du cours).
  candidates.sort((a, b) => b.priority - a.priority);

  const exercises = [];
  const seen = new Set();
  for (const { sentence } of candidates) {
    if (exercises.length >= max) break;
    if (seen.has(sentence)) continue;
    seen.add(sentence);
    const exercise = makeCloze(sentence, frequencies, obvious);
    if (exercise) exercises.push(exercise);
  }
  return exercises;
}

/**
 * Cache 1 mot-clé (ou 2 si la phrase est longue) dans une phrase.
 * Renvoie null si aucun mot ne mérite d'être caché.
 */
export function makeCloze(sentence, frequencies = wordFrequencies(sentence), obvious = new Set()) {
  // On découpe en "mots" et "tout le reste" (espaces, ponctuation) pour pouvoir recoller.
  const tokens = sentence.split(/([\p{L}\p{N}][\p{L}\p{N}\-/,.]*[\p{L}\p{N}]|[\p{L}\p{N}])/u);

  const scored = [];
  tokens.forEach((token, i) => {
    if (i % 2 === 0) return; // les indices pairs sont les séparateurs
    const score = scoreWord(token, i === 1, frequencies, obvious);
    if (score > 0) scored.push({ i, score });
  });
  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  const howMany = countWords(sentence) > 18 ? 2 : 1;
  const hide = new Set(scored.slice(0, howMany).map((s) => s.i));

  const parts = [];
  tokens.forEach((token, i) => {
    if (!token) return;
    if (hide.has(i)) parts.push({ hidden: token });
    else if (typeof parts[parts.length - 1] === 'string') parts[parts.length - 1] += token;
    else parts.push(token);
  });
  return { parts };
}

/** Points d'un mot (0 = à ne jamais cacher). */
function scoreWord(word, isFirst, frequencies, obvious) {
  const lower = word.toLowerCase();
  if (STOP_WORDS.has(lower)) return 0;
  if (obvious.has(lower)) return 0.5; // mot du titre : seulement s'il n'y a rien de mieux

  // Nombres : très importants à retenir (seuils, doses, fréquences…).
  if (/^\d/.test(word)) return 8;

  // Sigles (ex. HTA, ECG, AVC) : à retenir aussi.
  if (/^\p{Lu}{2,}$/u.test(word)) return 7;

  if (word.length < 5) return 0;

  let score = Math.min(word.length, 14) / 2; // les mots longs sont souvent des termes techniques
  const freq = frequencies.get(lower) ?? 1;
  if (freq >= 2 && freq <= 8) score += 2; // mot du thème de la leçon
  if (!isFirst && /^\p{Lu}/u.test(word)) score += 1; // nom propre
  return score;
}

/** Compte combien de fois chaque mot apparaît dans le texte. */
export function wordFrequencies(text) {
  const map = new Map();
  for (const w of text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) || []) {
    map.set(w, (map.get(w) ?? 0) + 1);
  }
  return map;
}
