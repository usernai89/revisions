// =============================================================
// screens/questionEdit.js — Écrire ou modifier une question
// =============================================================
// Deux adresses :
//   #/lesson/12/question   → nouvelle question pour la leçon 12
//   #/question/34          → modifier la question 34
//
// Types :
//  - QROC : une question, une réponse courte ;
//  - QCM  : une question, 2 à 8 propositions (une ou plusieurs justes),
//           et une explication facultative.
// Les deux peuvent avoir un énoncé de cas clinique (facultatif).
// Les questions générées automatiquement peuvent aussi être corrigées ici.

import { db, getLesson, addUserQuestion, updateQuestion, deleteQuestion } from '../db.js';
import { escapeHtml, go, toast } from '../ui.js';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const LETTERS = 'ABCDEFGH';

/** Écran "nouvelle question" (route #/lesson/:id/question). */
export async function renderNew(app, lessonId) {
  const lesson = await getLesson(lessonId);
  if (!lesson) return go('#/subjects');
  const empty = {
    lessonId,
    kind: 'qroc',
    prompt: '',
    answer: '',
    context: '',
    options: [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }],
    explanation: '',
  };
  draw(app, lesson, empty, true);
}

/** Écran "modifier" (route #/question/:id). */
export async function renderEdit(app, questionId) {
  const question = await db.questions.get(questionId);
  if (!question) return go('#/subjects');
  const lesson = await getLesson(question.lessonId);
  draw(app, lesson, {
    context: '',
    explanation: '',
    options: [{ text: '', correct: true }, { text: '', correct: false }],
    ...question,
  }, false);
}

