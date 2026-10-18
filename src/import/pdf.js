// =============================================================
// import/pdf.js — Extraction du texte d'un PDF (avec pdf.js de Mozilla)
// =============================================================
// Tout se passe dans le téléphone : le fichier n'est envoyé nulle part.
// Attention : un PDF "scanné" (photos de pages) ne contient pas de texte,
// il faudrait de la reconnaissance de caractères (OCR) — non prévu pour l'instant.

import { cleanText } from '../text.js';

/**
 * Lit un fichier PDF et renvoie son texte nettoyé.
 * @param {File} file — le fichier choisi par l'utilisateur
 * @param {(page:number, total:number) => void} onProgress — pour afficher l'avancement
 */
export async function extractPdfText(file, onProgress = () => {}) {
  // pdf.js est gros : on ne le charge qu'au moment où on en a besoin.
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress(n, pdf.numPages);
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push(itemsToText(content.items));
  }
  return cleanText(pages.join('\n\n'));
}

/**
 * Recompose les lignes d'une page à partir des morceaux de texte de pdf.js.
 * Chaque morceau a une position (transform[5] = hauteur sur la page) :
 * quand la hauteur change, on passe à la ligne.
 */
function itemsToText(items) {
  let text = '';
  let lastY = null;
  for (const item of items) {
    if (!('str' in item)) continue;
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2 && !text.endsWith('\n')) text += '\n';
    text += item.str;
    // Fin de ligne signalée par pdf.js (sans doubler les retours à la ligne).
    if (item.hasEOL && !text.endsWith('\n')) text += '\n';
    lastY = y;
  }
  return text;
}
