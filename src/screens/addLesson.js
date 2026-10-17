// =============================================================
// screens/addLesson.js — Ajouter une leçon (import PDF ou texte collé)
// =============================================================
// Étapes :
//  1. on choisit un PDF (le texte est extrait et affiché dans la zone de texte)
//     OU on colle directement le texte ;
//  2. on vérifie / corrige le titre et le texte ;
//  3. "Enregistrer" : la leçon est créée et la révision J0 est programmée.

import { db } from '../db.js';
import { createLessonWithPlan } from '../scheduler.js';
import { extractPdfText } from '../import/pdf.js';
import { cleanText, countWords } from '../text.js';
import { escapeHtml, go, toast } from '../ui.js';

export async function render(app, subjectId) {
  const subject = await db.subjects.get(subjectId);
  if (!subject) return go('#/subjects');

  app.innerHTML = `
    <a href="#/subject/${subjectId}" class="muted">‹ ${escapeHtml(subject.name)}</a>
    <h1>Nouvelle leçon</h1>

    <label class="file-drop" id="drop">
      <input type="file" id="file" accept=".pdf,application/pdf" />
      <div class="big-icon">📄</div>
      <div><strong>Importer un PDF</strong></div>
      <div class="muted" id="file-status">Touchez ici pour choisir un fichier</div>
    </label>

    <form id="form">
      <label for="title">Titre</label>
      <input type="text" id="title" required maxlength="120" placeholder="ex. Sémiologie cardiaque" />

      <label for="text">Texte du cours <span class="muted" id="words"></span></label>
      <textarea id="text" required placeholder="…ou colle le texte de ton cours ici"></textarea>

      <button type="submit" class="btn-primary btn-block" style="margin-top:16px">💾 Enregistrer et planifier</button>
    </form>
  `;

  const fileInput = app.querySelector('#file');
  const status = app.querySelector('#file-status');
  const titleInput = app.querySelector('#title');
  const textArea = app.querySelector('#text');
  const words = app.querySelector('#words');

  const updateWords = () => {
    words.textContent = textArea.value ? `(${countWords(textArea.value)} mots)` : '';
  };
  textArea.addEventListener('input', updateWords);

  // --- Import d'un fichier ---
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    status.textContent = 'Lecture du fichier…';
    try {
      const text = await extractPdfText(file, (page, total) => {
        status.textContent = `Lecture de la page ${page} / ${total}…`;
      });
      if (countWords(text) < 5) {
        status.textContent = '⚠️ Aucun texte trouvé. Ce PDF est peut-être scanné (images).';
        return;
      }
      textArea.value = text;
      if (!titleInput.value) titleInput.value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
      status.textContent = `✅ ${file.name} importé — vérifie le texte ci-dessous`;
      updateWords();
    } catch (err) {
      console.error(err);
      status.textContent = `❌ Impossible de lire ce fichier (${err.message})`;
    }
  });

  // --- Enregistrement ---
  app.querySelector('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = cleanText(textArea.value);
    const title = titleInput.value.trim();
    if (!title || !text) return;

    const lessonId = await createLessonWithPlan({ subjectId, title, text });
    const nbQuestions = await db.questions.where('lessonId').equals(lessonId).count();
    toast(`Leçon enregistrée · ${nbQuestions} question(s) générée(s) · J0 aujourd'hui`);
    go(`#/lesson/${lessonId}`);
  });
}
