// =============================================================
// screens/lesson.js — Détail d'une leçon : planning, questions, texte
// =============================================================

import { db, getLesson, deleteLesson } from '../db.js';
import { todayStr, daysBetween, stepLabel, nextDueDate, methodForStep } from '../scheduler.js';
import { getSettings } from '../settings.js';
import { escapeHtml, formatDateFr, go, relativeDay, toast, METHOD_LABELS } from '../ui.js';

export async function render(app, lessonId) {
  const lesson = await getLesson(lessonId);
  if (!lesson) return go('#/subjects');

  const settings = await getSettings();
  const subject = await db.subjects.get(lesson.subjectId);
  const reviews = await db.reviews.where('lessonId').equals(lessonId).sortBy('step');
  const questions = await db.questions.where('lessonId').equals(lessonId).toArray();
  const pending = reviews.find((r) => r.status === 'pending');
  const today = todayStr();

  app.innerHTML = `
    <a href="#/subject/${lesson.subjectId}" class="muted">‹ ${escapeHtml(subject?.name ?? '')}</a>
    <h1>${escapeHtml(lesson.title)}</h1>

    ${pending && pending.dueDate <= today
      ? `<a class="btn btn-primary btn-block" href="#/review/${pending.id}">▶️ Réviser maintenant (${stepLabel(settings.intervals, pending.step)})</a>`
      : ''}

    <h2>Planning</h2>
    <div class="card">${planningRows(reviews, pending, settings, today)}</div>

    <h2>Questions générées (${questions.length})</h2>
    ${questions.length
      ? `<details class="card"><summary>Voir les questions</summary>
          ${questions.map((q) => `
            <div style="margin-top:12px">
              <strong>${escapeHtml(q.prompt)}</strong>
              <div class="muted pre">${escapeHtml(q.answer)}</div>
            </div>`).join('')}
        </details>`
      : `<p class="muted">Aucune définition ni liste détectée dans ce cours. Les révisions utiliseront les textes à trous et le rappel actif.</p>`}

    <h2>Texte du cours</h2>
    <details class="card"><summary>Afficher le texte</summary>
      <div class="pre" style="margin-top:12px">${escapeHtml(lesson.text)}</div>
    </details>

    ${lesson.highlights?.length
      ? `<h2>Points surlignés (${lesson.highlights.length})</h2>
         <div class="card">${lesson.highlights.map((h) => `<p>• ${escapeHtml(h)}</p>`).join('')}</div>`
      : ''}

    <button id="delete" class="btn-danger btn-block" style="margin-top:24px">🗑️ Supprimer la leçon</button>
  `;

  app.querySelector('#delete').onclick = async () => {
    if (!confirm(`Supprimer « ${lesson.title} » ? C'est définitif.`)) return;
    await deleteLesson(lessonId);
    toast('Leçon supprimée');
    go(`#/subject/${lesson.subjectId}`);
  };
}

/**
 * Tableau du planning : étapes faites, étape en cours,
 * et dates prévisionnelles des étapes suivantes (si tout se passe à l'heure).
 */
function planningRows(reviews, pending, settings, today) {
  const rows = [];
  for (const r of reviews.filter((r) => r.status === 'done')) {
    rows.push(row(stepLabel(settings.intervals, r.step), `✅ fait le ${formatDateFr(r.doneDate, false)}`));
  }
  if (pending) {
    const days = daysBetween(today, pending.dueDate);
    const badge = days < 0 ? 'badge late' : 'badge';
    rows.push(row(
      `${stepLabel(settings.intervals, pending.step)} · ${METHOD_LABELS[methodForStep(settings.methods, pending.step)] ?? ''}`,
      `<span class="${badge}">${relativeDay(days)}</span>`,
    ));
    // Prévisions des étapes suivantes.
    let date = pending.dueDate < today ? today : pending.dueDate;
    for (let step = pending.step; ; step++) {
      date = nextDueDate(settings.intervals, step, date);
      if (!date) break;
      rows.push(row(`<span class="muted">${stepLabel(settings.intervals, step + 1)}</span>`, `<span class="muted">vers le ${formatDateFr(date, false)}</span>`));
    }
  }
  return rows.join('') || '<p class="muted">Aucune révision.</p>';
}

function row(left, right) {
  return `<div class="row" style="padding:6px 0"><div class="grow">${left}</div><div>${right}</div></div>`;
}
