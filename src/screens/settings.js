// =============================================================
// screens/settings.js — Réglages
// =============================================================
// - Thème (sombre / clair)
// - Temps disponible par jour (semaine / week-end)
// - Étapes de révision : pour chaque étape, le jour (J0, J1, J3…) et la méthode.
// - Sauvegarde : exporter / importer toutes les données (voir backup.js).
// - IA (facultative, désactivée par défaut) : fournisseur, clé, modèle (voir ai/index.js).

import { getSettings, saveSetting, applyTheme, DEFAULT_SETTINGS } from '../settings.js';
import { escapeHtml, toast, formatMinutes, METHOD_LABELS } from '../ui.js';
import { buildBackup, saveBackupFile, validateBackup, describeBackup, restoreBackup } from '../backup.js';
import { todayStr, daysBetween } from '../scheduler.js';
import { PROVIDERS, testAi } from '../ai/index.js';

const BUDGET_STEP = 15; // le temps se règle par quarts d'heure
const BUDGET_MAX = 12 * 60;

export async function render(app) {
  const s = await getSettings();

  // Copie de travail des étapes : [{ day, method }, ...]
  let steps = s.intervals.map((day, i) => ({
    day,
    method: s.methods[i] ?? s.methods[s.methods.length - 1] ?? 'recall',
  }));

  app.innerHTML = `
    <h1 class="page-title">Réglages</h1>

    <h2 class="section">Apparence</h2>
    <div class="switch" id="theme">
      <button data-set-theme="dark" class="${s.theme === 'dark' ? 'on' : ''}">Sombre<small>quai de nuit</small></button>
      <button data-set-theme="light" class="${s.theme === 'light' ? 'on' : ''}">Clair<small>plan imprimé</small></button>
    </div>

    <h2 class="section">Temps par jour</h2>
    <p class="hint">L'appli ne te proposera jamais plus que ce temps et reportera le reste
      aux jours suivants. Mets 0 pour un jour de repos.</p>
    <div id="budget">
      ${budgetRow('weekday', 'Lundi → vendredi', s.budget.weekday)}
      ${budgetRow('weekend', 'Samedi, dimanche', s.budget.weekend)}
    </div>

    <h2 class="section">Étapes du trajet</h2>
    <p class="hint">Pour chaque étape : le jour (après l'ajout de la leçon) et la méthode utilisée.</p>
    <div id="steps"></div>
    <button id="add-step" class="btn btn-ghost btn-block">+ Ajouter une étape</button>
    <div class="btn-row">
      <button id="reset" class="btn btn-ghost">Par défaut</button>
      <button id="save" class="btn btn-go">Enregistrer</button>
    </div>
    <p class="hint">Les changements s'appliquent aux prochaines révisions.</p>

    <h2 class="section">Sauvegarde</h2>
    <p class="hint">Tes données ne sont que sur ce téléphone. Exporte-les de temps en temps
      (dans tes fichiers, ton Drive, ou envoie-les-toi par mail) pour ne rien perdre.</p>
    <div class="backup-status">Dernière sauvegarde : <strong>${lastBackupText(s.lastBackup)}</strong></div>
    <div class="btn-row">
      <button id="export" class="btn btn-go">Exporter</button>
      <label class="btn btn-ghost">Importer
        <input type="file" id="import" accept=".json,application/json" hidden />
      </label>
    </div>
    <p class="hint">Importer une sauvegarde <strong>remplace</strong> toutes les données actuelles.</p>

    <h2 class="section">IA · facultatif</h2>
    <p class="hint">Sans IA, l'appli génère déjà des questions. Avec ta propre clé API,
      elle peut écrire de meilleurs QCM, QROC et cas cliniques à partir de tes cours.</p>
    <div class="switch" id="ai-switch">
      <button data-ai="off" class="${s.ai.enabled ? '' : 'on'}">Désactivée</button>
      <button data-ai="on" class="${s.ai.enabled ? 'on' : ''}">Activée</button>
    </div>
    <div id="ai-fields" ${s.ai.enabled ? '' : 'hidden'}>
      <label class="field-label" for="ai-provider">Fournisseur</label>
      <select id="ai-provider">
        ${Object.entries(PROVIDERS).map(([id, p]) =>
          `<option value="${id}" ${id === s.ai.provider ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}
      </select>

      <label class="field-label" for="ai-key">Clé API</label>
      <input type="password" id="ai-key" autocomplete="off" spellcheck="false" value="${escapeHtml(s.ai.apiKey)}" />
      <p class="hint" id="ai-key-help"></p>

      <label class="field-label" for="ai-model">Modèle</label>
      <input type="text" id="ai-model" autocomplete="off" spellcheck="false" value="${escapeHtml(s.ai.model)}" />

      <div id="ai-url-wrap">
        <label class="field-label" for="ai-url">Adresse de l'API</label>
        <input type="text" id="ai-url" inputmode="url" autocomplete="off" spellcheck="false"
          placeholder="https://…/v1" value="${escapeHtml(s.ai.baseUrl)}" />
      </div>

      <div class="field-label">Questions par génération</div>
      <div class="stepper" id="ai-count">
        <div class="note">Plus il y en a, plus c'est long et coûteux.</div>
        <button class="btn btn-ghost" data-delta="-5" aria-label="Moins de questions">−</button>
        <div class="value" id="ai-count-value">${s.ai.count}</div>
        <button class="btn btn-ghost" data-delta="5" aria-label="Plus de questions">+</button>
      </div>

      <div class="btn-row">
        <button id="ai-test" class="btn btn-ghost">Tester</button>
        <button id="ai-save" class="btn btn-go">Enregistrer</button>
      </div>
      <p class="form-error" id="ai-status" role="status"></p>
      <p class="hint">Le texte de la leçon est envoyé au fournisseur choisi à chaque génération,
        qui la facture selon ses tarifs (quelques centimes par cours en général).
        La clé reste sur ce téléphone et n'est jamais mise dans les sauvegardes.</p>
    </div>

    <h2 class="section">À propos</h2>
    <p class="hint">Toutes tes données restent sur ce téléphone. L'appli fonctionne hors ligne.</p>
  `;

  const stepsEl = app.querySelector('#steps');

  /** Affiche une ligne par étape : [J __] [méthode ▾] [✕] */
  function drawSteps() {
    const options = Object.keys(METHOD_LABELS);
    stepsEl.innerHTML = steps.map((step, i) => `
      <div class="step-row" data-i="${i}">
        <div class="day-wrap"><input class="day" type="number" min="0" inputmode="numeric" value="${step.day}"
          aria-label="Jour de l'étape ${i + 1}" ${i === 0 ? 'readonly' : ''} /></div>
        <select aria-label="Méthode de l'étape ${i + 1}">
          ${options.map((m) => `<option value="${m}" ${m === step.method ? 'selected' : ''}>
            ${escapeHtml(METHOD_LABELS[m])}</option>`).join('')}
        </select>
        <button class="btn" aria-label="Supprimer l'étape" ${i === 0 ? 'disabled' : ''}>✕</button>
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
    if (error) return toast(error);
    await saveSetting('intervals', steps.map((st) => st.day));
    await saveSetting('methods', steps.map((st) => st.method));
    toast('Étapes enregistrées');
  };

  // Boutons − / + du temps par jour : enregistré immédiatement.
  const budget = { ...s.budget };
  app.querySelector('#budget').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { key, delta } = btn.dataset;
    budget[key] = Math.min(BUDGET_MAX, Math.max(0, budget[key] + Number(delta)));
    app.querySelector(`#budget-${key}`).textContent = formatMinutes(budget[key]);
    await saveSetting('budget', budget);
  });

  app.querySelectorAll('#theme button').forEach((btn) => {
    btn.onclick = async () => {
      // (attribut "data-set-theme" et non "data-theme", qui activerait les couleurs du thème sur le bouton lui-même)
      await saveSetting('theme', btn.dataset.setTheme);
      applyTheme(btn.dataset.setTheme);
      render(app);
    };
  });

  setupAiSection(app, s.ai);

  // --- Exporter ---
  app.querySelector('#export').onclick = async () => {
    const outcome = await saveBackupFile(await buildBackup());
    if (outcome === 'cancelled') return;
    await saveSetting('lastBackup', todayStr());
    toast(outcome === 'shared' ? 'Sauvegarde prête' : 'Sauvegarde téléchargée');
    render(app);
  };

  // --- Importer ---
  app.querySelector('#import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return toast("Ce fichier n'est pas une sauvegarde lisible.");
    }
    const error = validateBackup(data);
    if (error) return toast(error);

    const date = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('fr-FR') : '?';
    const ok = confirm(`Sauvegarde du ${date} : ${describeBackup(data)}.\n\n`
      + 'Remplacer TOUTES tes données actuelles par cette sauvegarde ?');
    if (!ok) return;

    await restoreBackup(data);
    applyTheme((await getSettings()).theme);
    toast('Sauvegarde restaurée');
    render(app);
  });
}

