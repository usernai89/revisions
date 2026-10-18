// =============================================================
// screens/settings.js — Réglages
// =============================================================
// - Thème (sombre / clair)
// - Étapes de révision : pour chaque étape, le jour (J0, J1, J3…) et la méthode.
// D'autres réglages arriveront (temps par jour, sauvegarde…).

import { getSettings, saveSetting, applyTheme, DEFAULT_SETTINGS } from '../settings.js';
import { escapeHtml, toast, METHOD_LABELS, METHOD_ICONS } from '../ui.js';

export async function render(app) {
  const s = await getSettings();

  // Copie de travail des étapes : [{ day, method }, ...]
  let steps = s.intervals.map((day, i) => ({
    day,
    method: s.methods[i] ?? s.methods[s.methods.length - 1] ?? 'recall',
  }));

  app.innerHTML = `
    <h1>Réglages</h1>

    <h2>Apparence</h2>
    <div class="segmented" id="theme">
      <button data-theme="dark" class="${s.theme === 'dark' ? 'active' : ''}">🌙 Sombre</button>
      <button data-theme="light" class="${s.theme === 'light' ? 'active' : ''}">☀️ Clair</button>
    </div>

    <h2>Étapes de révision</h2>
    <p class="muted">Pour chaque étape : le jour (après l'ajout de la leçon) et la méthode utilisée.</p>
    <div id="steps"></div>
    <button id="add-step" class="btn-block">＋ Ajouter une étape</button>
    <div class="btn-row">
      <button id="reset">Par défaut</button>
      <button id="save" class="btn-primary">💾 Enregistrer</button>
    </div>
    <p class="muted">Les changements s'appliquent aux prochaines révisions.</p>

    <h2>À propos</h2>
    <p class="muted">Toutes tes données restent sur ce téléphone. L'appli fonctionne hors ligne.</p>
  `;

  const stepsEl = app.querySelector('#steps');

  /** Affiche une ligne par étape : [J __] [méthode ▾] [🗑️] */
  function drawSteps() {
    const options = Object.keys(METHOD_LABELS);
    stepsEl.innerHTML = steps.map((step, i) => `
      <div class="step-row" data-i="${i}">
        <input class="day" type="number" min="0" inputmode="numeric" value="${step.day}"
          aria-label="Jour de l'étape ${i + 1}" ${i === 0 ? 'readonly' : ''} />
        <select aria-label="Méthode de l'étape ${i + 1}">
          ${options.map((m) => `<option value="${m}" ${m === step.method ? 'selected' : ''}>
            ${METHOD_ICONS[m]} ${escapeHtml(METHOD_LABELS[m])}</option>`).join('')}
        </select>
        <button class="btn-danger" aria-label="Supprimer l'étape" ${i === 0 ? 'disabled' : ''}>🗑️</button>
      </div>`).join('');
  }
  drawSteps();

  // Les modifications sont recopiées dans `steps` au fur et à mesure.
  stepsEl.addEventListener('input', (e) => {
    const i = Number(e.target.closest('.step-row').dataset.i);
    if (e.target.matches('.day')) steps[i].day = e.target.value === '' ? NaN : Number(e.target.value);
    if (e.target.matches('select')) steps[i].method = e.target.value;
  });
  stepsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    steps.splice(Number(btn.closest('.step-row').dataset.i), 1);
    drawSteps();
  });

  app.querySelector('#add-step').onclick = () => {
    const last = steps[steps.length - 1];
    steps.push({ day: last.day * 2 || 1, method: 'mix' }); // ex. J30 → J60
    drawSteps();
  };

  app.querySelector('#reset').onclick = () => {
    steps = DEFAULT_SETTINGS.intervals.map((day, i) => ({ day, method: DEFAULT_SETTINGS.methods[i] }));
    drawSteps();
  };

  app.querySelector('#save').onclick = async () => {
    const error = validateSteps(steps);
    if (error) return toast(`⚠️ ${error}`);
    await saveSetting('intervals', steps.map((st) => st.day));
    await saveSetting('methods', steps.map((st) => st.method));
    toast('Étapes enregistrées');
  };

  app.querySelectorAll('#theme button').forEach((btn) => {
    btn.onclick = async () => {
      await saveSetting('theme', btn.dataset.theme);
      applyTheme(btn.dataset.theme);
      render(app);
    };
  });
}

/**
 * Vérifie les étapes. Renvoie un message d'erreur, ou null si tout va bien.
 * Règles : au moins 2 étapes, la première à J0, des jours entiers croissants.
 */
export function validateSteps(steps) {
  if (steps.length < 2) return 'Il faut au moins 2 étapes.';
  if (steps[0].day !== 0) return 'La première étape doit être J0.';
  for (let i = 1; i < steps.length; i++) {
    const day = steps[i].day;
    if (!Number.isInteger(day) || day < 0) return `Jour invalide à l'étape ${i + 1}.`;
    if (day <= steps[i - 1].day) return `Les jours doivent augmenter (étape ${i + 1}).`;
  }
  return null;
}
