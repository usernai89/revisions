// =============================================================
// screens/today.js — Écran "Aujourd'hui"
// =============================================================
// Affiche :
//  - les révisions du jour, triées par priorité, SANS dépasser ton temps disponible ;
//  - celles qui ne rentrent pas (reportées à demain, mais faisables quand même) ;
//  - un aperçu de la charge des prochains jours.
// La répartition est calculée par planDays() dans scheduler.js.

import { getPendingReviews, usedMinutesOn, planDays, todayStr, daysBetween, stepLabel, methodForStep, sortByPriority, estimateMinutes } from '../scheduler.js';
import { getSettings } from '../settings.js';
import { escapeHtml, formatDateFr, relativeDay, formatMinutes, METHOD_LABELS, METHOD_ICONS } from '../ui.js';

const DAYS_AHEAD = 8; // aujourd'hui + 7 jours

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
    <h1>Aujourd'hui</h1>
    <p class="subtitle">${formatDateFr(today)}</p>

    ${budgetBar(todayPlan, doneMinutes)}

    ${todayPlan.items.length
      ? todayPlan.items.map((r) => reviewCard(r, settings, today)).join('')
      : emptyState(todayPlan, postponed.length, doneMinutes)}

    ${postponed.length ? `
      <h2>Reporté — temps dépassé (${postponed.length})</h2>
      <p class="muted">Ces révisions passeront en priorité les jours suivants.
        Tu peux quand même les faire maintenant si tu as du temps.</p>
      ${postponed.map((r) => reviewCard(r, settings, today, true)).join('')}
    ` : ''}

    ${upcoming.length ? `
      <h2>Prochains jours</h2>
      ${upcoming.map((day) => dayCard(day, settings, today)).join('')}
      <p class="muted">Prévision si tu fais tes révisions comme prévu.</p>
    ` : ''}
  `;
}

/** Barre "temps utilisé / temps disponible" du jour. */
function budgetBar(day, doneMinutes) {
  if (day.budget === 0) return '';
  const percent = Math.min(100, Math.round((day.used / day.budget) * 100));
  const planned = day.used - doneMinutes;
  return `
    <div class="card">
      <div class="row">
        <div class="grow"><strong>⏱️ ${formatMinutes(day.used)}</strong> / ${formatMinutes(day.budget)}</div>
        <div class="meta">${doneMinutes ? `${formatMinutes(doneMinutes)} fait · ` : ''}${formatMinutes(planned)} prévu</div>
      </div>
      <div class="progress"><div style="width:${percent}%"></div></div>
    </div>`;
}

/** Carte d'une révision à faire (cliquable). */
function reviewCard(r, settings, today, dimmed = false) {
  const late = daysBetween(r.dueDate, today);
  const method = r.method;
  return `
    <a class="card ${dimmed ? 'dimmed' : ''}" href="#/review/${r.id}">
      <div class="row">
        <div class="big-icon">${METHOD_ICONS[method] ?? '📝'}</div>
        <div class="grow">
          <div class="title">${escapeHtml(r.lesson.title)}</div>
          <div class="meta">
            ${escapeHtml(r.subject?.name ?? '')} · ${stepLabel(settings.intervals, r.step)} ·
            ${METHOD_LABELS[method] ?? method} · ~${r.minutes} min
          </div>
          ${late > 0 ? `<span class="badge late">${relativeDay(-late)}</span>` : ''}
        </div>
      </div>
    </a>`;
}

/** Carte résumant un jour à venir : nombre de révisions, charge, titres. */
function dayCard(day, settings, today) {
  const over = day.used > day.budget;
  return `
    <div class="card">
      <div class="row">
        <div class="grow title">${capitalize(formatDateFr(day.date))}</div>
        <span class="badge ${over ? 'late' : ''}">${formatMinutes(day.used)} / ${formatMinutes(day.budget)}</span>
      </div>
      <div class="meta">${relativeDay(daysBetween(today, day.date))} · ${day.items.length} révision(s)</div>
      <ul class="day-list">
        ${day.items.map((r) => `
          <li><a href="#/lesson/${r.lesson.id}">${escapeHtml(r.lesson.title)}</a>
            <span class="muted">· ${stepLabel(settings.intervals, r.step)} · ${METHOD_ICONS[r.method] ?? ''}</span></li>`).join('')}
      </ul>
    </div>`;
}

function emptyState(day, postponedCount, doneMinutes) {
  if (day.budget === 0) {
    return `<div class="empty"><div class="big">😴</div><p>Jour de repos (0 minute prévue dans les réglages).</p></div>`;
  }
  if (postponedCount) {
    return `<div class="empty"><div class="big">✅</div><p>Ton temps de révision du jour est rempli.</p></div>`;
  }
  return `
    <div class="empty">
      <div class="big">🎉</div>
      <p>${doneMinutes ? 'Tout est fait pour aujourd\'hui, bravo !' : 'Rien à réviser pour l\'instant.'}</p>
      <a class="btn btn-primary" href="#/subjects">Ajouter une leçon</a>
    </div>`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
