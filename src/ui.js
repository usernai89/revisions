// =============================================================
// ui.js — Petits outils d'affichage partagés par les écrans
// =============================================================

export { escapeHtml } from './text.js';

/** Nom affiché de chaque méthode de révision. */
export const METHOD_LABELS = {
  reading: 'Lecture guidée',
  qroc: 'Questions (QROC)',
  recall: 'Rappel actif',
};

/** Icône de chaque méthode. */
export const METHOD_ICONS = {
  reading: '📖',
  qroc: '❓',
  recall: '🧠',
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

/** Texte "en retard de 3 jours", "aujourd'hui", "demain", "dans 4 jours". */
export function relativeDay(days) {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days === -1) return 'en retard d\'1 jour';
  if (days < 0) return `en retard de ${-days} jours`;
  return `dans ${days} jours`;
}
