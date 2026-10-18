// =============================================================
// ui.js — Petits outils d'affichage partagés par les écrans
// =============================================================

import { escapeHtml } from './text.js';

export { escapeHtml };

/** Nom affiché de chaque méthode de révision. */
export const METHOD_LABELS = {
  reading: 'Lecture guidée',
  qroc: 'QCM / QROC',
  recall: 'Rappel actif',
  cloze: 'Texte à trous',
  flashcards: 'Flashcards',
  mix: 'Mélange',
};

/**
 * Code court de chaque méthode, affiché comme un pictogramme de signalétique
 * (petite boîte avec 3 lettres) sur le tableau des départs.
 */
export const METHOD_CODES = {
  reading: 'LEC',
  qroc: 'QCM',
  recall: 'RAP',
  cloze: 'TRO',
  flashcards: 'FLA',
  mix: 'MIX',
};

/** Initiales d'une matière pour sa pastille de ligne : "Anatomie" → "AN". */
export function lineInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2);
  return raw.toUpperCase() || '?';
}

/** Noir ou blanc, selon ce qui se lit le mieux sur une couleur de fond. */
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#111' : '#fff';
}

/** Pastille ronde de ligne (couleur de la matière + initiales). */
export function lineBadge(subject, color, size = '') {
  return `<span class="line-badge ${size}" style="--line:${color};--line-ink:${inkOn(color)}"
    aria-label="${escapeHtml(subject?.name ?? '')}">${escapeHtml(lineInitials(subject?.name))}</span>`;
}

/** Affiche un petit message en bas de l'écran pendant quelques secondes. */
export function toast(message) {
  document.querySelectorAll('.toast').forEach((old) => old.remove()); // un seul message à la fois
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
