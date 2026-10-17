// =============================================================
// screens/settings.js — Réglages
// =============================================================
// Pour l'instant : thème (sombre/clair) et intervalles de révision.
// D'autres réglages arriveront (méthode par étape, temps par jour, sauvegarde…).

import { getSettings, saveSetting, applyTheme, DEFAULT_SETTINGS } from '../settings.js';
import { toast } from '../ui.js';

export async function render(app) {
  const s = await getSettings();

  app.innerHTML = `
    <h1>Réglages</h1>

    <h2>Apparence</h2>
    <div class="segmented" id="theme">
      <button data-theme="dark" class="${s.theme === 'dark' ? 'active' : ''}">🌙 Sombre</button>
      <button data-theme="light" class="${s.theme === 'light' ? 'active' : ''}">☀️ Clair</button>
    </div>

    <h2>Intervalles de révision</h2>
    <p class="muted">En jours après l'ajout de la leçon, séparés par des virgules.
      Le premier doit être 0 (lecture le jour même).</p>
    <form id="intervals-form">
      <input type="text" id="intervals" inputmode="numeric" value="${s.intervals.join(', ')}" />
      <div class="btn-row">
        <button type="button" id="reset">Par défaut</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
    <p class="muted">Les changements s'appliquent aux prochaines révisions programmées.</p>

    <h2>À propos</h2>
    <p class="muted">Toutes tes données restent sur ce téléphone. L'appli fonctionne hors ligne.</p>
  `;

  app.querySelectorAll('#theme button').forEach((btn) => {
    btn.onclick = async () => {
      await saveSetting('theme', btn.dataset.theme);
      applyTheme(btn.dataset.theme);
      render(app);
    };
  });

  app.querySelector('#reset').onclick = () => {
    app.querySelector('#intervals').value = DEFAULT_SETTINGS.intervals.join(', ');
  };

  app.querySelector('#intervals-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = parseIntervals(app.querySelector('#intervals').value);
    if (!values) {
      toast('⚠️ Format invalide. Exemple : 0, 1, 3, 7, 14, 30');
      return;
    }
    await saveSetting('intervals', values);
    toast('Intervalles enregistrés');
  });
}

/**
 * "0, 1, 3, 7" → [0, 1, 3, 7].
 * Renvoie null si ce n'est pas une suite croissante de nombres commençant par 0.
 */
export function parseIntervals(input) {
  const values = input.split(/[,;\s]+/).filter(Boolean).map(Number);
  const valid =
    values.length >= 2 &&
    values[0] === 0 &&
    values.every((v, i) => Number.isInteger(v) && v >= 0 && (i === 0 || v > values[i - 1]));
  return valid ? values : null;
}
