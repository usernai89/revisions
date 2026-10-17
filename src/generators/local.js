// =============================================================
// generators/local.js — Génération de questions SANS IA
// =============================================================
// On parcourt le texte du cours et on repère des structures typiques :
//
//  1. "Terme : explication"              → « Définis : Terme »
//  2. "Le terme est un/une/le/la ..."    → « Définis : Le terme »
//     (aussi : correspond à, désigne, se définit comme, consiste en/à...)
//  3. "On parle de X lorsque ..."        → « Quand parle-t-on de X ? »
//  4. Une ligne finissant par ":" suivie
//     d'au moins 2 lignes à puces        → « Cite : <titre de la liste> »
//
// Chaque question générée a la forme :
//   { kind: 'definition' | 'list', term, prompt, answer }
//
// C'est volontairement simple : ça ne vaut pas une IA, mais c'est gratuit,
// instantané et ça marche hors ligne.

import { BULLET_RE, countWords, splitSentences } from '../text.js';

// Mots qui ressemblent à "Terme :" mais qui ne sont pas des définitions.
const NOT_TERMS = /^(exemples?|ex|remarques?|nb|n\.b|note|attention|rappel|définition|source|figure|fig|tableau|page|chapitre|partie|objectifs?|plan|introduction|conclusion|résumé|question|réponse|cas|à retenir)$/i;

// Verbes de définition (après le terme).
const DEF_VERBS =
  /^(.{2,80}?)\s+(est|sont)\s+((?:un|une|le|la|l['’]|les|des|du|l['’]ensemble)\b.*)$|^(.{2,80}?)\s+(correspond(?:ent)? à|désigne(?:nt)?|se défini(?:t|ssent) (?:comme|par)|consiste(?:nt)? (?:en|à)|représente(?:nt)?|signifie(?:nt)?)\s+(.+)$/i;

const MAX_QUESTIONS = 40;

/** Génère la liste des questions à partir du texte d'une leçon. */
export function generateQuestions(text) {
  const lines = text.split('\n').map((l) => l.trim());
  const questions = [];
  const seen = new Set(); // évite les doublons

  const add = (q) => {
    const key = q.term.toLowerCase();
    if (seen.has(key) || questions.length >= MAX_QUESTIONS) return;
    seen.add(key);
    questions.push(q);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // --- 4. Listes : "Titre :" puis des puces ---
    if (line.endsWith(':') && countWords(line) <= 15) {
      const items = [];
      let j = i + 1;
      // On accepte des lignes vides entre les puces (fréquent dans les PDF).
      while (j < lines.length && (BULLET_RE.test(lines[j]) || (!lines[j] && BULLET_RE.test(lines[j + 1] ?? '')))) {
        if (lines[j]) items.push(lines[j].replace(BULLET_RE, '').trim());
        j++;
      }
      if (items.length >= 2) {
        const title = line.replace(/\s*:$/, '').replace(BULLET_RE, '');
        add({
          kind: 'list',
          term: title,
          prompt: `Cite : ${title}`,
          answer: items.map((it) => `• ${it}`).join('\n'),
        });
        continue;
      }
    }

    // Une ligne à puce : on enlève la puce avant d'analyser.
    const content = line.replace(BULLET_RE, '');

    // --- 1. "Terme : explication" ---
    const colon = content.match(/^([^:]{2,60}?)\s*:\s+(.{8,})$/);
    if (colon) {
      const term = colon[1].trim();
      const words = countWords(term);
      if (words >= 1 && words <= 6 && !NOT_TERMS.test(term) && countWords(colon[2]) >= 3) {
        add({ kind: 'definition', term, prompt: `Définis : ${term}`, answer: colon[2].trim() });
        continue;
      }
    }

    // --- 2. et 3. On regarde chaque phrase ---
    for (const sentence of splitSentences(content)) {
      const s = sentence.replace(/[.;]$/, '');

      const onParle = s.match(/^On parle (?:de |d['’])(.{2,60}?)\s+(lorsqu(?:e\s+|['’])|quand\s+|si\s+|en cas de\s+)(.+)$/i);
      if (onParle) {
        add({
          kind: 'definition',
          term: onParle[1],
          prompt: `Quand parle-t-on de ${onParle[1]} ?`,
          answer: sentence,
        });
        continue;
      }

      const def = s.match(DEF_VERBS);
      if (def) {
        const term = (def[1] || def[4]).trim();
        // Le sujet doit rester court (sinon c'est une phrase quelconque).
        if (countWords(term) <= 8 && !/^(il|elle|ils|elles|ce|cela|ceci|c['’]|on|qui|dont|cette|cet)\b/i.test(term)) {
          add({ kind: 'definition', term, prompt: `Définis : ${term}`, answer: sentence });
        }
      }
    }
  }
  return questions;
}
