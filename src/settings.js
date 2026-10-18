// =============================================================
// settings.js — Les réglages de l'appli
// =============================================================
// Les réglages sont enregistrés dans la table "settings" de la base.
// Si un réglage n'a jamais été modifié, on utilise la valeur par défaut.

import { db } from './db.js';

export const DEFAULT_SETTINGS = {
  // Jours après la création de la leçon : J0, J1, J3, J7, J14, J30.
  intervals: [0, 1, 3, 7, 14, 30],

  // Méthode utilisée à chaque étape (même ordre que "intervals").
  // Valeurs possibles : voir METHOD_LABELS dans ui.js
  // ('reading', 'qroc', 'recall', 'cloze', 'flashcards', 'mix').
  methods: ['reading', 'qroc', 'recall', 'cloze', 'mix', 'mix'],

  // 'dark' (sombre) ou 'light' (clair).
  theme: 'dark',
};

/** Lit tous les réglages (valeurs enregistrées + valeurs par défaut). */
export async function getSettings() {
  const rows = await db.settings.toArray();
  const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...saved };
}

/** Enregistre un réglage. */
export function saveSetting(key, value) {
  return db.settings.put({ key, value });
}

/** Applique le thème (sombre/clair) à la page. */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f5f6fa' : '#12151c';
}
