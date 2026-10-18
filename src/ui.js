// =============================================================
// ui.js — Petits outils d'affichage partagés par les écrans
// =============================================================

export { escapeHtml } from './text.js';

/** Nom affiché de chaque méthode de révision. */
export const METHOD_LABELS = {
  reading: 'Lecture guidée',
  qroc: 'Questions (QROC)',
  recall: 'Rappel actif',
  cloze: 'Texte à trous',
  flashcards: 'Flashcards',
  mix: 'Mélange',
};

/** Icône de chaque méthode. */
export const METHOD_ICONS = {
  reading: '📖',
  qroc: '❓',
  recall: '🧠',
  cloze: '🧩',
  flashcards: '🃏',
  mix: '🔀',
};

/** Affiche un petit message en bas de l'écran pendant quelques secondes. */
export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/** Change d'écran (ex. go('#/subjects')). */
export function go(hash) {
  location.hash = hash;
}

/** "2026-10-17" → "samedi 17 octobre". */
export function formatDateFr(dateStr, withWeekday = true) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
  });
}

/** 90 → "1 h 30", 45 → "45 min", 120 → "2 h". */
export function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Texte "en retard de 3 jours", "aujourd'hui", "demain", "dans 4 jours". */
export function relativeDay(days) {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days === -1) return 'en retard d\'1 jour';
  if (days < 0) return `en retard de ${-days} jours`;
  return `dans ${days} jours`;
}
