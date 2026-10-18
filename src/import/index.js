// =============================================================
// import/index.js — Choisit le bon extracteur selon le type de fichier
// =============================================================

import { extractPdfText } from './pdf.js';
import { extractDocxText } from './docx.js';
import { extractPptxText } from './pptx.js';

/**
 * Types acceptés dans le sélecteur de fichier.
 * On met l'extension ET le type officiel : certains téléphones n'utilisent que l'un des deux.
 */
export const ACCEPTED_FILES = [
  '.pdf', 'application/pdf',
  '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',');

/**
 * Lit un fichier (PDF, Word ou PowerPoint) et renvoie son texte.
 * @param {File} file
 * @param {(n:number, total:number) => void} onProgress — page ou diapo en cours
 */
export function extractText(file, onProgress) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return extractPdfText(file, onProgress);
  if (ext === 'docx') return extractDocxText(file);
  if (ext === 'pptx') return extractPptxText(file, onProgress);
  if (ext === 'doc' || ext === 'ppt') {
    throw new Error(`les anciens fichiers .${ext} ne sont pas lus : enregistre-le en .${ext}x depuis Word/PowerPoint`);
  }
  throw new Error(`format .${ext} non pris en charge (PDF, .docx ou .pptx)`);
}

/** Retire l'extension du nom de fichier pour proposer un titre. */
export function titleFromFileName(name) {
  return name.replace(/\.(pdf|docx|pptx)$/i, '').replace(/[_-]+/g, ' ').trim();
}
