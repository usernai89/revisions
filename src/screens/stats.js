// =============================================================
// screens/stats.js — Bilan : statistiques globales et par matière
// =============================================================
// Comme un rapport de ponctualité d'un réseau de transport :
//  1. quatre indicateurs globaux (réussite, ponctualité, retards, leçons vues) ;
//  2. l'activité des 14 derniers jours (minutes par jour) ;
//  3. un rapport par ligne (matière), avec la répartition facile / moyen / difficile.
// Les calculs sont dans stats.js.

import { db, subjectColor } from '../db.js';
import { todayStr } from '../scheduler.js';
import { computeStats, formatPercent } from '../stats.js';
import { escapeHtml, formatDateFr, formatMinutes, lineBadge } from '../ui.js';

const DAYS = 14;

export async function render(app) {
  const today = todayStr();
  const [subjects, lessons, reviews] = await Promise.all([
    db.subjects.orderBy('name').toArray(),
    db.lessons.toArray(),
    db.reviews.toArray(),
  ]);
  const { global, bySubject, activity } = computeStats({ subjects, lessons, reviews, today, days: DAYS });

  app.innerHTML = `
    <h1 class="page-title">Bilan</h1>

    <div class="tiles">
      ${tile('Réussite', formatPercent(global.successRate), `${global.totalAnswers} réponse${global.totalAnswers > 1 ? 's' : ''}`)}
      ${tile('Ponctualité', formatPercent(global.onTimeRate), `${global.reviewsDone} révision${global.reviewsDone > 1 ? 's' : ''} faite${global.reviewsDone > 1 ? 's' : ''}`)}
      ${tile('Retards', global.overdue, global.overdue ? 'à rattraper' : 'aucun', global.overdue ? 'alert' : '')}
      ${tile('Leçons vues', `${global.lessonsSeen}<small>/${global.lessonCount}</small>`, `${global.lessonsFinished} terminée${global.lessonsFinished > 1 ? 's' : ''}`)}
    </div>

    <h2 class="section">Activité · 14 jours</h2>
    ${activityChart(activity, today)}

    <h2 class="section">Par ligne</h2>
    ${bySubject.length ? `
      ${legend()}
      <ul class="report">${bySubject.map((s) => subjectReport(s)).join('')}</ul>
      <p class="hint">Réussite = réponses « facile » ou « moyen » sur toutes tes réponses.
        Ponctualité = révisions faites le jour prévu.</p>
    ` : '<p class="hint">Aucune matière pour l\'instant.</p>'}
  `;

  setupChart(app);
}

/** Une case d'indicateur : libellé, grande valeur, précision. */
function tile(label, value, detail, mod = '') {
  return `
    <div class="tile ${mod}">
      <div class="tile-label">${label}</div>
      <div class="tile-value">${value}</div>
      <div class="tile-detail">${detail}</div>
    </div>`;
}

/**
 * Histogramme des minutes par jour (une seule série → pas de légende,
 * le titre de la section suffit). Toucher une colonne affiche sa valeur.
 */
function activityChart(activity, today) {
  const max = Math.max(...activity.map((d) => d.minutes));
  const total = activity.reduce((sum, d) => sum + d.minutes, 0);
  const maxIndex = activity.findIndex((d) => d.minutes === max);
  const summary = total
    ? `${formatMinutes(total)} au total · ${activity.filter((d) => d.minutes).length} jour(s) actif(s)`
    : 'Aucune révision ces 14 derniers jours';

  const cols = activity.map((d, i) => {
    const height = max ? Math.max(d.minutes ? 4 : 0, (d.minutes / max) * 100) : 0;
    const label = `${capitalize(formatDateFr(d.date))} : ${d.minutes ? formatMinutes(d.minutes) : 'aucune révision'}`;
    return `
      <button class="col ${d.date === today ? 'today' : ''}" data-label="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <span class="col-bar" style="height:${height}%">
          ${i === maxIndex && max ? `<span class="col-value">${formatMinutes(max)}</span>` : ''}
        </span>
      </button>`;
  }).join('');

  const days = activity.map((d) => `<span class="${d.date === today ? 'today' : ''}">${weekdayInitial(d.date)}</span>`).join('');

  return `
    <div class="chart">
      <div class="chart-readout" id="readout" aria-live="polite">${summary}</div>
      <div class="cols">${cols}</div>
      <div class="col-days" aria-hidden="true">${days}</div>
    </div>`;
}

/** Toucher (ou survoler) une colonne affiche sa date et sa valeur. */
function setupChart(app) {
  const readout = app.querySelector('#readout');
  if (!readout) return;
  const initial = readout.textContent;
  app.querySelectorAll('.col').forEach((col) => {
    const show = () => {
      app.querySelectorAll('.col.active').forEach((c) => c.classList.remove('active'));
      col.classList.add('active');
      readout.textContent = col.dataset.label;
    };
    col.addEventListener('pointerenter', show);
    col.addEventListener('focus', show);
    col.addEventListener('click', show);
  });
  app.querySelector('.cols').addEventListener('pointerleave', () => {
    app.querySelectorAll('.col.active').forEach((c) => c.classList.remove('active'));
    readout.textContent = initial;
  });
}

/** Légende commune des barres facile / moyen / difficile. */
function legend() {
  return `
    <div class="legend">
      <span><i style="background:var(--easy)"></i>Facile</span>
      <span><i style="background:var(--medium)"></i>Moyen</span>
      <span><i style="background:var(--hard)"></i>Difficile</span>
    </div>`;
}

/** Le rapport d'une ligne (matière). */
function subjectReport(s) {
  const color = subjectColor(s.subject);
  const { easy, medium, hard } = s.answers;
  const total = s.totalAnswers;
  // Barre empilée : un segment par note, largeur proportionnelle.
  const bar = total ? `
    <div class="stack" role="img" aria-label="${easy} facile, ${medium} moyen, ${hard} difficile">
      ${[['easy', easy], ['medium', medium], ['hard', hard]]
        .filter(([, n]) => n)
        .map(([k, n]) => `<span style="flex:${n};background:var(--${k})"></span>`).join('')}
    </div>
    <div class="stack-text">${easy} facile · ${medium} moyen · ${hard} difficile</div>`
    : '<div class="stack-text">Pas encore de réponses notées.</div>';

  return `
    <li>
      <a class="report-row" href="#/subject/${s.subject.id}">
        <div class="report-head">
          ${lineBadge(s.subject, color)}
          <span class="report-name">${escapeHtml(s.subject.name)}</span>
          <span class="report-rate">${formatPercent(s.successRate)}</span>
        </div>
        <div class="report-figures">
          <span><strong>${s.lessonsSeen}/${s.lessonCount}</strong> leçons vues</span>
          <span class="${s.overdue ? 'late' : ''}"><strong>${s.overdue}</strong> retard${s.overdue > 1 ? 's' : ''}</span>
          <span><strong>${formatPercent(s.onTimeRate)}</strong> à l'heure</span>
        </div>
        ${bar}
      </a>
    </li>`;
}

function weekdayInitial(dateStr) {
  return formatDateFr(dateStr).charAt(0).toUpperCase();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
