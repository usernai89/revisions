// =============================================================
// screens/subjects.js — Les matières, présentées comme des lignes
// =============================================================

import { db, listSubjects, addSubject, subjectColor } from '../db.js';
import { todayStr } from '../scheduler.js';
import { escapeHtml, lineBadge, toast } from '../ui.js';

export async function render(app) {
  const subjects = await listSubjects();
  const today = todayStr();

  // Pour chaque matière : nombre de leçons et de révisions à faire aujourd'hui.
  for (const s of subjects) {
    const lessonIds = await db.lessons.where('subjectId').equals(s.id).primaryKeys();
    s.lessonCount = lessonIds.length;
    s.dueCount = await db.reviews
      .where('lessonId').anyOf(lessonIds)
      .and((r) => r.status === 'pending' && r.dueDate <= today)
      .count();
  }

  app.innerHTML = `
    <h1 class="page-title">Matières</h1>

    ${subjects.length ? `
      <ul class="lines">
        ${subjects.map((s) => `
          <li>
            <a class="line-row" href="#/subject/${s.id}">
              ${lineBadge(s, subjectColor(s), 'big')}
              <div class="grow">
                <div class="name">${escapeHtml(s.name)}</div>
                <div class="meta">${s.lessonCount} leçon${s.lessonCount > 1 ? 's' : ''}
                  ${s.dueCount ? `<span class="due-dot" title="à réviser aujourd'hui">${s.dueCount}</span>` : ''}</div>
              </div>
              <span class="arrow">→</span>
            </a>
          </li>`).join('')}
      </ul>` : `
      <div class="empty">
        <div class="empty-sign">Aucune ligne</div>
        <p>Crée ta première matière : elle aura sa couleur, comme une ligne de métro.</p>
      </div>`}

    <h2 class="section">Nouvelle matière</h2>
    <form id="add-form" class="inline-form">
      <input type="text" name="name" placeholder="ex. Sémiologie" required maxlength="60" aria-label="Nom de la matière" />
      <button class="btn btn-go" type="submit" aria-label="Ajouter">+</button>
    </form>
  `;

  app.querySelector('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;
    await addSubject(name);
    toast(`Ligne « ${name} » ouverte`);
    render(app); // on réaffiche la liste
  });
}