function draw(app, lesson, q, isNew) {
  const isAuto = q.source === 'auto'; // générée automatiquement : on corrige juste le texte

  app.innerHTML = `
    <a href="#/lesson/${lesson.id}" class="back">${escapeHtml(lesson.title)}</a>
    <h1 class="page-title">${isNew ? 'Nouvelle question' : 'Modifier la question'}</h1>

    <form id="form" novalidate>
      ${isAuto ? '<p class="hint">Question générée automatiquement : tu peux corriger son texte.</p>' : `
        <div class="switch" role="radiogroup" aria-label="Type de question">
          <button type="button" data-kind="qroc" class="${q.kind === 'qroc' ? 'on' : ''}">QROC<small>réponse courte</small></button>
          <button type="button" data-kind="qcm" class="${q.kind === 'qcm' ? 'on' : ''}">QCM<small>propositions</small></button>
        </div>`}

      <details class="fold" ${q.context ? 'open' : ''}>
        <summary>Énoncé de cas clinique <span class="hint">(facultatif)</span></summary>
        <textarea id="context" rows="4" placeholder="Ex. Homme de 65 ans, tabagique, consulte pour une dyspnée d'effort…">${escapeHtml(q.context)}</textarea>
      </details>

      <label class="field-label" for="prompt">Question</label>
      <textarea id="prompt" rows="3" placeholder="Ex. Quel est le principal signe d'insuffisance cardiaque gauche ?">${escapeHtml(q.prompt)}</textarea>

      <div id="qroc-part">
        <label class="field-label" for="answer">Réponse</label>
        <textarea id="answer" rows="3">${escapeHtml(q.answer ?? '')}</textarea>
      </div>

      <div id="qcm-part">
        <div class="field-label">Propositions <span class="hint">— touche la lettre pour marquer les bonnes réponses</span></div>
        <div id="options"></div>
        <button type="button" id="add-option" class="btn btn-ghost btn-block">＋ Ajouter une proposition</button>
        <label class="field-label" for="explanation">Explication <span class="hint">(facultatif)</span></label>
        <textarea id="explanation" rows="3">${escapeHtml(q.explanation)}</textarea>
      </div>

      <p class="form-error" id="error" role="alert"></p>

      <div class="btn-row">
        ${isNew ? '<button type="button" id="save-more" class="btn btn-ghost">Enregistrer +1</button>' : ''}
        <button type="submit" class="btn btn-go">Enregistrer</button>
      </div>
      ${!isNew ? '<button type="button" id="delete" class="btn btn-danger btn-block">Supprimer la question</button>' : ''}
    </form>
  `;

  // --- Type QROC / QCM ---
  let kind = q.kind;
  const showKind = () => {
    const qcm = kind === 'qcm';
    app.querySelector('#qroc-part').hidden = qcm;
    app.querySelector('#qcm-part').hidden = !qcm;
    app.querySelectorAll('[data-kind]').forEach((b) => {
      b.classList.toggle('on', b.dataset.kind === kind);
      b.setAttribute('aria-checked', b.dataset.kind === kind);
    });
  };
  app.querySelectorAll('[data-kind]').forEach((btn) => {
    btn.onclick = () => {
      kind = btn.dataset.kind;
      showKind();
    };
  });
  showKind();

  // --- Propositions du QCM ---
  let options = q.options.map((o) => ({ ...o }));
  const optionsEl = app.querySelector('#options');
  const drawOptions = () => {
    optionsEl.innerHTML = options.map((opt, i) => `
      <div class="opt-edit ${opt.correct ? 'is-correct' : ''}" data-i="${i}">
        <button type="button" class="opt-toggle" aria-pressed="${opt.correct}"
          aria-label="Proposition ${LETTERS[i]} : ${opt.correct ? 'juste' : 'fausse'}">${LETTERS[i]}</button>
        <input type="text" value="${escapeHtml(opt.text)}" placeholder="Proposition ${LETTERS[i]}" />
        <button type="button" class="opt-remove" aria-label="Retirer" ${options.length <= MIN_OPTIONS ? 'disabled' : ''}>✕</button>
      </div>`).join('');
    app.querySelector('#add-option').disabled = options.length >= MAX_OPTIONS;
  };
  drawOptions();

  optionsEl.addEventListener('input', (e) => {
    options[Number(e.target.closest('.opt-edit').dataset.i)].text = e.target.value;
  });
  optionsEl.addEventListener('click', (e) => {
    const row = e.target.closest('.opt-edit');
    if (!row) return;
    const i = Number(row.dataset.i);
    if (e.target.closest('.opt-toggle')) options[i].correct = !options[i].correct;
    else if (e.target.closest('.opt-remove')) options.splice(i, 1);
    else return;
    drawOptions();
  });
  app.querySelector('#add-option').onclick = () => {
    options.push({ text: '', correct: false });
    drawOptions();
    optionsEl.querySelector('.opt-edit:last-child input').focus();
  };

  // --- Enregistrement ---
  const read = () => ({
    kind,
    prompt: app.querySelector('#prompt').value.trim(),
    answer: app.querySelector('#answer').value.trim(),
    context: app.querySelector('#context').value.trim(),
    options: options.map((o) => ({ text: o.text.trim(), correct: o.correct })).filter((o) => o.text),
    explanation: app.querySelector('#explanation').value.trim(),
  });

  const save = async (andMore) => {
    const data = read();
    const error = validateQuestion(data);
    if (error) {
      app.querySelector('#error').textContent = error;
      return;
    }
    // On n'enregistre que les champs utiles au type choisi.
    const fields = data.kind === 'qcm'
      ? { kind: 'qcm', prompt: data.prompt, options: data.options, explanation: data.explanation, answer: '' }
      : { kind: data.kind, prompt: data.prompt, answer: data.answer, options: undefined, explanation: undefined };
    fields.context = data.context;

    if (isNew) await addUserQuestion({ lessonId: lesson.id, ...fields });
    else await updateQuestion(q.id, fields);

    toast(isNew ? 'Question ajoutée' : 'Question modifiée');
    if (andMore) renderNew(app, lesson.id);
    else go(`#/lesson/${lesson.id}`);
  };

  app.querySelector('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    save(false);
  });
  app.querySelector('#save-more')?.addEventListener('click', () => save(true));
  app.querySelector('#delete')?.addEventListener('click', async () => {
    if (!confirm('Supprimer cette question ?')) return;
    await deleteQuestion(q.id);
    toast('Question supprimée');
    go(`#/lesson/${lesson.id}`);
  });
}

/**
 * Vérifie une question avant de l'enregistrer.
 * Renvoie un message d'erreur, ou null si tout va bien.
 */
export function validateQuestion(q) {
  if (!q.prompt) return 'Écris la question.';
  if (q.kind === 'qcm') {
    if (q.options.length < MIN_OPTIONS) return `Il faut au moins ${MIN_OPTIONS} propositions.`;
    if (!q.options.some((o) => o.correct)) return 'Marque au moins une bonne réponse (touche sa lettre).';
    return null;
  }
  if (!q.answer) return 'Écris la réponse.';
  return null;
}
