// =============================================================
// screens/today.js — Écran "Aujourd'hui" : le tableau des départs
// =============================================================
// Affiche :
//  - une jauge du temps du jour (une case par quart d'heure) ;
//  - les révisions du jour, triées par priorité, SANS dépasser ton temps disponible ;
//  - celles qui ne rentrent pas (reportées, mais faisables quand même) ;
//  - un horaire des prochains jours.
// La répartition est calculée par planDays() dans scheduler.js.

import {
  getPendingReviews, usedMinutesOn, planDays, todayStr, daysBetween, stepLabel,
  methodForStep, sortByPriority, estimateMinutes,
} from '../scheduler.js';
import { subjectColor } from '../db.js';
import { getSettings } from '../settings.js';
import { escapeHtml, formatDateFr, formatMinutes, lineBadge, METHOD_LABELS, METHOD_CODES } from '../ui.js';

const DAYS_AHEAD = 8; // aujourd'hui + 7 jours
const SLOT = 15; // une case de la jauge = 15 minutes

export async function render(app) {
  const today = todayStr();
  const settings = await getSettings();
  const pending = await getPendingReviews();
  const doneMinutes = await usedMinutesOn(today);

  const plan = planDays(pending, {
    today,
    days: DAYS_AHEAD,
    intervals: settings.intervals,
    methods: settings.methods,
    budget: settings.budget,
    usedToday: doneMinutes,
  });

  const todayPlan = plan[0];
  const plannedIds = new Set(todayPlan.items.map((r) => r.id));
  // Révisions à faire aujourd'hui qui ne rentrent pas dans le temps disponible.
  const postponed = sortByPriority(pending.filter((r) => r.dueDate <= today && !plannedIds.has(r.id)), today)
    .map((r) => {
      const method = methodForStep(settings.methods, r.step);
      return { ...r, method, minutes: estimateMinutes(method, r.wordCount, r.questionCount) };
    });
  const upcoming = plan.slice(1).filter((day) => day.items.length);

  app.innerHTML = `
    <header class="station">
      <h1 class="page-title">Départs</h1>
      <div class="clock" id="clock" aria-hidden="true"></div>
      <div class="station-date">${capitalize(formatDateFr(today))}</div>
    </header>

    ${gauge(todayPlan, doneMinutes)}

    ${todayPlan.items.length ? board(todayPlan.items, settings, today) : emptyState(todayPlan, postponed.length, doneMinutes)}

    ${postponed.length ? `
      <h2 class="section">Reportés · temps dépassé</h2>
      <p class="hint">Ils passeront en premier les jours suivants. Tu peux quand même les faire maintenant.</p>
      ${board(postponed, settings, today, true)}
    ` : ''}

    ${upcoming.length ? `
      <h2 class="section">Prochains jours</h2>
      <ul class="timetable">${upcoming.map((day) => timetableRow(day)).join('')}</ul>
      <p class="hint">Prévision si tu fais tes révisions comme prévu.</p>
    ` : ''}
  `;

  startClock();
}

/** Jauge segmentée : vert = déjà fait, ambre = prévu, gris = libre. */
function gauge(day, doneMinutes) {
  if (day.budget === 0) return '';
  const slots = Math.max(1, Math.round(day.budget / SLOT));
  const done = Math.round(doneMinutes / SLOT);
  const used = Math.round(day.used / SLOT);
  const cells = Array.from({ length: slots }, (_, i) =>
    `<i class="${i < done ? 'done' : i < used ? 'planned' : ''}"></i>`).join('');
  return `
    <div class="budget">
      <div class="budget-text">
        <span><strong>${formatMinutes(day.used)}</strong> sur ${formatMinutes(day.budget)}</span>
        <span>${doneMinutes ? `${formatMinutes(doneMinutes)} fait` : 'temps du jour'}</span>
      </div>
      <div class="gauge" aria-hidden="true">${cells}</div>
    </div>`;
}

/** Le tableau : une ligne par révision. */
function board(reviews, settings, today, postponed = false) {
  return `
    <ol class="board ${postponed ? 'postponed' : ''}">
      <li class="board-head" aria-hidden="true"><span>Ligne</span><span>Destination</span><span>Durée</span></li>
      ${reviews.map((r) => departure(r, settings, today)).join('')}
    </ol>`;
}

function departure(r, settings, today) {
  const late = daysBetween(r.dueDate, today);
  return `
    <li>
      <a class="dep" href="#/review/${r.id}">
        ${lineBadge(r.subject, subjectColor(r.subject))}
        <span class="dep-main">
          <span class="dep-dest">${escapeHtml(r.lesson.title)}</span>
          <span class="dep-via">
            <span class="code">${METHOD_CODES[r.method] ?? '···'}</span>
            ${stepLabel(settings.intervals, r.step)} · ${METHOD_LABELS[r.method] ?? r.method}
          </span>
          ${late > 0 ? `<span class="dep-late">Retard +${late} j</span>` : ''}
        </span>
        <span class="dep-time">${r.minutes}<small>MIN</small></span>
      </a>
    </li>`;
}

/** Une ligne de l'horaire des prochains jours. */
function timetableRow(day) {
  const [weekday, num] = formatDateFr(day.date).split(' ');
  // Une petite pastille par révision, aux couleurs des matières.
  const badges = day.items.map((r) => lineBadge(r.subject, subjectColor(r.subject), 'small')).join('');
  return `
    <li>
      <div class="tt-day">${weekday.slice(0, 3)}<small>${num}</small></div>
      <div class="tt-lines">${badges}</div>
      <div class="tt-load ${day.used > day.budget ? 'over' : ''}">${formatMinutes(day.used)}<br>/ ${formatMinutes(day.budget)}</div>
    </li>`;
}

function emptyState(day, postponedCount, doneMinutes) {
  if (day.budget === 0) {
    return `<div class="empty"><div class="empty-sign">Jour de repos</div>
      <p>Aucune révision prévue aujourd'hui (0 minute dans les réglages).</p></div>`;
  }
  if (postponedCount) {
    return `<div class="empty"><div class="empty-sign">Complet</div>
      <p>Ton temps de révision du jour est rempli.</p></div>`;
  }
  if (doneMinutes) {
    return `<div class="empty"><div class="empty-sign">Fin de service</div>
      <p>Tout est fait pour aujourd'hui. Bravo.</p></div>`;
  }
  return `
    <div class="empty">
      <div class="empty-sign">Aucun départ</div>
      <p>Ajoute une leçon : sa première révision partira aujourd'hui.</p>
      <a class="btn btn-go" href="#/subjects">Ajouter une leçon</a>
    </div>`;
}

/** Horloge en haut à droite, comme sur un quai (mise à jour chaque minute). */
let clockTimer = null;
function startClock() {
  const tick = () => {
    const el = document.getElementById('clock');
    if (!el) return clearInterval(clockTimer); // on a quitté l'écran
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    el.innerHTML = `${hh}<span class="colon">:</span>${mm}`;
  };
  clearInterval(clockTimer);
  tick();
  clockTimer = setInterval(tick, 15000);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
