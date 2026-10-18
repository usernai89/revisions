// =============================================================
// screens/subject.js — Une matière : sa ligne et ses leçons (stations)
// =============================================================

import { db, listLessons, renameSubject, deleteSubject, subjectColor } from '../db.js';
import { todayStr, daysBetween, stepLabel } from '../scheduler.js';
import { summarize, formatPercent } from '../stats.js';
import { getSettings } from '../settings.js';
import { escapeHtml, go, lineBadge, relativeDay, toast } from '../ui.js';

export async function render(app, subjectId) {
  const subject = await db.subjects.get(subjectId);
  if (!subject) return go('#/subjects');

  const settings = await getSettings();
  const lessons = await listLessons(subjectId);
  const today = todayStr();
  const color = subjectColor(subject);

  // Statistiques de la matière.
  const reviews = await db.reviews.where('lessonId').anyOf(lessons.map((l) => l.id)).toArray();
  const stats = summarize(lessons, reviews, today);

  // Pour chaque leçon : sa prochaine révision.
  for (const lesson of lessons) {
    lesson.next = await db.reviews
      .where('lessonId').equals(lesson.id)
      .and((r) => r.status === 'pending')
      .first();
  }

  app.innerHTML = `
    <a href="#/subjects" class="back">Matières</a>
    <div class="line-head">
      ${lineBadge(subject, color, 'big')}
      <h1 class="page-title">${escapeHtml(subject.name)}</h1>
    </div>
    ${lessons.length ? `
      <a class="mini-stats" href="#/stats">
        <span><strong>${formatPercent(stats.successRate)}</strong>réussite</span>
        <span><strong>${stats.lessonsSeen}/${stats.lessonCount}</strong>leçons vues</span>
        <span class="${stats.overdue ? 'late' : ''}"><strong>${stats.overdue}</strong>retard${stats.overdue > 1 ? 's' : ''}</span>
      </a>` : ''}

    ${lessons.length ? `
      <ol class="route" style="--line:${color}">
        ${lessons.map((l) => station(l, settings, today)).join('')}
      </ol>` : '<p class="hint">Aucune leçon sur cette ligne pour l\'instant.</p>'}

    <a class="btn btn-go btn-block" style="margin-top:18px" href="#/subject/${subjectId}/add">+ Ajouter une leçon</a>

    <h2 class="section">Gérer la matière</h2>
    <div class="btn-row">
      <button id="rename" class="btn btn-ghost">Renommer</button>
      <button id="delete" class="btn btn-ghost" style="color:var(--bad)">Supprimer</button>
    </div>
  `;

  app.querySelector('#rename').onclick = async () => {
    const name = prompt('Nouveau nom de la matière :', subject.name);
    if (name && name.trim()) {
      await renameSubject(subjectId, name);
      render(app, subjectId);
    }
  };

  app.querySelector('#delete').onclick = async () => {
    const ok = confirm(`Supprimer « ${subject.name} » et ses ${lessons.length} leçon(s) ? C'est définitif.`);
    if (!ok) return;
    await deleteSubject(subjectId);
    toast('Matière supprimée');
    go('#/subjects');
  };
}

/** Une leçon = une station sur la ligne. */
function station(lesson, settings, today) {
  const next = lesson.next;
  let state = 'done';
  let when = 'terminé';
  let whenClass = '';
  if (next) {
    const days = daysBetween(today, next.dueDate);
    state = days <= 0 ? 'here' : 'future';
    when = `${stepLabel(settings.intervals, next.step)} · ${days < 0 ? `retard ${-days} j` : relativeDay(days)}`;
    whenClass = days < 0 ? 'late' : days === 0 ? 'now' : '';
  }
  return `
    <li>
      <a class="stn ${state}" href="#/lesson/${lesson.id}">
        <span class="stn-dot"></span>
        <span class="stn-name">${escapeHtml(lesson.title)}</span>
        <span class="stn-when ${whenClass}">${when}</span>
      </a>
    </li>`;
}
