// =============================================================
// db.js — La base de données locale (IndexedDB, via Dexie.js)
// =============================================================
// Tout est stocké sur le téléphone, rien n'est envoyé sur Internet.
//
// Tables :
//  - subjects  : les matières           { id, name, createdAt }
//  - lessons   : les leçons             { id, subjectId, title, text, highlights, createdAt }
//  - reviews   : les révisions prévues  { id, lessonId, step, dueDate, status, doneDate, ... }
//  - questions : les questions          { id, lessonId, type, prompt, answer, source, ... }
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

export function addSubject(name) {
  return db.subjects.add({ name: name.trim(), createdAt: Date.now() });
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
