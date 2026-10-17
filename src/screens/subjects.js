// =============================================================
// screens/subjects.js — Liste des matières + création d'une matière
// =============================================================

import { db, listSubjects, addSubject } from '../db.js';
import { escapeHtml, toast } from '../ui.js';

export async function render(app) {
  const subjects = await listSubjects();

  // Nombre de leçons par matière.
  const counts = {};
  for (const s of subjects) {
    counts[s.id] = await db.lessons.where('subjectId').equals(s.id).count();
  }

  app.innerHTML = `
    <h1>Matières</h1>
    <form id="add-form" class="row" style="margin: 12px 0 20px">
      <input type="text" name="name" placeholder="Nouvelle matière (ex. Anatomie)" class="grow" required maxlength="60" />
      <button class="btn-primary" type="submit" aria-label="Ajouter">＋</button>
    </form>

    ${subjects.length
      ? subjects.map((s) => `
        <a class="card" href="#/subject/${s.id}">
          <div class="row">
            <div class="big-icon">📚</div>
            <div class="grow">
              <div class="title">${escapeHtml(s.name)}</div>
              <div class="meta">${counts[s.id]} leçon(s)</div>
            </div>
            <span class="muted">›</span>
          </div>
        </a>`).join('')
      : `<div class="empty"><div class="big">📚</div><p>Crée ta première matière ci-dessus.</p></div>`}
  `;

  app.querySelector('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;
    await addSubject(name);
    toast(`Matière « ${name} » créée`);
    render(app); // on réaffiche la liste
  });
}
