// =============================================================
// text.js — Outils pour manipuler le texte des cours
// =============================================================

/** Puces de liste reconnues en début de ligne : -, •, *, ▪, ◦, ►, →, 1., 1), a) ... */
export const BULLET_RE = /^\s*(?:[-–•*▪◦●○►▸→✓]|\d{1,2}[.)]|[a-zA-Z][)])\s+/;

/** Compte les mots d'un texte. */
export function countWords(text) {
  return (text.match(/\S+/g) || []).length;
}

/**
 * Nettoie un texte extrait d'un fichier :
 *  - supprime les espaces en trop ;
 *  - recolle les lignes coupées au milieu d'une phrase (fréquent dans les PDF) ;
 *  - garde les listes à puces et les titres sur leur propre ligne.
 */
export function cleanText(raw) {
  const lines = raw
    .replace(/\r/g, '')
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim());

  const out = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    const canJoin =
      line &&
      prev && // la ligne précédente existe et n'est pas vide
      !BULLET_RE.test(line) && // la nouvelle ligne n'est pas une puce
      /^[a-zàâäéèêëîïôöùûüç(,;]/.test(line) && // elle commence par une minuscule
      !/[.!?:;]$/.test(prev); // la précédente ne finit pas une phrase
    if (canJoin) {
      out[out.length - 1] = prev.endsWith('-') ? prev.slice(0, -1) + line : `${prev} ${line}`;
    } else {
      out.push(line);
    }
  }
  // Pas plus d'une ligne vide d'affilée.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Découpe une ligne en phrases.
 * On coupe après . ! ? suivis d'un espace et d'une majuscule,
 * sans couper les abréviations courantes (ex., cf., Dr., etc.).
 */
export function splitSentences(line) {
  const parts = line.split(/(?<=[.!?…])\s+(?=[A-ZÀÂÉÈÊÎÔÙÛÇ0-9«"(])/);
  const sentences = [];
  for (const part of parts) {
    const prev = sentences[sentences.length - 1];
    if (prev && /\b(?:ex|cf|Dr|Pr|etc|env|vs|fig|p|vol|n°|M|Mme)\.$/i.test(prev)) {
      sentences[sentences.length - 1] = `${prev} ${part}`;
    } else if (part.trim()) {
      sentences.push(part.trim());
    }
  }
  return sentences;
}

/**
 * Découpe un texte en blocs pour l'affichage :
 * chaque ligne non vide devient un bloc (titre, puce ou paragraphe),
 * lui-même découpé en phrases.
 */
export function toBlocks(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({
      kind: BULLET_RE.test(line) ? 'bullet' : looksLikeTitle(line) ? 'title' : 'para',
      sentences: splitSentences(line),
    }));
}

/** Une ligne courte, sans ponctuation finale, ressemble à un titre. */
export function looksLikeTitle(line) {
  const words = countWords(line);
  return words > 0 && words <= 10 && !/[.,;!?]$/.test(line) && !BULLET_RE.test(line);
}

/** Échappe le HTML pour afficher du texte sans risque. */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "La dyspnée" → "Dyspnée", "L'orthopnée" → "Orthopnée" (plus lisible sur une carte). */
export function withoutArticle(term) {
  const bare = term.replace(/^(le|la|les|l['’]|un|une|des)\s*/i, '');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * Cache un terme dans un texte (pour ne pas donner la réponse) :
 * maskTerm("La dyspnée est une gêne", "La dyspnée") → "… est une gêne".
 * On cache aussi le terme sans son article ("dyspnée").
 */
export function maskTerm(text, term) {
  const variants = [term, withoutArticle(term)].map(escapeRegExp);
  return text.replace(new RegExp(variants.join('|'), 'gi'), '…');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
