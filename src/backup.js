// =============================================================
// backup.js — Sauvegarde et restauration de toutes les données
// =============================================================
// Toutes les données restent sur le téléphone. Pour ne rien perdre
// (changement de téléphone, données du navigateur effacées…), on peut
// les exporter dans UN fichier .json, puis le réimporter plus tard.
//
// Format du fichier :
//   {
//     "app": "revisions",
//     "version": 1,
//     "exportedAt": "2026-10-18T10:00:00.000Z",
//     "tables": { "subjects": [...], "lessons": [...], "reviews": [...],
//                 "questions": [...], "settings": [...] }
//   }
//
// Importer une sauvegarde REMPLACE toutes les données actuelles
// (c'est plus sûr qu'un mélange, qui pourrait créer des doublons).
//
// La clé API de l'IA n'est JAMAIS mise dans le fichier (il pourrait être
// partagé ou envoyé par mail). À l'import, on garde la clé déjà présente.

import { db } from './db.js';
import { todayStr } from './scheduler.js';

export const BACKUP_VERSION = 1;
const TABLES = ['subjects', 'lessons', 'reviews', 'questions', 'settings'];

/** Rassemble toutes les données dans un objet prêt à être enregistré. */
export async function buildBackup() {
  const tables = {};
  for (const name of TABLES) tables[name] = await db.table(name).toArray();
  tables.settings = tables.settings.map((row) =>
    row.key === 'ai' ? { ...row, value: { ...row.value, apiKey: '' } } : row);
  return {
    app: 'revisions',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** Nom du fichier : revisions-sauvegarde-2026-10-18.json */
export function backupFileName(date = todayStr()) {
  return `revisions-sauvegarde-${date}.json`;
}

/**
 * Vérifie qu'un objet est bien une sauvegarde de l'appli.
 * Renvoie un message d'erreur, ou null si tout va bien.
 */
export function validateBackup(data) {
  if (!data || typeof data !== 'object') return "Ce fichier n'est pas une sauvegarde.";
  if (data.app !== 'revisions') return "Ce fichier ne vient pas de l'appli Révisions.";
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    return "Cette sauvegarde vient d'une version plus récente de l'appli. Mets l'appli à jour.";
  }
  for (const name of TABLES) {
    if (!Array.isArray(data.tables?.[name])) return `Sauvegarde incomplète (il manque « ${name} »).`;
  }
  // Chaque leçon doit appartenir à une matière, chaque révision à une leçon.
  const subjectIds = new Set(data.tables.subjects.map((s) => s.id));
  const lessonIds = new Set(data.tables.lessons.map((l) => l.id));
  if (data.tables.lessons.some((l) => !subjectIds.has(l.subjectId))) return 'Sauvegarde abîmée (leçon sans matière).';
  if (data.tables.reviews.some((r) => !lessonIds.has(r.lessonId))) return 'Sauvegarde abîmée (révision sans leçon).';
  return null;
}

/** Résumé lisible : "3 matières, 12 leçons, 85 questions". */
export function describeBackup(data) {
  const t = data.tables;
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  return `${plural(t.subjects.length, 'matière')}, ${plural(t.lessons.length, 'leçon')}, ${plural(t.questions.length, 'question')}`;
}

/**
 * Remplace toutes les données par celles de la sauvegarde.
 * Tout se fait dans une "transaction" : en cas de problème, rien n'est modifié.
 */
export async function restoreBackup(data) {
  const error = validateBackup(data);
  if (error) throw new Error(error);
  const tables = TABLES.map((name) => db.table(name));
  await db.transaction('rw', tables, async () => {
    const currentAi = await db.settings.get('ai'); // pour conserver la clé API de ce téléphone
    for (const name of TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(data.tables[name]);
    }
    const restoredAi = await db.settings.get('ai');
    if (currentAi?.value?.apiKey && restoredAi && !restoredAi.value.apiKey) {
      await db.settings.put({ key: 'ai', value: { ...restoredAi.value, apiKey: currentAi.value.apiKey } });
    }
  });
}

/**
 * Enregistre le fichier sur le téléphone.
 *  - Si le téléphone sait "partager" un fichier (Android, iPhone), on ouvre
 *    le menu de partage : tu peux l'enregistrer dans Fichiers, Drive, te
 *    l'envoyer par mail…
 *  - Sinon (ordinateur), on le télécharge.
 * Renvoie 'shared', 'downloaded' ou 'cancelled'.
 */
export async function saveBackupFile(data) {
  const name = backupFileName();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde Révisions' });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // Partage impossible : on passe au téléchargement classique.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
