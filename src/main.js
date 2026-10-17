// =============================================================
// main.js — Point d'entrée : démarrage et navigation entre écrans
// =============================================================
// La navigation utilise l'adresse après le "#" (ex. #/subject/3).
// Avantage : le bouton "retour" du téléphone fonctionne tout seul,
// et ça marche hors ligne sans serveur.

import './styles.css';
import { getSettings, applyTheme } from './settings.js';

import * as today from './screens/today.js';
import * as subjects from './screens/subjects.js';
import * as subject from './screens/subject.js';
import * as addLesson from './screens/addLesson.js';
import * as lesson from './screens/lesson.js';
import * as review from './screens/review.js';
import * as settings from './screens/settings.js';

// Liste des écrans : motif de l'adresse → écran + onglet surligné en bas.
const ROUTES = [
  { pattern: /^#\/today$/, screen: today, tab: 'today' },
  { pattern: /^#\/subjects$/, screen: subjects, tab: 'subjects' },
  { pattern: /^#\/subject\/(\d+)$/, screen: subject, tab: 'subjects' },
  { pattern: /^#\/subject\/(\d+)\/add$/, screen: addLesson, tab: 'subjects' },
  { pattern: /^#\/lesson\/(\d+)$/, screen: lesson, tab: 'subjects' },
  { pattern: /^#\/review\/(\d+)$/, screen: review, tab: 'today' },
  { pattern: /^#\/settings$/, screen: settings, tab: 'settings' },
];

const app = document.getElementById('app');

/** Affiche l'écran correspondant à l'adresse actuelle. */
async function router() {
  const hash = location.hash || '#/today';
  const route = ROUTES.find((r) => r.pattern.test(hash));
  if (!route) {
    location.hash = '#/today';
    return;
  }
  const params = hash.match(route.pattern).slice(1).map(Number);

  // Surligne l'onglet actif dans la barre du bas.
  document.querySelectorAll('#tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === route.tab);
  });

  app.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    await route.screen.render(app, ...params);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="card error">Oups, une erreur est survenue : ${err.message}</div>`;
  }
}

async function start() {
  const s = await getSettings();
  applyTheme(s.theme);
  window.addEventListener('hashchange', router);
  router();

  // Demande au navigateur de ne pas effacer nos données s'il manque de place.
  navigator.storage?.persist?.();
}

start();