/** Section IA : activer, choisir le fournisseur, tester, enregistrer. */
function setupAiSection(app, initial) {
  const fields = app.querySelector('#ai-fields');
  const provider = app.querySelector('#ai-provider');
  const model = app.querySelector('#ai-model');
  const status = app.querySelector('#ai-status');
  let count = initial.count;

  // Libellés qui dépendent du fournisseur choisi.
  const refresh = () => {
    const p = PROVIDERS[provider.value];
    app.querySelector('#ai-key-help').textContent = p.keyHelp;
    app.querySelector('#ai-url-wrap').hidden = !p.customUrl;
    model.placeholder = p.defaultModel ? `${p.defaultModel} (par défaut)` : 'nom du modèle (voir la doc du fournisseur)';
  };
  provider.addEventListener('change', refresh);
  refresh();

  const read = () => ({
    ...initial,
    provider: provider.value,
    apiKey: app.querySelector('#ai-key').value.trim(),
    model: model.value.trim(),
    baseUrl: app.querySelector('#ai-url').value.trim(),
    count,
  });

  // Activer / désactiver : enregistré tout de suite.
  app.querySelectorAll('[data-ai]').forEach((btn) => {
    btn.onclick = async () => {
      const enabled = btn.dataset.ai === 'on';
      initial = { ...read(), enabled };
      await saveSetting('ai', initial);
      app.querySelectorAll('[data-ai]').forEach((b) => b.classList.toggle('on', b === btn));
      fields.hidden = !enabled;
    };
  });

  app.querySelector('#ai-count').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    count = Math.min(30, Math.max(5, count + Number(btn.dataset.delta)));
    app.querySelector('#ai-count-value').textContent = count;
  });

  app.querySelector('#ai-save').onclick = async () => {
    initial = read();
    await saveSetting('ai', initial);
    status.textContent = '';
    status.dataset.state = '';
    toast('Réglages IA enregistrés');
  };

  app.querySelector('#ai-test').onclick = async () => {
    initial = read();
    await saveSetting('ai', initial);
    status.dataset.state = 'busy';
    status.textContent = 'Test en cours…';
    try {
      const [q] = await testAi(initial);
      status.dataset.state = 'ok';
      status.textContent = `Ça marche. Exemple : « ${q.prompt} »`;
    } catch (err) {
      status.dataset.state = '';
      status.textContent = err.message;
    }
  };
}

/** "aujourd'hui", "il y a 12 jours", "jamais". */
function lastBackupText(date) {
  if (!date) return 'jamais';
  const days = daysBetween(date, todayStr());
  return days === 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`;
}

/** Une ligne de réglage : libellé, bouton −, valeur, bouton +. */
function budgetRow(key, label, minutes) {
  return `
    <div class="stepper">
      <div class="label">${label}</div>
      <button class="btn btn-ghost" data-key="${key}" data-delta="-${BUDGET_STEP}" aria-label="Moins de temps">−</button>
      <div class="value" id="budget-${key}">${formatMinutes(minutes)}</div>
      <button class="btn btn-ghost" data-key="${key}" data-delta="${BUDGET_STEP}" aria-label="Plus de temps">+</button>
    </div>`;
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
