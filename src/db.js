// =============================================================
// db.js — La base de données locale (IndexedDB, via Dexie.js)
// =============================================================
// Tout est stocké sur le téléphone, rien n'est envoyé sur Internet.
//
// Tables :
//  - subjects  : les matières           { id, name, color, createdAt }
//  - lessons   : les leçons             { id, subjectId, title, text, highlights, createdAt }
//  - reviews   : les révisions prévues  { id, lessonId, step, dueDate, status, doneDate, ... }
//  - questions : les questions          { id, lessonId, kind, prompt, answer, source, ... }
//      kind = 'definition' | 'list' (générées automatiquement, source 'auto')
//           | 'qroc' | 'qcm'          (écrites par toi, source 'user', ou par l'IA, source 'ai')
//      Une question QCM a aussi : options [{ text, correct }] et explanation.
//      Toute question peut avoir un "context" : l'énoncé d'un cas clinique.
//  - settings  : les réglages           { key, value }
//
// Dans la chaîne de "stores" ci-dessous, on liste seulement les champs
// sur lesquels on veut pouvoir faire des recherches (les "index").
// Les autres champs sont enregistrés quand même.

import Dexie from 'dexie';

export const db = new Dexie('revisions');

db.version(1).stores({
  subjects: '++id, name',
  lessons: '++id, subjectId',
  reviews: '++id, lessonId, status, dueDate',
  questions: '++id, lessonId',
  settings: 'key',
});

// ---------- Matières ----------

export function listSubjects() {
  return db.subjects.orderBy('name').toArray();
}

// Couleurs des "lignes" (une par matière), comme sur un plan de métro.
export const LINE_COLORS = [
  '#f2c500', '#2a6ad8', '#e5508e', '#1fa463', '#f08a24',
  '#8b5bd6', '#00a5b5', '#d93a2b', '#9a7b4f', '#6fbf3a',
];

/** Couleur d'une matière (les anciennes matières sans couleur en reçoivent une selon leur numéro). */
export function subjectColor(subject) {
  return subject?.color ?? LINE_COLORS[((subject?.id ?? 1) - 1) % LINE_COLORS.length];
}

/** Ajoute une matière avec la prochaine couleur de ligne libre. */
export async function addSubject(name) {
  const count = await db.subjects.count();
  return db.subjects.add({
    name: name.trim(),
    color: LINE_COLORS[count % LINE_COLORS.length],
    createdAt: Date.now(),
  });
}

export function renameSubject(id, name) {
  return db.subjects.update(id, { name: name.trim() });
}

/** Supprime une matière ET tout ce qu'elle contient (leçons, révisions, questions). */
export async function deleteSubject(id) {
  await db.transaction('rw', db.subjects, db.lessons, db.reviews, db.questions, async () => {
    const lessons = await db.lessons.where('subjectId').equals(id).toArray();
    for (const lesson of lessons) await deleteLessonData(lesson.id);
    await db.subjects.delete(id);
  });
}

// ---------- Leçons ----------

export function listLessons(subjectId) {
  return db.lessons.where('subjectId').equals(subjectId).sortBy('createdAt');
}

export function getLesson(id) {
  return db.lessons.get(id);
}

export async function deleteLesson(id) {
  await db.transaction('rw', db.lessons, db.reviews, db.questions, () => deleteLessonData(id));
}

async function deleteLessonData(lessonId) {
  await db.reviews.where('lessonId').equals(lessonId).delete();
  await db.questions.where('lessonId').equals(lessonId).delete();
  await db.lessons.delete(lessonId);
}

// ---------- Questions ----------

export function listQuestions(lessonId) {
  return db.questions.where('lessonId').equals(lessonId).toArray();
}

/**
 * Ajoute une question écrite par toi.
 * @param {object} question — { lessonId, kind: 'qroc'|'qcm', prompt, answer?, options?, explanation?, context? }
 */
export function addUserQuestion(question) {
  return db.questions.add({
    ...question,
    source: 'user',
    lastRating: null,
    ratings: { easy: 0, medium: 0, hard: 0 },
    createdAt: Date.now(),
  });
}

/** Ajoute des questions générées par l'IA à une leçon. */
export function addAiQuestions(lessonId, questions) {
  return db.questions.bulkAdd(questions.map((q) => ({
    ...q,
    lessonId,
    source: 'ai',
    lastRating: null,
    ratings: { easy: 0, medium: 0, hard: 0 },
    createdAt: Date.now(),
  })));
}

export function updateQuestion(id, changes) {
  return db.questions.update(id, changes);
}

export function deleteQuestion(id) {
  return db.questions.delete(id);
}
