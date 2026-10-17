// =============================================================
// screens/subject.js — Une matière : ses leçons, renommer, supprimer
// =============================================================

import { db, listLessons, renameSubject, deleteSubject } from '../db.js';
import { todayStr, daysBetween, stepLabel } from '../scheduler.js';
import { getSettings } from '../settings.js';
import { escapeHtml, go, relativeDay, toast } from '../ui.js';

export async function render(app, subjectId) {
  const subject = await db.subjects.get(subjectId);
  if (!subject) return go('#/subjects');

  const settings = await getSettings();
  const lessons = await listLessons(subjectId);
  const today = todayStr();

  // Pour chaque leçon : sa prochaine révision.
  for (const lesson of lessons) {
    lesson.next = await db.reviews
      .where('lessonId').equals(lesson.id)
      .and((r) => r.status === 'pending')
      .first();
  }

  app.innerHTML = `
    <a href="#/subjects" class="muted">‹ Matières</a>
    <h1>${escapeHtml(subject.name)}</h1>

    <a class="btn btn-primary btn-block" href="#/subject/${subjectId}/add">＋ Ajouter une leçon</a>

    <h2>Leçons</h2>
    ${lessons.length
      ? lessons.map((l) => `
        <a class="card" href="#/lesson/${l.id}">
          <div class="title">${escapeHtml(l.title)}</div>
          <div class="meta">${nextLabel(l.next, settings, today)}</div>
        </a>`).join('')
      : '<p class="muted">Aucune leçon pour l\'instant.</p>'}

    <h2>Gérer la matière</h2>
    <div class="btn-row">
      <button id="rename">✏️ Renommer</button>
      <button id="delete" class="btn-danger">🗑️ Supprimer</button>
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

function nextLabel(next, settings, today) {
  if (!next) return '✅ Toutes les révisions sont terminées';
  const days = daysBetween(today, next.dueDate);
  return `Prochaine : ${stepLabel(settings.intervals, next.step)} · ${relativeDay(days)}`;
}
