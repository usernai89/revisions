// =============================================================
// screens/today.js — Écran "Aujourd'hui"
// =============================================================
// Affiche les révisions du jour (et celles en retard), triées par priorité,
// puis un aperçu des prochains jours.

import { getDueReviews, getUpcomingReviews, todayStr, daysBetween, stepLabel, methodForStep, estimateMinutes } from '../scheduler.js';
import { getSettings } from '../settings.js';
import { countWords } from '../text.js';
import { escapeHtml, formatDateFr, relativeDay, METHOD_LABELS, METHOD_ICONS } from '../ui.js';

export async function render(app) {
  const today = todayStr();
  const settings = await getSettings();
  const due = await getDueReviews(today);
  const upcoming = await getUpcomingReviews(7, today);

  // Méthode et durée estimée de chaque révision.
  const withInfo = (r) => {
    const method = methodForStep(settings.methods, r.step);
    const minutes = estimateMinutes(method, countWords(r.lesson.text), r.questionCount);
    return { ...r, method, minutes };
  };
  const dueList = due.map(withInfo);
  const totalMinutes = dueList.reduce((sum, r) => sum + r.minutes, 0);

  app.innerHTML = `
    <h1>Aujourd'hui</h1>
    <p class="subtitle">${formatDateFr(today)}${dueList.length ? ` · ${dueList.length} révision(s) · ~${totalMinutes} min` : ''}</p>

    ${dueList.length ? dueList.map((r) => reviewCard(r, settings, today)).join('') : emptyState()}

    ${upcoming.length ? `
      <h2>Prochains jours</h2>
      ${upcoming.map((r) => `
        <a class="card" href="#/lesson/${r.lesson.id}">
          <div class="row">
            <div class="grow">
              <div class="title">${escapeHtml(r.lesson.title)}</div>
              <div class="meta">${escapeHtml(r.subject?.name ?? '')} · ${stepLabel(settings.intervals, r.step)}</div>
            </div>
            <span class="badge">${relativeDay(daysBetween(today, r.dueDate))}</span>
          </div>
        </a>`).join('')}
    ` : ''}
  `;
}

function reviewCard(r, settings, today) {
  const late = daysBetween(r.dueDate, today);
  return `
    <a class="card" href="#/review/${r.id}">
      <div class="row">
        <div class="big-icon">${METHOD_ICONS[r.method] ?? '📝'}</div>
        <div class="grow">
          <div class="title">${escapeHtml(r.lesson.title)}</div>
          <div class="meta">
            ${escapeHtml(r.subject?.name ?? '')} · ${stepLabel(settings.intervals, r.step)} ·
            ${METHOD_LABELS[r.method] ?? r.method} · ~${r.minutes} min
          </div>
          ${late > 0 ? `<span class="badge late">${relativeDay(-late)}</span>` : ''}
        </div>
      </div>
    </a>`;
}

function emptyState() {
  return `
    <div class="empty">
      <div class="big">🎉</div>
      <p>Rien à réviser pour l'instant.</p>
      <a class="btn btn-primary" href="#/subjects">Ajouter une leçon</a>
    </div>`;
}
