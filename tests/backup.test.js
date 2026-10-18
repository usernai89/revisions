// Tests de la sauvegarde : exporter, tout effacer, réimporter → on retrouve tout.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, addSubject } from '../src/db.js';
import { createLessonWithPlan } from '../src/scheduler.js';
import { saveSetting } from '../src/settings.js';
import { buildBackup, restoreBackup, validateBackup, describeBackup, backupFileName } from '../src/backup.js';

async function snapshot() {
  const out = {};
  for (const t of db.tables) out[t.name] = await t.toArray();
  return out;
}

describe('sauvegarde', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('exporte puis restaure exactement les mêmes données', async () => {
    const subjectId = await addSubject('Cardiologie');
    await createLessonWithPlan({ subjectId, title: 'IC', text: "L'orthopnée est une dyspnée en position couchée." }, '2026-10-01');
    await saveSetting('budget', { weekday: 45, weekend: 120 });
    const before = await snapshot();

    // Aller-retour par du texte JSON, comme avec un vrai fichier.
    const file = JSON.parse(JSON.stringify(await buildBackup()));
    await Promise.all(db.tables.map((t) => t.clear()));
    expect(await db.lessons.count()).toBe(0);

    await restoreBackup(file);
    expect(await snapshot()).toEqual(before);
    expect(describeBackup(file)).toBe('1 matière, 1 leçon, 1 question');
  });

  it('remplace les données existantes (pas de doublons)', async () => {
    await addSubject('Ancienne');
    const backup = await buildBackup();
    await addSubject('Nouvelle');
    await restoreBackup(backup);
    expect((await db.subjects.toArray()).map((s) => s.name)).toEqual(['Ancienne']);
  });

  it('refuse un fichier qui n\'est pas une sauvegarde', async () => {
    expect(validateBackup(null)).toMatch(/pas une sauvegarde/);
    expect(validateBackup({ app: 'autre' })).toMatch(/ne vient pas/);
    expect(validateBackup({ app: 'revisions', version: 99, tables: {} })).toMatch(/plus récente/);
    expect(validateBackup({ app: 'revisions', version: 1, tables: { subjects: [] } })).toMatch(/incomplète/);
    const orphan = {
      app: 'revisions', version: 1,
      tables: { subjects: [], lessons: [{ id: 1, subjectId: 9 }], reviews: [], questions: [], settings: [] },
    };
    expect(validateBackup(orphan)).toMatch(/abîmée/);
  });

  it('ne touche à rien si la sauvegarde est invalide', async () => {
    await addSubject('Gardée');
    await expect(restoreBackup({ app: 'autre' })).rejects.toThrow();
    expect(await db.subjects.count()).toBe(1);
  });

  it('nomme le fichier avec la date', () => {
    expect(backupFileName('2026-10-18')).toBe('revisions-sauvegarde-2026-10-18.json');
  });
});

describe('clé API et sauvegarde', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it("n'exporte jamais la clé, et garde celle du téléphone à l'import", async () => {
    await saveSetting('ai', { enabled: true, provider: 'anthropic', apiKey: 'sk-secret', model: '', baseUrl: '', count: 10 });
    const backup = await buildBackup();
    expect(JSON.stringify(backup)).not.toContain('sk-secret');

    await restoreBackup(JSON.parse(JSON.stringify(backup)));
    expect((await db.settings.get('ai')).value).toMatchObject({ enabled: true, apiKey: 'sk-secret' });
  });
});
